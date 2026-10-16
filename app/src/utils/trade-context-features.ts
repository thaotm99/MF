import type { Candle } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { resampleCandles } from './candle-resample'
import { atrAt, lastClosedIndex, swingPoints, trendFromSwings, type Trend } from './price-action-features'

/**
 * Bối cảnh rộng lúc vào lệnh: xu hướng khung lớn (H1/H4 gộp từ nến khung đánh giá), đỉnh/đáy ngày hôm trước,
 * số tròn và phiên giao dịch. Chỉ dùng nến đã đóng trước giờ vào lệnh.
 */
export interface ContextEvaluation {
  h1?: Trend
  h4?: Trend
  /** Vị trí so với đỉnh/đáy ngày hôm trước (PDH / PDL) */
  prevDay?: 'above-pdh' | 'near-pdh' | 'inside' | 'near-pdl' | 'below-pdl'
  /** Khoảng cách tới số tròn gần nhất, theo ATR */
  roundDistAtr?: number
  roundStep?: number
  session: 'asia' | 'london' | 'overlap' | 'newyork' | 'late'
}

/** Bước số tròn theo độ lớn giá: vàng ~4000 → 10; 100–999 → 1; 10–99 → 0.1; cặp tiền ~1.08 → 0.001 (10 pip) */
export function roundStep(price: number): number {
  if (price >= 1000) return 10
  if (price >= 100) return 1
  if (price >= 10) return 0.1
  return 0.001
}

/** Phiên theo giờ server UTC+0: Á 0–7h, Âu 7–12h, Âu–Mỹ chồng nhau 12–16h, Mỹ 16–21h, cuối ngày 21–24h */
export function sessionOf(iso: string): ContextEvaluation['session'] {
  const h = new Date(iso).getUTCHours()
  return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late'
}

/** Xu hướng swing trên khung lớn tại thời điểm `entrySec` (nến khung lớn đã đóng) */
function htfTrend(base: Candle[], tfSec: number, entrySec: number, k: number): Trend | undefined {
  const c = resampleCandles(base, tfSec)
  const idx = lastClosedIndex(c, entrySec, tfSec)
  if (idx < 30) return undefined
  return trendFromSwings(swingPoints(c, k, idx - 120, idx)).trend
}

/** Ngưỡng "gần" đỉnh/đáy ngày trước, theo ATR khung đánh giá */
const NEAR_LEVEL_ATR = 0.5

export function evaluateContext(p: Mt5Position, base: Candle[], tfSec: number, swingStrength: number): ContextEvaluation {
  const entrySec = Date.parse(p.openTime) / 1000
  const entry = p.openPrice
  const idx = lastClosedIndex(base, entrySec, tfSec)
  const atr = idx > 15 ? (atrAt(base, idx) ?? 0) : 0

  // Ngày hôm trước = nến D1 đã đóng cuối cùng
  let prevDay: ContextEvaluation['prevDay']
  const d1 = resampleCandles(base, 86_400)
  const di = lastClosedIndex(d1, entrySec, 86_400)
  if (di >= 0 && atr > 0) {
    const { high: pdh, low: pdl } = d1[di]
    if (entry > pdh) prevDay = 'above-pdh'
    else if (entry < pdl) prevDay = 'below-pdl'
    else if ((pdh - entry) / atr < NEAR_LEVEL_ATR) prevDay = 'near-pdh'
    else if ((entry - pdl) / atr < NEAR_LEVEL_ATR) prevDay = 'near-pdl'
    else prevDay = 'inside'
  }

  const step = roundStep(entry)
  const dist = Math.abs(entry - Math.round(entry / step) * step)

  return {
    h1: htfTrend(base, 3_600, entrySec, swingStrength),
    h4: htfTrend(base, 14_400, entrySec, swingStrength),
    prevDay,
    roundDistAtr: atr > 0 ? dist / atr : undefined,
    roundStep: step,
    session: sessionOf(p.openTime),
  }
}

export const SESSION_LABEL: Record<ContextEvaluation['session'], string> = {
  asia: 'Phiên Á (0–7h)', london: 'Phiên Âu (7–12h)', overlap: 'Âu–Mỹ (12–16h)', newyork: 'Phiên Mỹ (16–21h)', late: 'Cuối ngày (21–24h)',
}

export const PREV_DAY_LABEL: Record<NonNullable<ContextEvaluation['prevDay']>, string> = {
  'above-pdh': 'Trên đỉnh ngày trước', 'near-pdh': 'Sát đỉnh ngày trước', inside: 'Trong range ngày trước',
  'near-pdl': 'Sát đáy ngày trước', 'below-pdl': 'Dưới đáy ngày trước',
}
