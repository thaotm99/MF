import type { IChartApi, ISeriesApi, LogicalRange, UTCTimestamp } from 'lightweight-charts'
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import { barTime } from '../utils/trade-chart-markers'

/** Đoạn nối vào → ra theo toạ độ pixel trong vùng vẽ của chart */
export interface ConnectorLine { id: string; x1: number; y1: number; x2: number; y2: number; win: boolean; selected: boolean }

/** Tối đa số đường vẽ cùng lúc (khi zoom ra rất xa) */
const MAX_LINES = 400

/**
 * Mũi tên nét đứt từ điểm vào lệnh (nến vào, giá vào) tới điểm thoát (nến ra, giá ra), vẽ bằng SVG phủ lên chart.
 * Toạ độ tính lại khi cuộn / zoom / đổi kích thước / kéo thang giá (gom về 1 lần mỗi khung hình).
 */
export function useTradeConnectorLines(o: {
  chart: () => IChartApi | null
  series: () => ISeriesApi<'Candlestick'> | null
  container: Ref<HTMLElement | null>
  trades: Ref<Mt5Position[]>
  tfSec: Ref<number>
  candleTimes: () => Set<number>
  selectedId: Ref<string | undefined>
  enabled: Ref<boolean>
}) {
  const lines = ref<ConnectorLine[]>([])
  const width = ref(0)
  const height = ref(0)
  let frame = 0

  function compute() {
    frame = 0
    const chart = o.chart()
    const series = o.series()
    if (!chart || !series || !o.enabled.value) {
      lines.value = []
      return
    }
    const size = chart.paneSize()
    width.value = size.width
    height.value = size.height
    const ts = chart.timeScale()
    const times = o.candleTimes()
    const out: ConnectorLine[] = []
    for (const p of o.trades.value) {
      const tIn = barTime(p.openTime, o.tfSec.value)
      const tOut = barTime(p.closeTime, o.tfSec.value)
      if (!times.has(tIn) || !times.has(tOut)) continue
      const x1 = ts.timeToCoordinate(tIn as UTCTimestamp)
      const x2 = ts.timeToCoordinate(tOut as UTCTimestamp)
      const y1 = series.priceToCoordinate(p.openPrice)
      const y2 = series.priceToCoordinate(p.closePrice)
      if (x1 === null || x2 === null || y1 === null || y2 === null) continue
      // Bỏ đường nằm hẳn ngoài vùng nhìn thấy
      if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > size.width) continue
      if (Math.abs(x2 - x1) < 1 && Math.abs(y2 - y1) < 1) continue
      out.push({ id: p.id, x1, y1, x2, y2, win: p.netProfit >= 0, selected: p.id === o.selectedId.value })
      if (out.length >= MAX_LINES) break
    }
    // Lệnh đang chọn vẽ sau cùng (nằm trên)
    lines.value = out.sort((a, b) => Number(a.selected) - Number(b.selected))
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(compute)
  }

  const onRange = (_: LogicalRange | null) => schedule()
  let attachedTo: IChartApi | null = null
  // Kéo thang giá / lăn chuột không có sự kiện riêng của thư viện → nghe trực tiếp trên khung chart
  const onPointer = (e: Event) => {
    if (e.type !== 'pointermove' || (e as PointerEvent).buttons) schedule()
  }

  /** Gọi sau khi tạo chart */
  function attach() {
    const chart = o.chart()
    if (!chart || attachedTo === chart) return
    attachedTo = chart
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)
    chart.timeScale().subscribeSizeChange(schedule)
    for (const ev of ['wheel', 'pointermove', 'pointerup', 'dblclick']) o.container.value?.addEventListener(ev, onPointer, { passive: true })
    schedule()
  }
  function detach() {
    if (attachedTo) {
      try {
        attachedTo.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
        attachedTo.timeScale().unsubscribeSizeChange(schedule)
      } catch {
        // chart đã bị huỷ
      }
    }
    attachedTo = null
    for (const ev of ['wheel', 'pointermove', 'pointerup', 'dblclick']) o.container.value?.removeEventListener(ev, onPointer)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  watch([o.trades, o.tfSec, o.selectedId, o.enabled], schedule)
  onBeforeUnmount(detach)
  return { lines, width, height, attach, detach, redraw: schedule }
}
