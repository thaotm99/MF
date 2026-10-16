import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts'
import type { Mt5Position } from '../api/mt5-report-parser'

/** Màu marker — đã kiểm tra mù màu (blue / green / red, deutan ΔE ≥ 8.5) */
export const MARKER_COLORS = { entry: '#1f7bff', win: '#22a06b', loss: '#c9372c' }

/** ISO → giây UTC, làm tròn xuống đầu nến của khung `tfSec` */
export const barTime = (iso: string, tfSec: number) => Math.floor(Date.parse(iso) / 1000 / tfSec) * tfSec

/** Bỏ hậu tố loại tài khoản của Exness để so khớp mã: XAUUSDc → XAUUSD */
export const baseSymbol = (s: string) => s.replace(/[a-z.#_]+$/, '').toUpperCase()

export const symbolMatches = (positionSymbol: string, candleSymbol: string) =>
  positionSymbol === candleSymbol || baseSymbol(positionSymbol) === baseSymbol(candleSymbol)

/**
 * Marker cho từng vị thế:
 * - Vào lệnh: mũi tên xanh dương — Buy hướng lên dưới nến, Sell hướng xuống trên nến
 * - Ra lệnh: chấm tròn xanh lá (lãi) / đỏ (lỗ)
 * Chỉ giữ marker rơi vào nến có trong dữ liệu (lightweight-charts yêu cầu khớp thời gian nến).
 */
export function buildTradeMarkers(
  positions: Mt5Position[],
  tfSec: number,
  candleTimes: Set<number>,
  selectedId?: string,
): SeriesMarker<UTCTimestamp>[] {
  const markers: SeriesMarker<UTCTimestamp>[] = []
  for (const p of positions) {
    const selected = p.id === selectedId
    const tIn = barTime(p.openTime, tfSec)
    const tOut = barTime(p.closeTime, tfSec)
    if (candleTimes.has(tIn)) {
      markers.push({
        time: tIn as UTCTimestamp,
        position: p.type === 'buy' ? 'belowBar' : 'aboveBar',
        shape: p.type === 'buy' ? 'arrowUp' : 'arrowDown',
        color: MARKER_COLORS.entry,
        size: selected ? 2 : 1,
        id: `in:${p.id}`,
      })
    }
    if (candleTimes.has(tOut)) {
      markers.push({
        time: tOut as UTCTimestamp,
        position: p.type === 'buy' ? 'aboveBar' : 'belowBar',
        shape: 'circle',
        color: p.netProfit >= 0 ? MARKER_COLORS.win : MARKER_COLORS.loss,
        size: selected ? 2 : 1,
        id: `out:${p.id}`,
      })
    }
  }
  return markers.sort((a, b) => (a.time as number) - (b.time as number))
}

/** Các vị thế có điểm vào hoặc ra nằm ở nến `t` — dùng cho tooltip khi rê chuột */
export function positionsAtBar(positions: Mt5Position[], t: number, tfSec: number) {
  return positions.flatMap((p) => {
    const events: { p: Mt5Position; kind: 'in' | 'out' }[] = []
    if (barTime(p.openTime, tfSec) === t) events.push({ p, kind: 'in' })
    if (barTime(p.closeTime, tfSec) === t) events.push({ p, kind: 'out' })
    return events
  })
}
