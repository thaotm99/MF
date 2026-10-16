import type { Deal } from '../api/types'
import type { TimeZoneMode } from '../stores/settings'

/** Deal đã gắn thêm thông tin tài khoản để tổng hợp nhiều tài khoản. */
export interface AccountDeal {
  accountKey: string
  accountId: string
  currency: string
  deal: Deal
  /** Giá trị danh nghĩa (notional) theo tiền tệ tài khoản, null nếu không quy đổi được */
  notional: number | null
}

const num = (s: string | undefined) => (s ? Number(s) : 0)

export const isTradeDeal = (d: Deal) => d.type === 'open' || d.type === 'close'

/** Chi phí giao dịch của một deal (âm = tốn phí): commission + swap/admin fee. */
export function dealCost(d: Deal): number {
  if (isTradeDeal(d)) return -Math.abs(num(d.commission))
  if (d.type === 'swap_fee' || d.type === 'admin_fee') return num(d.profit?.amount)
  return 0
}

/** Lãi/lỗ đóng lệnh (chưa trừ phí). */
export const closeProfit = (d: Deal) => (d.type === 'close' ? num(d.profit?.amount) : 0)

/**
 * Quy giá trị theo `ccy` sang tiền tệ tài khoản; tài khoản cent (USC) = USD × 100.
 * Trả về null nếu không quy đổi được.
 */
function inAccountCurrency(amount: number, ccy: string | undefined, currency: string): number | null {
  if (ccy === currency) return amount
  if (currency === 'USC' && ccy === 'USD') return amount * 100
  return null
}

/**
 * Notional = volume (lot) × contract_size × giá, quy về tiền tệ tài khoản.
 * Chỉ tính được khi tiền tệ tài khoản (hoặc USD với tài khoản cent) là quote hoặc base của mã.
 */
export function notionalFrom(
  d: Deal,
  contract: { size: number; base?: string; quote?: string } | null,
  currency: string,
): number | null {
  if (!isTradeDeal(d) || !contract?.size) return null
  const units = num(d.volume) * contract.size
  return inAccountCurrency(units * num(d.price), contract.quote, currency) ?? inAccountCurrency(units, contract.base, currency)
}


export interface Summary {
  netProfit: number
  profit: number
  loss: number
  tradingCost: number
  closedOrders: number
  profitable: number
  unprofitable: number
  volume: number
  volumeLots: number
  /** Số deal không quy đổi được notional */
  volumeUnconverted: number
}

export function summarize(deals: AccountDeal[], from: number, to: number): Summary {
  const s: Summary = {
    netProfit: 0,
    profit: 0,
    loss: 0,
    tradingCost: 0,
    closedOrders: 0,
    profitable: 0,
    unprofitable: 0,
    volume: 0,
    volumeLots: 0,
    volumeUnconverted: 0,
  }
  for (const { deal, notional } of deals) {
    const t = Date.parse(deal.create_time)
    if (t < from || t >= to) continue
    s.tradingCost += dealCost(deal)
    if (deal.type === 'close') {
      const p = closeProfit(deal)
      s.closedOrders++
      // Như "Profit Trades" của MT5: lệnh hoà vốn (profit = 0) tính là lệnh có lãi
      if (p >= 0) {
        s.profit += p
        s.profitable++
      } else {
        s.loss += p
        s.unprofitable++
      }
    }
    if (isTradeDeal(deal)) {
      s.volumeLots += num(deal.volume)
      if (notional === null) s.volumeUnconverted++
      else s.volume += notional
    }
  }
  s.netProfit = s.profit + s.loss + s.tradingCost
  return s
}

/** Khoá ngày YYYY-MM-DD theo múi giờ đã chọn. */
export function dayKey(t: number | Date, tz: TimeZoneMode): string {
  const d = new Date(t)
  const y = tz === 'utc' ? d.getUTCFullYear() : d.getFullYear()
  const m = (tz === 'utc' ? d.getUTCMonth() : d.getMonth()) + 1
  const day = tz === 'utc' ? d.getUTCDate() : d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Thời điểm bắt đầu ngày (y, m 0-based, d) theo múi giờ đã chọn. */
export function startOfDay(y: number, m: number, d: number, tz: TimeZoneMode): number {
  return tz === 'utc' ? Date.UTC(y, m, d) : new Date(y, m, d).getTime()
}

export interface DayStat {
  pnl: number
  trades: number
}

/** PnL ròng theo ngày (lãi/lỗ đóng lệnh + phí) và số lệnh đóng. */
export function dailyPnl(deals: AccountDeal[], tz: TimeZoneMode): Map<string, DayStat> {
  const map = new Map<string, DayStat>()
  for (const { deal } of deals) {
    const delta = closeProfit(deal) + dealCost(deal)
    const isClose = deal.type === 'close'
    if (!delta && !isClose) continue
    const k = dayKey(Date.parse(deal.create_time), tz)
    const cur = map.get(k) ?? { pnl: 0, trades: 0 }
    cur.pnl += delta
    if (isClose) cur.trades++
    map.set(k, cur)
  }
  return map
}
