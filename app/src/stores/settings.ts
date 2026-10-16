import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { AccountCredential, AccountEntry, ApiKeyEntry } from '../api/types'
import type { ConnectionMode } from '../api/client'

export type TimeZoneMode = 'utc' | 'local'

const KEY = 'exness-dashboard.settings.v2'
const LEGACY_KEY = 'exness-dashboard.settings.v1'

interface Persisted {
  keys: ApiKeyEntry[]
  accounts: AccountEntry[]
  mode: ConnectionMode
  timeZone: TimeZoneMode
  /** Key mặc định cho các tài khoản đọc từ file JSON */
  fileKeyId: string | null
}

/** File danh sách tài khoản, đặt trong thư mục public/ */
export const ACCOUNTS_FILE = '/accounts.json'

interface FileAccountRow {
  account_id?: string | number
  account_name?: string
  acount_name?: string
  /** Tên key (trùng với tên trong mục API key); bỏ trống = key mặc định cho file */
  key?: string
  resolve_access_point?: boolean
}

/** JSON chuẩn; nếu lỗi thì thử lại sau khi thêm ngoặc kép cho tên trường và bỏ dấu phẩy thừa. */
function parseLenientJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (e) {
    const fixed = text
      .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*)'/g, '"$1"')
      .replace(/,(\s*[}\]])/g, '$1')
    try {
      return JSON.parse(fixed)
    } catch {
      throw new Error(`File JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

export interface FileStatus {
  state: 'idle' | 'loading' | 'ok' | 'missing' | 'error'
  message?: string
  count?: number
}

/** id cố định của key đọc từ .env (do dev server ký, không lưu localStorage) */
export const ENV_KEY_ID = 'env'

export const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Bản v1 lưu key ngay trong từng tài khoản; tách ra thành danh sách key dùng chung. */
function migrateV1(raw: string): Persisted {
  const old = JSON.parse(raw) as { accounts?: AccountCredential[]; mode?: ConnectionMode; timeZone?: TimeZoneMode }
  const keys: ApiKeyEntry[] = []
  const accounts: AccountEntry[] = []
  for (const a of old.accounts ?? []) {
    let k = keys.find((x) => x.apiKey === a.apiKey && x.secretKey === a.secretKey && x.host === a.host)
    if (!k) {
      k = { id: newId(), name: `Key ${keys.length + 1}`, apiKey: a.apiKey, secretKey: a.secretKey, host: a.host }
      keys.push(k)
    }
    accounts.push({ id: a.id, label: a.label, accountId: a.accountId, keyId: k.id, resolveAccessPoint: a.resolveAccessPoint })
  }
  return { keys, accounts, mode: old.mode ?? 'direct', timeZone: old.timeZone ?? 'utc', fileKeyId: keys[0]?.id ?? null }
}

function load(): Persisted {
  const empty: Persisted = { keys: [], accounts: [], mode: 'proxy', timeZone: 'utc', fileKeyId: null }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = { ...empty, ...JSON.parse(raw) } as Persisted & { modeVersion?: number }
      // Exness chặn CORS khi gọi trực tiếp → chuyển một lần sang proxy cho cấu hình cũ
      if (!parsed.modeVersion) parsed.mode = 'proxy'
      return parsed
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) return migrateV1(legacy)
  } catch {
    /* localStorage bị chặn hoặc dữ liệu hỏng */
  }
  return empty
}

/** API key, tài khoản và tuỳ chọn kết nối, lưu trong localStorage của trình duyệt. */
export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const keys = ref<ApiKeyEntry[]>(initial.keys)
  const accounts = ref<AccountEntry[]>(initial.accounts)
  const mode = ref<ConnectionMode>(initial.mode)
  const timeZone = ref<TimeZoneMode>(initial.timeZone)
  const fileKeyId = ref<string | null>(initial.fileKeyId)

  // ---------- Key từ .env (dev server ký, trình duyệt chỉ biết API key đã che) ----------

  const envKey = ref<ApiKeyEntry | null>(null)
  const envKeyError = ref<string | null>(null)

  async function loadEnvKey() {
    try {
      const res = await fetch('/__exness-env/info', { cache: 'no-store' })
      if (!(res.headers.get('content-type') ?? '').includes('json')) return // không chạy dev server
      const info = (await res.json()) as { available: boolean; apiKey?: string; host?: string; error?: string }
      envKeyError.value = info.error ?? null
      envKey.value = info.available
        ? { id: ENV_KEY_ID, name: 'Key từ .env', apiKey: info.apiKey ?? '', secretKey: '', host: info.host ?? '', serverSigned: true }
        : null
    } catch {
      envKey.value = null
    }
  }

  /** Key từ .env (nếu có) + key nhập trên giao diện */
  const allKeys = computed<ApiKeyEntry[]>(() => (envKey.value ? [envKey.value, ...keys.value] : keys.value))
  /** Key cho tài khoản từ file: key đã chọn, nếu không thì key .env / key đầu tiên */
  const defaultFileKeyId = computed(() => {
    const chosen = fileKeyId.value && allKeys.value.some((k) => k.id === fileKeyId.value) ? fileKeyId.value : null
    return chosen ?? allKeys.value[0]?.id ?? ''
  })

  // immediate: ghi ngay dữ liệu vừa chuyển đổi từ bản v1
  watch(
    [keys, accounts, mode, timeZone, fileKeyId],
    () => {
      try {
        const data: Persisted = {
          keys: keys.value, accounts: accounts.value, mode: mode.value, timeZone: timeZone.value, fileKeyId: fileKeyId.value,
        }
        Object.assign(data, { modeVersion: 2 })
        localStorage.setItem(KEY, JSON.stringify(data))
        localStorage.removeItem(LEGACY_KEY)
      } catch {
        /* bỏ qua */
      }
    },
    { deep: true, immediate: true },
  )

  // ---------- Tài khoản từ file JSON ----------

  const fileRows = ref<FileAccountRow[]>([])
  const fileStatus = ref<FileStatus>({ state: 'idle' })

  async function loadAccountsFile() {
    fileStatus.value = { state: 'loading' }
    try {
      const res = await fetch(ACCOUNTS_FILE, { cache: 'no-store' })
      // Vite trả index.html cho đường dẫn không tồn tại, nên kiểm tra cả content-type
      if (res.status === 404 || !(res.headers.get('content-type') ?? '').includes('json')) {
        fileRows.value = []
        fileStatus.value = { state: 'missing' }
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = parseLenientJson(await res.text())
      const rows = Array.isArray(json) ? json : (json as { accounts?: unknown })?.accounts
      if (!Array.isArray(rows)) throw new Error('File phải là một mảng JSON')
      const valid = (rows as FileAccountRow[]).filter((r) => /^\d{1,20}$/.test(String(r?.account_id ?? '')))
      fileRows.value = valid
      const skipped = rows.length - valid.length
      fileStatus.value = {
        state: 'ok',
        count: valid.length,
        message: skipped ? `Bỏ qua ${skipped} dòng thiếu hoặc sai account_id` : undefined,
      }
    } catch (e) {
      fileRows.value = []
      fileStatus.value = { state: 'error', message: e instanceof Error ? e.message : String(e) }
    }
  }

  const fileAccounts = computed<AccountEntry[]>(() =>
    fileRows.value.map((r) => {
      const id = String(r.account_id)
      const named = r.key ? allKeys.value.find((k) => k.name === r.key) : undefined
      return {
        id: `file:${id}`,
        label: r.account_name ?? r.acount_name ?? `#${id}`,
        accountId: id,
        keyId: named?.id ?? (r.key ? '' : defaultFileKeyId.value),
        resolveAccessPoint: r.resolve_access_point ?? true,
        source: 'file' as const,
      }
    }),
  )

  /** Tài khoản từ file + tài khoản thêm tay (bỏ tài khoản thêm tay trùng ID với file). */
  const allAccounts = computed<AccountEntry[]>(() => {
    const fromFile = new Set(fileAccounts.value.map((a) => a.accountId))
    return [...fileAccounts.value, ...accounts.value.filter((a) => !fromFile.has(a.accountId))]
  })

  /** Tài khoản đã ghép với key; bỏ qua tài khoản chưa có key hợp lệ. */
  const credentials = computed<AccountCredential[]>(() =>
    allAccounts.value.flatMap((a) => {
      const k = allKeys.value.find((x) => x.id === a.keyId)
      return k
        ? [{ id: a.id, label: a.label, accountId: a.accountId, apiKey: k.apiKey, secretKey: k.secretKey, host: k.host, resolveAccessPoint: a.resolveAccessPoint, serverSigned: k.serverSigned }]
        : []
    }),
  )

  function upsertKey(k: ApiKeyEntry) {
    const i = keys.value.findIndex((x) => x.id === k.id)
    if (!fileKeyId.value) fileKeyId.value = k.id
    if (i === -1) keys.value.push(k)
    else keys.value[i] = k
  }

  function removeKey(id: string) {
    keys.value = keys.value.filter((k) => k.id !== id)
    if (fileKeyId.value === id) fileKeyId.value = keys.value[0]?.id ?? null
  }

  function upsertAccount(a: AccountEntry) {
    const i = accounts.value.findIndex((x) => x.id === a.id)
    if (i === -1) accounts.value.push(a)
    else accounts.value[i] = a
  }

  function removeAccount(id: string) {
    accounts.value = accounts.value.filter((a) => a.id !== id)
  }

  const accountsUsingKey = (keyId: string) => allAccounts.value.filter((a) => a.keyId === keyId)

  return {
    keys, allKeys, envKey, envKeyError, accounts, mode, timeZone, fileKeyId, defaultFileKeyId,
    credentials, allAccounts, fileStatus, loadAccountsFile, loadEnvKey, upsertKey, removeKey, upsertAccount, removeAccount, accountsUsingKey,
  }
})
