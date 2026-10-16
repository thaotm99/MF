import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { AccountClient } from '../api/client'
import type { AccountDetailsResponse, AccountState, DealHistoryItem } from '../api/types'
import { notionalOf, type AccountDeal } from '../utils/stats'
import { useReportsStore } from './reports'
import { useSettingsStore } from './settings'

interface AccountData {
  details: AccountDetailsResponse | null
  state: AccountState | null
  /** Khoảng thời gian đã tải deals [from, to) */
  coverage: { from: number; to: number } | null
  deals: Map<string, AccountDeal>
  /** Mốc sớm nhất API cho phép (history_age_days), nếu bị cắt */
  oldestAllowed?: number
  error: string | null
  loading: boolean
}

/** Dữ liệu tải từ API cho từng tài khoản và các phép tải bổ sung theo khoảng ngày. */
export const useDashboardStore = defineStore('dashboard', () => {
  const settings = useSettingsStore()
  const reports = useReportsStore()
  const data = ref<Record<string, AccountData>>({})
  const clients = shallowRef(new Map<string, AccountClient>())
  const loading = computed(() => Object.values(data.value).some((d) => d.loading))

  function clientFor(key: string): AccountClient {
    const cred = settings.credentials.find((a) => a.id === key)
    if (!cred) throw new Error('Không tìm thấy tài khoản')
    let c = clients.value.get(key)
    // Tạo lại client nếu thông tin đăng nhập hoặc chế độ kết nối thay đổi
    if (!c || JSON.stringify(c.cred) !== JSON.stringify(cred) || c.mode !== settings.mode) {
      c = new AccountClient({ ...cred }, settings.mode)
      clients.value.set(key, c)
      delete data.value[key]
    }
    return c
  }

  function entry(key: string): AccountData {
    if (!data.value[key]) {
      data.value[key] = { details: null, state: null, coverage: null, deals: new Map(), error: null, loading: false }
    }
    return data.value[key]
  }

  async function addDeals(client: AccountClient, d: AccountData, items: DealHistoryItem[]) {
    const currency = d.details?.settings?.currency ?? 'USD'
    const instruments = [...new Set(items.map((i) => i.deal.instrument).filter(Boolean) as string[])]
    const conds = new Map(
      await Promise.all(instruments.map(async (i) => [i, await client.getInstrumentCondition(i)] as const)),
    )
    for (const { deal } of items) {
      d.deals.set(deal.deal_id, {
        accountKey: client.cred.id,
        accountId: client.cred.accountId,
        currency,
        deal,
        notional: notionalOf(deal, deal.instrument ? (conds.get(deal.instrument) ?? null) : null, currency),
      })
    }
  }

  /** Đảm bảo đã có deals trong [from, to) cho một tài khoản; chỉ tải phần còn thiếu. */
  /** Tài khoản MT5 lấy toàn bộ dữ liệu từ báo cáo HTML, không gọi API. */
  function fillFromReport(key: string): boolean {
    const rep = reports.byId(key)
    if (!rep) return false
    const r = rep.latest
    data.value[key] = {
      details: {
        account_id: rep.login,
        account_name: rep.label,
        create_date: '',
        settings: { currency: rep.currency, leverage: '', trade_mode: '', account_status: '', execution_mode: '' },
      },
      state: {
        balance: String(r.balance ?? 0),
        equity: String(r.equity ?? r.balance ?? 0),
        used_margin: '0',
      },
      coverage: { from: -Infinity, to: Infinity },
      deals: new Map(rep.deals.map((d) => [d.deal.deal_id, d])),
      error: null,
      loading: false,
    }
    return true
  }

  async function ensureAccount(key: string, from: number, to: number, refreshState: boolean) {
    if (fillFromReport(key)) return
    const d = entry(key)
    d.loading = true
    d.error = null
    try {
      const client = clientFor(key)
      const fresh = entry(key) // clientFor có thể đã reset
      fresh.loading = true
      await client.init()
      if (!fresh.details) fresh.details = await client.getAccount()
      if (refreshState || !fresh.state) fresh.state = (await client.getSnapshot()).account_state

      const ranges: [number, number][] = []
      if (!fresh.coverage) ranges.push([from, to])
      else {
        if (from < fresh.coverage.from) ranges.push([from, fresh.coverage.from])
        if (to > fresh.coverage.to) ranges.push([fresh.coverage.to, to])
      }
      for (const [f, t] of ranges) {
        const res = await client.getDeals(new Date(f), new Date(t))
        if (res.clampedFrom) fresh.oldestAllowed = res.clampedFrom.getTime()
        await addDeals(client, fresh, res.items)
        fresh.coverage = fresh.coverage
          ? { from: Math.min(fresh.coverage.from, f), to: Math.max(fresh.coverage.to, t) }
          : { from: f, to: t }
      }
      fresh.loading = false
    } catch (e) {
      const cur = entry(key)
      cur.error = e instanceof Error ? e.message : String(e)
      cur.loading = false
    }
  }

  // Xếp hàng các lần tải theo tài khoản để không tải trùng cùng một khoảng thời gian
  const queues = new Map<string, Promise<void>>()

  async function ensureRange(keys: string[], from: number, to: number, refreshState = false) {
    const now = Date.now()
    await Promise.all(
      keys.map((k) => {
        const next = (queues.get(k) ?? Promise.resolve()).then(() =>
          ensureAccount(k, from, Math.min(to, now), refreshState),
        )
        queues.set(k, next)
        return next
      }),
    )
  }

  /** Xoá cache và tải lại từ đầu. */
  function reset() {
    queues.clear()
    data.value = {}
    clients.value = new Map()
  }

  function dealsOf(keys: string[]): AccountDeal[] {
    return keys.flatMap((k) => [...(data.value[k]?.deals.values() ?? [])])
  }

  return { data, loading, ensureRange, reset, dealsOf }
})
