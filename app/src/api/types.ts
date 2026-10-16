// Mô hình deal dùng chung cho thống kê (đặt theo mô hình Deal của Exness Trader API).

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
