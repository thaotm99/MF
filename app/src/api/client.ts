import { buildSignedHeaders, parsePrivateKey } from './signing'
import type {
  AccessPointResponse,
  AccountCredential,
  AccountDetailsResponse,
  DealHistoryItem,
  DealsHistoryResponse,
  InstrumentConditionResponse,
  LimitsResponse,
  TradingStateSnapshot,
} from './types'

export type ConnectionMode = 'direct' | 'proxy'

export class ExnessApiError extends Error {
  readonly status: number
  readonly code?: string | number

  constructor(message: string, status: number, code?: string | number) {
    super(message)
    this.status = status
    this.code = code
  }
}

const DAY_MS = 86_400_000

function normalizeHost(host: string): string {
  const h = host.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(h) ? h : `https://${h}`
}

/** Thời gian dạng RFC 3339 không có mili giây, ví dụ 2026-03-16T12:54:30Z */
function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Client cho một tài khoản: ký request, tìm access point, giới hạn tốc độ. */
export class AccountClient {
  private readonly privateKey: Uint8Array
  private baseUrl: string | null = null
  private limits: LimitsResponse['limits'] | null = null
  private lastCall = new Map<string, number>()
  private conditions = new Map<string, Promise<InstrumentConditionResponse | null>>()

  readonly cred: AccountCredential
  readonly mode: ConnectionMode

  constructor(cred: AccountCredential, mode: ConnectionMode) {
    this.cred = cred
    this.mode = mode
    this.privateKey = parsePrivateKey(cred.secretKey)
  }

  private urlFor(host: string, pathWithQuery: string): string {
    if (this.mode === 'proxy') {
      const hostname = new URL(normalizeHost(host)).host
      return `/__exness/${hostname}${pathWithQuery}`
    }
    return `${normalizeHost(host)}${pathWithQuery}`
  }

  /** Giãn cách request theo rate limit của từng operation (lấy từ /limits). */
  private async throttle(operationId: string) {
    const m = this.limits?.rest.methods.find((x) => x.api_operation_id === operationId)
    const rate = m?.rate_limit ?? this.limits?.rest.global_account_rate
    if (!rate) return
    const minGap = (rate.window_seconds * 1000) / rate.limit
    const wait = (this.lastCall.get(operationId) ?? 0) + minGap - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastCall.set(operationId, Date.now())
  }

  private async signedGet<T>(host: string, pathWithQuery: string, operationId: string): Promise<T> {
    await this.throttle(operationId)
    const headers = buildSignedHeaders({
      apiKey: this.cred.apiKey,
      privateKey: this.privateKey,
      method: 'GET',
      pathWithQuery,
    })
    let res: Response
    try {
      res = await fetch(this.urlFor(host, pathWithQuery), { method: 'GET', headers })
    } catch (e) {
      throw new ExnessApiError(
        this.mode === 'direct'
          ? 'Không kết nối được API (có thể bị chặn bởi CORS). Thử chế độ "Qua proxy dev" trong phần Tài khoản.'
          : `Không kết nối được proxy: ${String(e)}`,
        0,
      )
    }
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      /* phản hồi không phải JSON */
    }
    if (!res.ok) {
      const err = json as { code?: string | number; error_message?: string } | null
      throw new ExnessApiError(err?.error_message ?? `HTTP ${res.status}`, res.status, err?.code)
    }
    return json as T
  }

  private get accountPath() {
    return encodeURIComponent(this.cred.accountId)
  }

  async init() {
    if (this.baseUrl) return
    let host = this.cred.host
    if (this.cred.resolveAccessPoint) {
      const ap = await this.signedGet<AccessPointResponse>(
        host,
        `/v1/trading/access-point${buildQuery({ account_id: this.cred.accountId })}`,
        'getAccessPoint',
      )
      host = ap.access_point
    }
    this.baseUrl = host
    try {
      const res = await this.signedGet<LimitsResponse>(
        host,
        `/v1/configuration/accounts/${this.accountPath}/limits`,
        'getLimits',
      )
      this.limits = res.limits
    } catch {
      // Không có limits thì dùng giá trị mặc định an toàn bên dưới.
    }
  }

  private get host() {
    if (!this.baseUrl) throw new Error('Client chưa init()')
    return this.baseUrl
  }

  /** Giới hạn lịch sử deals: độ dài mỗi lần gọi và độ cũ tối đa (ngày). */
  get dealsHistoryLimits() {
    const m = this.limits?.rest.methods.find((x) => x.api_operation_id === 'getDealsHistory')
    return {
      rangeDays: m?.limits?.history_range_days ?? 7,
      ageDays: m?.limits?.history_age_days,
    }
  }

  getAccount() {
    return this.signedGet<AccountDetailsResponse>(
      this.host,
      `/v1/configuration/accounts/${this.accountPath}/account`,
      'getAccountDetails',
    )
  }

  getSnapshot() {
    return this.signedGet<TradingStateSnapshot>(
      this.host,
      `/v1/trading/accounts/${this.accountPath}/snapshot`,
      'getTradingStateSnapshot',
    )
  }

  getInstrumentCondition(instrument: string) {
    let p = this.conditions.get(instrument)
    if (!p) {
      p = this.signedGet<InstrumentConditionResponse>(
        this.host,
        `/v1/configuration/accounts/${this.accountPath}/instruments/${encodeURIComponent(instrument)}/conditions`,
        'getInstrumentCondition',
      ).catch(() => null)
      this.conditions.set(instrument, p)
    }
    return p
  }

  /**
   * Lấy toàn bộ deals trong [from, to), tự chia nhỏ theo history_range_days
   * và đi hết các trang cursor. Trả về `clampedFrom` nếu bị cắt bởi history_age_days.
   */
  async getDeals(from: Date, to: Date): Promise<{ items: DealHistoryItem[]; clampedFrom?: Date }> {
    const { rangeDays, ageDays } = this.dealsHistoryLimits
    const now = Date.now()
    let start = from.getTime()
    let clampedFrom: Date | undefined
    if (ageDays) {
      // chừa 1 phút để không vượt giới hạn do lệch giờ
      const oldest = now - ageDays * DAY_MS + 60_000
      if (start < oldest) {
        start = oldest
        clampedFrom = new Date(oldest)
      }
    }
    const end = Math.min(to.getTime(), now - 1000)
    const items: DealHistoryItem[] = []
    const chunk = rangeDays * DAY_MS

    for (let s = start; s < end; s += chunk) {
      const e = Math.min(s + chunk, end)
      const base = `/v1/history/accounts/${this.accountPath}/deals`
      let page = await this.signedGet<DealsHistoryResponse>(
        this.host,
        base + buildQuery({ from: isoSeconds(new Date(s)), to: isoSeconds(new Date(e)), limit: 200 }),
        'getDealsHistory',
      )
      items.push(...page.items)
      while (page.has_more && page.next_cursor) {
        page = await this.signedGet<DealsHistoryResponse>(
          this.host,
          base + buildQuery({ cursor: page.next_cursor, limit: 200 }),
          'getDealsHistory',
        )
        items.push(...page.items)
      }
    }
    return { items, clampedFrom }
  }
}
