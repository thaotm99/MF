import type { Candle } from '../api/mt5-candles-csv-parser'

/**
 * Chỉ báo price action tính trên nến (mảng tăng dần theo thời gian).
 * Mọi hàm nhận `idx` = nến ĐÃ ĐÓNG cuối cùng trước thời điểm vào lệnh và chỉ đọc nến ≤ idx
 * (swing cần k nến bên phải để xác nhận nên cũng chỉ dùng swing có i + k ≤ idx) → không nhìn trước tương lai.
 */

/** ATR(period) kiểu trung bình đơn giản của True Range, tại idx */
export function atrAt(c: Candle[], idx: number, period = 14): number | null {
  if (idx < period) return null
  let sum = 0
  for (let i = idx - period + 1; i <= idx; i++) {
    const prevClose = c[i - 1].close
    sum += Math.max(c[i].high - c[i].low, Math.abs(c[i].high - prevClose), Math.abs(c[i].low - prevClose))
  }
  return sum / period
}

/** EMA(period) của giá đóng cửa, trả về mảng cùng độ dài (NaN trước khi đủ dữ liệu) */
export function emaSeries(c: Candle[], period = 20): number[] {
  const out = new Array<number>(c.length).fill(NaN)
  if (c.length < period) return out
  const k = 2 / (period + 1)
  let ema = c.slice(0, period).reduce((s, x) => s + x.close, 0) / period
  out[period - 1] = ema
  for (let i = period; i < c.length; i++) {
    ema = c[i].close * k + ema * (1 - k)
    out[i] = ema
  }
  return out
}

export interface SwingPoint {
  index: number
  time: number
  price: number
  kind: 'high' | 'low'
}

/**
 * Đỉnh / đáy swing kiểu fractal với độ mạnh k: high[i] cao hơn k nến mỗi bên (low tương tự).
 * Chỉ trả về swing đã xác nhận trước `upTo` (i + k ≤ upTo).
 */
export function swingPoints(c: Candle[], k: number, from: number, upTo: number): SwingPoint[] {
  const out: SwingPoint[] = []
  for (let i = Math.max(k, from); i + k <= upTo; i++) {
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= k && (isHigh || isLow); j++) {
      if (c[i].high <= c[i - j].high || c[i].high < c[i + j].high) isHigh = false
      if (c[i].low >= c[i - j].low || c[i].low > c[i + j].low) isLow = false
    }
    if (isHigh) out.push({ index: i, time: c[i].time, price: c[i].high, kind: 'high' })
    if (isLow) out.push({ index: i, time: c[i].time, price: c[i].low, kind: 'low' })
  }
  return out
}

export type Trend = 'up' | 'down' | 'range'

/** HH + HL = tăng, LH + LL = giảm, còn lại = sideway (cần ít nhất 2 đỉnh và 2 đáy) */
export function trendFromSwings(swings: SwingPoint[]): { trend: Trend; lastHigh?: SwingPoint; lastLow?: SwingPoint } {
  const highs = swings.filter((s) => s.kind === 'high')
  const lows = swings.filter((s) => s.kind === 'low')
  const lastHigh = highs[highs.length - 1]
  const lastLow = lows[lows.length - 1]
  if (highs.length < 2 || lows.length < 2) return { trend: 'range', lastHigh, lastLow }
  const hh = lastHigh.price > highs[highs.length - 2].price
  const hl = lastLow.price > lows[lows.length - 2].price
  const lh = lastHigh.price < highs[highs.length - 2].price
  const ll = lastLow.price < lows[lows.length - 2].price
  return { trend: hh && hl ? 'up' : lh && ll ? 'down' : 'range', lastHigh, lastLow }
}

/** Nhãn HH / LH / HL / LL cho từng swing so với swing cùng loại trước đó (dùng để vẽ lên chart) */
export function labelSwings(swings: SwingPoint[]): (SwingPoint & { label: string })[] {
  let prevHigh: number | undefined
  let prevLow: number | undefined
  return swings.map((s) => {
    let label: string
    if (s.kind === 'high') {
      label = prevHigh === undefined ? 'H' : s.price > prevHigh ? 'HH' : 'LH'
      prevHigh = s.price
    } else {
      label = prevLow === undefined ? 'L' : s.price > prevLow ? 'HL' : 'LL'
      prevLow = s.price
    }
    return { ...s, label }
  })
}

export type CandlePattern =
  | 'bull-engulfing' | 'bear-engulfing' | 'bull-pin' | 'bear-pin' | 'doji' | 'inside' | 'bull' | 'bear'

/** Mẫu nến của nến idx (so với nến trước nó) */
export function candlePattern(c: Candle[], idx: number): CandlePattern {
  const x = c[idx]
  const p = c[idx - 1]
  const range = x.high - x.low || 1e-9
  const body = Math.abs(x.close - x.open)
  const upper = x.high - Math.max(x.open, x.close)
  const lower = Math.min(x.open, x.close) - x.low
  const pBody = Math.abs(p.close - p.open)
  if (x.close > x.open && p.close < p.open && x.close >= p.open && x.open <= p.close && body > pBody) return 'bull-engulfing'
  if (x.close < x.open && p.close > p.open && x.close <= p.open && x.open >= p.close && body > pBody) return 'bear-engulfing'
  if (lower >= 2 * body && lower >= 0.6 * range) return 'bull-pin'
  if (upper >= 2 * body && upper >= 0.6 * range) return 'bear-pin'
  if (body <= 0.1 * range) return 'doji'
  if (x.high < p.high && x.low > p.low) return 'inside'
  return x.close >= x.open ? 'bull' : 'bear'
}

/** Nến đóng cửa cuối cùng trước thời điểm `entrySec` (nến idx đóng lúc time + tfSec) — tìm nhị phân */
export function lastClosedIndex(c: Candle[], entrySec: number, tfSec: number): number {
  let lo = 0
  let hi = c.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (c[mid].time + tfSec <= entrySec) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}
