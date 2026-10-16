// Kiểu dữ liệu theo OpenAPI "Exness Trader API" 1.0.2 (chỉ các trường dashboard dùng).

/** API key tạo trong Key Management; một key có thể dùng chung cho nhiều tài khoản. */
export interface ApiKeyEntry {
  id: string
  name: string
  apiKey: string
  secretKey: string
  /** Host từ DNS widget trong Key Management, ví dụ https://api.exness.com */
  host: string
  /** Key đọc từ .env: dev server tự ký, secretKey để trống ở trình duyệt */
  serverSigned?: boolean
}

/** Tài khoản giao dịch người dùng thêm vào dashboard. */
export interface AccountEntry {
  id: string
  label: string
  accountId: string
  keyId: string
  /** Gọi GET /v1/trading/access-point để lấy host riêng của tài khoản */
  resolveAccessPoint: boolean
  /** 'file' = đọc từ public/accounts.json (chỉ đọc trên giao diện) */
  source?: 'manual' | 'file'
}

/** Tài khoản đã ghép với key của nó — dạng client API sử dụng. */
export interface AccountCredential {
  /** id nội bộ trong trình duyệt */
  id: string
  label: string
  accountId: string
  apiKey: string
  secretKey: string
  /** Host từ DNS widget trong Key Management, ví dụ https://api.exness.com */
  host: string
  /** Gọi GET /v1/trading/access-point để lấy host riêng của tài khoản */
  resolveAccessPoint: boolean
  /** true = request được ký ở dev server bằng key trong .env */
  serverSigned?: boolean
}

export interface AccountSettings {
  currency: string
  leverage: string
  margin_call_level?: string
  stopout_level?: string
  trade_mode: string
  account_status: string
  execution_mode: string
}

export interface AccountDetailsResponse {
  account_id: string
  account_name?: string
  create_date: string
  settings?: AccountSettings
}

export interface AccountState {
  balance: string
  equity: string
  used_margin: string
}

export interface TradingStateSnapshot {
  orders: unknown[]
  positions: unknown[]
  account_state: AccountState
}

export type DealType =
  | 'open'
  | 'close'
  | 'balance'
  | 'null_compensation'
  | 'swap_fee'
  | 'admin_fee'
  | 'dividend'
  | 'exness_dollar'

export interface Deal {
  deal_id: string
  order_id?: string
  position_id?: string
  type: DealType
  direction?: 'buy' | 'sell'
  instrument?: string
  volume?: string
  price?: string
  profit?: { amount?: string; currency?: string }
  create_time: string
  commission?: string
}

export interface DealHistoryItem {
  event_time: string
  deal: Deal
}

export interface DealsHistoryResponse {
  items: DealHistoryItem[]
  next_cursor?: string
  has_more?: boolean
}

export interface InstrumentConditionResponse {
  instrument: string
  base_currency?: string
  quote_currency?: string
  contract_size?: string
}

export interface RestMethodLimits {
  api_operation_id: string
  http_method: string
  path: string
  rate_limit: { limit: number; window_seconds: number }
  limits?: { history_range_days?: number; history_age_days?: number }
}

export interface LimitsResponse {
  limits: { rest: { global_account_rate: { limit: number; window_seconds: number }; methods: RestMethodLimits[] } }
}

export interface AccessPointResponse {
  access_point: string
  account_id: number | string
}
