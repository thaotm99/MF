import { closeProfit, dealCost, summarize, type AccountDeal } from './stats'
import { maxLosingStreak } from './trading-extremes-stats'

/** Một dòng trong bảng so sánh tài khoản (đã quy đổi sang tiền tệ hiển thị) */
export interface AccountComparisonRow {
  id: string
  label: string
  login: string
  net: number
  trades: number
  /** % lệnh có lãi (profit ≥ 0, như MT5) */
  winRate: number
  /** Tổng lãi / |tổng lỗ|; null khi không có lệnh lỗ */
  profitFactor: number | null
  avgWin: number
  avgLoss: number
  /** Lợi nhuận ròng trung bình mỗi lệnh */
  expectancy: number
  losingStreak: number
  /** Sụt giảm balance lớn nhất trong kỳ (tiền và % so với đỉnh) */
  maxDrawdown: number
  maxDrawdownPct: number
  equity: number
}

/** Biến động balance của một deal: nạp/rút, lãi/lỗ đóng lệnh, commission, swap, phí */
const balanceDelta = (d: AccountDeal) =>
  d.deal.type === 'balance' ? Number(d.deal.profit?.amount ?? 0) : closeProfit(d.deal) + dealCost(d.deal)

/**
 * Max drawdown trên đường balance (đã thực hiện), giống "Balance Drawdown Maximal" của MT5:
 * đi theo thời gian toàn bộ lịch sử để có balance đúng, chỉ đo sụt giảm trong [from, to).
 * Nạp / rút tiền không phải sụt giảm do giao dịch → dịch đỉnh theo cùng số tiền
 * (đã đối chiếu: khớp 5 142.90 (25.71%) trên báo cáo thật).
 */
export function balanceDrawdown(deals: AccountDeal[], from: number, to: number, openingBalance = 0) {
  const sorted = [...deals].sort((a, b) => Date.parse(a.deal.create_time) - Date.parse(b.deal.create_time))
  let balance = openingBalance
  let peak = -Infinity
  let maxDd = 0
  let maxDdPct = 0
  for (const d of sorted) {
    const t = Date.parse(d.deal.create_time)
    if (t >= to) break
    const delta = balanceDelta(d)
    balance += delta
    if (t < from) continue
    // Đỉnh tính từ balance tại đầu kỳ
    if (peak === -Infinity) peak = balance - delta
    if (d.deal.type === 'balance') {
      peak += delta
      continue
    }
    peak = Math.max(peak, balance)
    const dd = peak - balance
    if (dd > maxDd) {
      maxDd = dd
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0
    }
  }
  return { maxDd, maxDdPct }
}

export function compareAccount(
  meta: { id: string; label: string; login: string; equity: number; openingBalance: number },
  deals: AccountDeal[],
  from: number,
  to: number,
): AccountComparisonRow {
  const s = summarize(deals, from, to)
  const { maxDd, maxDdPct } = balanceDrawdown(deals, from, to, meta.openingBalance)
  const { openingBalance: _ob, ...rowMeta } = meta
  return {
    ...rowMeta,
    net: s.netProfit,
    trades: s.closedOrders,
    winRate: s.closedOrders ? (s.profitable / s.closedOrders) * 100 : 0,
    profitFactor: s.loss < 0 ? s.profit / Math.abs(s.loss) : null,
    avgWin: s.profitable ? s.profit / s.profitable : 0,
    avgLoss: s.unprofitable ? s.loss / s.unprofitable : 0,
    expectancy: s.closedOrders ? s.netProfit / s.closedOrders : 0,
    losingStreak: maxLosingStreak(deals, from, to).count,
    maxDrawdown: maxDd,
    maxDrawdownPct: maxDdPct,
  }
}
