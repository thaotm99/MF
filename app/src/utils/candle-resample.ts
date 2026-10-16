import type { Candle } from '../api/mt5-candles-csv-parser'

/**
 * Gộp nến khung nhỏ thành khung lớn (ví dụ M15 → H1 / H4 / D1), mốc theo giờ UTC (= giờ server Exness).
 * Nến khung lớn chưa đóng ở cuối dữ liệu vẫn được tạo, nhưng `lastClosedIndex` sẽ không chọn nó
 * khi thời điểm đánh giá nằm trong nến đó → không nhìn trước tương lai.
 */
const cache = new WeakMap<Candle[], Map<number, Candle[]>>()

export function resampleCandles(c: Candle[], tfSec: number): Candle[] {
  let byTf = cache.get(c)
  if (!byTf) cache.set(c, (byTf = new Map()))
  const hit = byTf.get(tfSec)
  if (hit) return hit

  const out: Candle[] = []
  for (const x of c) {
    const t = Math.floor(x.time / tfSec) * tfSec
    const last = out[out.length - 1]
    if (last && last.time === t) {
      last.high = Math.max(last.high, x.high)
      last.low = Math.min(last.low, x.low)
      last.close = x.close
    } else {
      out.push({ time: t, open: x.open, high: x.high, low: x.low, close: x.close })
    }
  }
  byTf.set(tfSec, out)
  return out
}
