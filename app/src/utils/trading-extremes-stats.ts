import { closeProfit, type AccountDeal, type DayStat } from './stats'

/** Một ngày nổi bật trên lịch PnL */
export interface DayExtreme {
  /** YYYY-MM-DD theo múi giờ đã chọn */
  day: string
  pnl: number
  trades: number
}

/**
 * Ngày lãi lớn nhất / lỗ lớn nhất trong khoảng ngày [startKey, endKey] (YYYY-MM-DD, tính cả hai đầu).
 * Chỉ trả về ngày lãi nếu pnl > 0 và ngày lỗ nếu pnl < 0.
 */
export function dayExtremes(
  daily: Map<string, DayStat>,
  startKey: string,
  endKey: string,
): { best?: DayExtreme; worst?: DayExtreme } {
  let best: DayExtreme | undefined
  let worst: DayExtreme | undefined
  for (const [day, s] of daily) {
    if (day < startKey || day > endKey) continue
    if (s.pnl > 0 && (!best || s.pnl > best.pnl)) best = { day, pnl: s.pnl, trades: s.trades }
    if (s.pnl < 0 && (!worst || s.pnl < worst.pnl)) worst = { day, pnl: s.pnl, trades: s.trades }
  }
  return { best, worst }
}

/** Chuỗi lệnh thua liên tiếp dài nhất */
export interface LosingStreak {
  count: number
  /** Tổng lãi/lỗ của các lệnh trong chuỗi (âm) */
  sum: number
  /** ISO thời điểm đóng lệnh đầu / cuối chuỗi */
  from?: string
  to?: string
}

/**
 * Số lệnh thua liên tiếp nhiều nhất trong [from, to), xếp theo giờ đóng lệnh.
 * Lệnh thua = profit < 0 (lệnh hoà vốn ngắt chuỗi) — giống "Maximum consecutive losses" của MT5
 * và cột "Thua lỗ" trên dashboard. Chuỗi dài bằng nhau thì lấy chuỗi lỗ nhiều tiền hơn.
 */
export function maxLosingStreak(deals: AccountDeal[], from: number, to: number): LosingStreak {
  const closes = deals
    .filter((d) => d.deal.type === 'close')
    .map((d) => ({ t: Date.parse(d.deal.create_time), iso: d.deal.create_time, p: closeProfit(d.deal) }))
    .filter((d) => d.t >= from && d.t < to)
    .sort((a, b) => a.t - b.t)

  let best: LosingStreak = { count: 0, sum: 0 }
  let cur: LosingStreak = { count: 0, sum: 0 }
  for (const d of closes) {
    if (d.p < 0) {
      cur = { count: cur.count + 1, sum: cur.sum + d.p, from: cur.count ? cur.from : d.iso, to: d.iso }
      if (cur.count > best.count || (cur.count === best.count && cur.sum < best.sum)) best = cur
    } else {
      cur = { count: 0, sum: 0 }
    }
  }
  return best
}
