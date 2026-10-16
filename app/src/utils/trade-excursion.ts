import type { Candle } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { atrAt, lastClosedIndex } from './price-action-features'

/**
 * MAE / MFE: trong lúc giữ lệnh, giá đi ngược tối đa (Maximum Adverse Excursion) và đi thuận tối đa
 * (Maximum Favorable Excursion) bao nhiêu, theo ATR lúc vào lệnh.
 * Dùng các nến chồng lên khoảng [giờ vào, giờ ra]; nến đầu/cuối có thể gồm một phần trước khi vào / sau khi ra
 * → dùng khung nhỏ (M1) cho chính xác hơn.
 */
export interface Excursion {
  ok: boolean
  maeAtr: number
  mfeAtr: number
  /** Kết quả thực tế theo ATR (dương = lãi theo giá) */
  realizedAtr: number
  /** ATR lúc vào lệnh, theo giá — để đổi ATR ra khoảng giá */
  atr: number
  win: boolean
}

export function evaluateExcursion(p: Mt5Position, c: Candle[], tfSec: number): Excursion {
  const openSec = Date.parse(p.openTime) / 1000
  const closeSec = Date.parse(p.closeTime) / 1000
  const win = p.netProfit >= 0
  const bad = { ok: false, maeAtr: 0, mfeAtr: 0, realizedAtr: 0, atr: 0, win }
  const atrIdx = lastClosedIndex(c, openSec, tfSec)
  const atr = atrIdx > 15 ? atrAt(c, atrIdx) : null
  if (!atr) return bad

  const dir = p.type === 'buy' ? 1 : -1
  let hi = -Infinity
  let lo = Infinity
  for (let i = Math.max(0, atrIdx); i < c.length && c[i].time < closeSec; i++) {
    if (c[i].time + tfSec <= openSec) continue
    hi = Math.max(hi, c[i].high)
    lo = Math.min(lo, c[i].low)
  }
  if (hi === -Infinity) return bad
  // Giá vào / ra luôn nằm trong khoảng đã đi qua
  hi = Math.max(hi, p.openPrice, p.closePrice)
  lo = Math.min(lo, p.openPrice, p.closePrice)
  const favorable = dir > 0 ? hi - p.openPrice : p.openPrice - lo
  const adverse = dir > 0 ? p.openPrice - lo : hi - p.openPrice
  return {
    ok: true,
    maeAtr: Math.max(0, adverse) / atr,
    mfeAtr: Math.max(0, favorable) / atr,
    realizedAtr: ((p.closePrice - p.openPrice) * dir) / atr,
    atr,
    win,
  }
}

/** Phân vị q (0–1) của mảng số */
export function percentile(values: number[], q: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo)
}

export interface ExcursionSummary {
  winners: number
  losers: number
  /** MAE của lệnh thắng: p50 / p75 / p90 — gợi ý mức SL vẫn giữ được phần lớn lệnh thắng */
  winMae: { p50: number; p75: number; p90: number }
  /** Tỷ lệ lệnh thua từng có MFE ≥ ngưỡng — có thể cứu bằng dời SL về hoà vốn / chốt sớm */
  loserMfeShare: { at: number; share: number }[]
  /** Lệnh thắng chốt được bao nhiêu % so với MFE (trung vị) */
  winCapture: number
  /** ATR trung vị theo giá — để đổi ATR sang khoảng giá */
  medianAtr: number
}

export function summarizeExcursions(xs: Excursion[]): ExcursionSummary {
  const ok = xs.filter((x) => x.ok)
  const w = ok.filter((x) => x.win)
  const l = ok.filter((x) => !x.win)
  const winMaes = w.map((x) => x.maeAtr)
  return {
    winners: w.length,
    losers: l.length,
    winMae: { p50: percentile(winMaes, 0.5), p75: percentile(winMaes, 0.75), p90: percentile(winMaes, 0.9) },
    loserMfeShare: [0.5, 1, 1.5].map((at) => ({ at, share: l.length ? l.filter((x) => x.mfeAtr >= at).length / l.length : 0 })),
    winCapture: percentile(w.filter((x) => x.mfeAtr > 0).map((x) => Math.max(0, x.realizedAtr) / x.mfeAtr), 0.5),
    medianAtr: percentile(ok.map((x) => x.atr), 0.5),
  }
}
