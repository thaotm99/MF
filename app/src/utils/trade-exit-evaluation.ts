import type { Candle } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { atrAt, candlePattern, lastClosedIndex, type CandlePattern } from './price-action-features'
import { PATTERN_LABEL } from './trade-evaluation'
import type { CategoryStat } from './trade-evaluation-features'

/**
 * Phân tích N nến đã đóng ngay trước thời điểm đóng lệnh:
 * giá đang chạy thuận hay đã quay đầu, lệnh đã trả lại bao nhiêu lợi nhuận, nến cuối có đảo chiều không.
 */
export interface ExitEvaluation {
  ok: boolean
  bars: number
  /** Số nến chạy theo chiều lệnh (Buy: nến tăng) / ngược chiều */
  favor: number
  against: number
  /** Giá di chuyển theo chiều lệnh trong N nến, theo ATR (dương = thuận) */
  moveAtr: number
  /** Giá tốt nhất trong N nến so với giá đóng, theo ATR (≥ 0) — phần lợi nhuận đã trả lại */
  givebackAtr: number
  lastPattern?: CandlePattern
  /** Nến ngay trước khi đóng là pin bar / engulfing ngược chiều lệnh */
  reversal: boolean
  momentum: 'with' | 'against' | 'flat'
  summary: string
}

const REVERSAL_FOR_BUY: CandlePattern[] = ['bear-engulfing', 'bear-pin']
const REVERSAL_FOR_SELL: CandlePattern[] = ['bull-engulfing', 'bull-pin']

/** Ngưỡng ATR để coi là "chạy thuận" / "quay đầu" */
const MOMENTUM_ATR = 0.5

export function evaluateExit(p: Mt5Position, c: Candle[], tfSec: number, bars: number): ExitEvaluation {
  const empty = { ok: false, bars, favor: 0, against: 0, moveAtr: 0, givebackAtr: 0, reversal: false, momentum: 'flat' as const }
  const idx = lastClosedIndex(c, Date.parse(p.closeTime) / 1000, tfSec)
  if (idx < Math.max(bars + 1, 15)) return { ...empty, summary: 'Không đủ nến trước thời điểm đóng lệnh' }
  const atr = atrAt(c, idx) || 1e-9
  const dir = p.type === 'buy' ? 1 : -1

  let favor = 0
  let against = 0
  let best = dir > 0 ? -Infinity : Infinity
  for (let i = idx - bars + 1; i <= idx; i++) {
    const d = (c[i].close - c[i].open) * dir
    if (d > 0) favor++
    else if (d < 0) against++
    best = dir > 0 ? Math.max(best, c[i].high) : Math.min(best, c[i].low)
  }
  // Từ giá đóng của nến ngay trước cửa sổ tới giá đóng nến cuối
  const moveAtr = ((c[idx].close - c[idx - bars].close) * dir) / atr
  const givebackAtr = Math.max(0, ((best - p.closePrice) * dir) / atr)
  const lastPattern = candlePattern(c, idx)
  const reversal = (dir > 0 ? REVERSAL_FOR_BUY : REVERSAL_FOR_SELL).includes(lastPattern)
  const momentum = moveAtr >= MOMENTUM_ATR ? 'with' : moveAtr <= -MOMENTUM_ATR ? 'against' : 'flat'

  const parts = [
    momentum === 'with' ? 'giá đang chạy thuận' : momentum === 'against' ? 'giá đã quay đầu' : 'giá đi ngang',
    `${favor}/${bars} nến thuận`,
    `${moveAtr >= 0 ? '+' : ''}${moveAtr.toFixed(1)} ATR`,
    givebackAtr >= 0.1 ? `đã trả lại ${givebackAtr.toFixed(1)} ATR so với giá tốt nhất` : 'đóng gần giá tốt nhất',
    reversal ? `nến cuối: ${PATTERN_LABEL[lastPattern].toLowerCase()} (đảo chiều)` : '',
  ].filter(Boolean)

  return { ok: true, bars, favor, against, moveAtr, givebackAtr, lastPattern, reversal, momentum, summary: parts.join(', ') }
}

// ---------- Gom thống kê ----------

export interface ExitFeature {
  id: string
  title: string
  categoryOf: (e: ExitEvaluation) => string
}

export const EXIT_FEATURES: ExitFeature[] = [
  {
    id: 'momentum', title: 'Đà giá trước khi đóng',
    categoryOf: (e) => (e.momentum === 'with' ? 'Đang chạy thuận (≥ +0.5 ATR)' : e.momentum === 'against' ? 'Đã quay đầu (≤ −0.5 ATR)' : 'Đi ngang'),
  },
  { id: 'favor', title: 'Số nến thuận chiều lệnh', categoryOf: (e) => `${e.favor}/${e.bars} nến thuận` },
  {
    id: 'giveback', title: 'Lợi nhuận đã trả lại',
    categoryOf: (e) =>
      e.givebackAtr < 0.25 ? 'Đóng gần giá tốt nhất (< 0.25 ATR)' : e.givebackAtr < 1 ? 'Trả lại 0.25–1 ATR' : e.givebackAtr < 2 ? 'Trả lại 1–2 ATR' : 'Trả lại ≥ 2 ATR',
  },
  {
    id: 'reversal', title: 'Nến cuối trước khi đóng',
    categoryOf: (e) => (e.reversal ? `Đảo chiều (${PATTERN_LABEL[e.lastPattern!]})` : 'Không có nến đảo chiều'),
  },
]

/** Thống kê thắng/thua theo nhóm của một chỉ số thoát lệnh */
export function groupExits(items: { exit: ExitEvaluation; p: Mt5Position }[], f: ExitFeature): CategoryStat[] {
  const map = new Map<string, CategoryStat>()
  for (const { exit, p } of items) {
    if (!exit.ok) continue
    const label = f.categoryOf(exit)
    const s = map.get(label) ?? { label, count: 0, wins: 0, pnl: 0 }
    s.count++
    if (p.netProfit >= 0) s.wins++
    s.pnl += p.netProfit
    map.set(label, s)
  }
  return [...map.values()].sort((a, b) => b.pnl - a.pnl)
}
