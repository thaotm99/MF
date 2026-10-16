<script setup lang="ts">
import {
  createChart, CrosshairMode,
  type IChartApi, type IPriceLine, type ISeriesApi, type MouseEventParams, type UTCTimestamp,
} from 'lightweight-charts'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import { TIMEFRAME_SECONDS, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'
import { useCandlesStore } from '../stores/candles'
import { money } from '../utils/format'
import { barTime, buildTradeMarkers, positionsAtBar, resultColor, symbolMatches } from '../utils/trade-chart-markers'
import TradeChartTradeList from './TradeChartTradeList.vue'

/**
 * Chart nến (file CSV trong app/candles/) + điểm vào/ra của các vị thế đóng trong kỳ đã chọn.
 * Thời gian trên chart là giờ server MT5 (UTC+0), cùng hệ với báo cáo.
 */
const props = defineProps<{
  /** Vị thế đóng trong kỳ, netProfit đã quy đổi sang tiền tệ hiển thị */
  positions: Mt5Position[]
  currency: string
  /** Kỳ đã chọn, ms */
  from: number
  to: number
}>()

const candles = useCandlesStore()
const TIMEFRAMES: CandleTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

// ----- Chọn mã & khung -----
const symbols = computed(() => [...new Set(candles.files.map((f) => f.symbol))].sort())
const symbol = ref('')
const timeframe = ref<CandleTimeframe>('M5')
const timeframes = computed(() =>
  TIMEFRAMES.filter((tf) => candles.files.some((f) => f.symbol === symbol.value && f.timeframe === tf)),
)
const file = computed(() => candles.files.find((f) => f.symbol === symbol.value && f.timeframe === timeframe.value))

/** Mặc định: mã có nhiều lệnh nhất trong kỳ; khung M5 nếu có */
watch(
  symbols,
  (list) => {
    if (list.includes(symbol.value)) return
    const count = (s: string) => props.positions.filter((p) => symbolMatches(p.symbol, s)).length
    symbol.value = [...list].sort((a, b) => count(b) - count(a))[0] ?? ''
  },
  { immediate: true },
)
watch(timeframes, (list) => {
  if (!list.includes(timeframe.value)) timeframe.value = list.includes('M5') ? 'M5' : (list[0] ?? 'M5')
}, { immediate: true })

/** Lọc theo chiều lệnh: tất cả / chỉ Buy / chỉ Sell (áp dụng cho marker và danh sách) */
type SideFilter = 'all' | 'buy' | 'sell'
const SIDES: { id: SideFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
]
const side = ref<SideFilter>('all')

const trades = computed(() =>
  props.positions
    .filter((p) => symbolMatches(p.symbol, symbol.value) && (side.value === 'all' || p.type === side.value))
    .sort((a, b) => b.openTime.localeCompare(a.openTime)),
)
const tfSec = computed(() => TIMEFRAME_SECONDS[timeframe.value])

// ----- Chart (đối tượng thư viện, không đưa vào reactive) -----
const el = ref<HTMLElement | null>(null)
let chart: IChartApi | null = null
let series: ISeriesApi<'Candlestick'> | null = null
let priceLines: IPriceLine[] = []
let candleTimes = new Set<number>()
const data = ref<Candle[]>([])
const loadError = ref('')
const loadingData = ref(false)
const selectedId = ref<string | undefined>()

onMounted(() => {
  if (!el.value) return
  chart = createChart(el.value, {
    autoSize: true,
    layout: { background: { color: '#ffffff' }, textColor: '#6b7378', fontSize: 11, fontFamily: 'Inter, -apple-system, Segoe UI, Roboto, sans-serif' },
    grid: { vertLines: { color: '#f1f2f4' }, horzLines: { color: '#f1f2f4' } },
    rightPriceScale: { borderColor: '#e3e5e8' },
    timeScale: { borderColor: '#e3e5e8', timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { locale: 'vi-VN' },
  })
  // Nến xanh / đỏ nhạt (bán trong suốt) để marker lãi/lỗ màu đậm vẫn nổi bật trên nến
  series = chart.addCandlestickSeries({
    upColor: 'rgba(34, 160, 107, 0.45)', downColor: 'rgba(201, 55, 44, 0.45)', borderVisible: false,
    wickUpColor: 'rgba(34, 160, 107, 0.6)', wickDownColor: 'rgba(201, 55, 44, 0.6)',
  })
  chart.subscribeCrosshairMove(onCrosshair)
  if (candles.state === 'idle') candles.list()
  void render()
})
onBeforeUnmount(() => {
  chart?.unsubscribeCrosshairMove(onCrosshair)
  chart?.remove()
  chart = null
})

async function render() {
  if (!series || !file.value) {
    data.value = []
    series?.setData([])
    return
  }
  loadingData.value = true
  loadError.value = ''
  try {
    data.value = await candles.load(file.value.name)
  } catch (e) {
    data.value = []
    loadError.value = e instanceof Error ? e.message : String(e)
  }
  loadingData.value = false
  if (!series) return
  series.setData(data.value.map((c) => ({ ...c, time: c.time as UTCTimestamp })))
  candleTimes = new Set(data.value.map((c) => c.time))
  drawMarkers()
  fitToRange()
}

function drawMarkers() {
  series?.setMarkers(buildTradeMarkers(trades.value, tfSec.value, candleTimes, selectedId.value))
}

/** Hiển thị đúng kỳ đã chọn (giao với vùng có nến) */
function fitToRange() {
  if (!chart || !data.value.length) return
  const first = data.value[0].time
  const last = data.value[data.value.length - 1].time
  const from = Math.max(first, Math.floor(props.from / 1000))
  const to = Math.min(last, Math.floor(props.to / 1000))
  if (from < to) chart.timeScale().setVisibleRange({ from: from as UTCTimestamp, to: to as UTCTimestamp })
  else chart.timeScale().fitContent()
}

/** Bấm một lệnh trong danh sách: zoom tới lệnh, kẻ đường giá vào/ra */
function focusTrade(p: Mt5Position) {
  selectedId.value = p.id
  drawMarkers()
  if (!chart || !series) return
  for (const l of priceLines) series.removePriceLine(l)
  priceLines = [
    series.createPriceLine({ price: p.openPrice, color: resultColor(p), lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Vào ${p.type === 'buy' ? 'Buy' : 'Sell'}` }),
    series.createPriceLine({ price: p.closePrice, color: resultColor(p), lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: 'Ra' }),
  ]
  const pad = tfSec.value * 40
  chart.timeScale().setVisibleRange({
    from: (barTime(p.openTime, tfSec.value) - pad) as UTCTimestamp,
    to: (barTime(p.closeTime, tfSec.value) + pad) as UTCTimestamp,
  })
}

// ----- Tooltip khi rê chuột -----
const tip = ref<{ x: number; y: number; rows: { key: string; text: string; color: string; value: string; win: boolean }[] } | null>(null)
function onCrosshair(param: MouseEventParams) {
  if (!param.time || !param.point) return (tip.value = null)
  const events = positionsAtBar(trades.value, param.time as number, tfSec.value)
  if (!events.length) return (tip.value = null)
  tip.value = {
    x: param.point.x,
    y: param.point.y,
    rows: events.slice(0, 6).map(({ p, kind }) => ({
      key: kind + p.id,
      color: resultColor(p),
      text: kind === 'in'
        ? `Vào ${p.type === 'buy' ? 'Buy' : 'Sell'} ${p.volume} lot @ ${p.openPrice}`
        : `Ra @ ${p.closePrice}`,
      value: `${money(p.netProfit, { sign: true })} ${props.currency}`,
      win: p.netProfit >= 0,
    })),
  }
}

watch(file, () => {
  selectedId.value = undefined
  void render()
})
// Lệnh đang chọn bị lọc mất (đổi Buy/Sell, đổi kỳ) → bỏ chọn và xoá đường giá vào/ra
watch(trades, (list) => {
  if (selectedId.value && !list.some((p) => p.id === selectedId.value)) {
    selectedId.value = undefined
    for (const l of priceLines) series?.removePriceLine(l)
    priceLines = []
  }
  drawMarkers()
})
watch(() => [props.from, props.to], fitToRange)
</script>

<template>
  <div class="wrap">
    <div class="toolbar">
      <label>Mã
        <select v-model="symbol" class="select small" :disabled="!symbols.length">
          <option v-for="s in symbols" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <div class="seg" role="radiogroup" aria-label="Khung thời gian">
        <button v-for="tf in timeframes" :key="tf" type="button" role="radio" :aria-checked="tf === timeframe"
          :class="{ on: tf === timeframe }" @click="timeframe = tf">{{ tf }}</button>
      </div>
      <div class="seg" role="radiogroup" aria-label="Chiều lệnh">
        <button v-for="o in SIDES" :key="o.id" type="button" role="radio" :aria-checked="side === o.id"
          :class="{ on: side === o.id }" @click="side = o.id">{{ o.label }}</button>
      </div>
      <button class="btn small" type="button" @click="candles.list()">Tải lại nến</button>
      <span class="legend">
        <span class="key"><i class="arrow" />Vào lệnh (▲ Buy · ▼ Sell)</span>
        <span class="key"><i class="dot" />Ra lệnh</span>
        <span class="key"><i class="sw win" />Lãi</span>
        <span class="key"><i class="sw loss" />Lỗ</span>
      </span>
    </div>

    <p v-if="candles.state === 'unavailable'" class="alert">Chỉ đọc được file nến khi chạy <code>npm run dev</code>.</p>
    <p v-else-if="candles.state === 'ok' && !candles.files.length" class="alert">
      Chưa có file nến trong <code>app/candles/</code>. Chạy script <code>app/mql5/ExportCandlesCsv.mq5</code> trong MT5
      (hoặc View → Symbols → Bars → Export) rồi copy file CSV vào thư mục này và bấm "Tải lại nến".
    </p>
    <p v-if="loadError" class="alert error">Không đọc được {{ file?.name }}: {{ loadError }}</p>

    <div class="chart-box" :class="{ dim: loadingData }">
      <div ref="el" class="chart" role="img" :aria-label="`Chart nến ${symbol} ${timeframe} với điểm vào/ra lệnh`" />
      <div v-if="tip" class="tip" :style="{ left: `${Math.min(tip.x + 14, (el?.clientWidth ?? 600) - 230)}px`, top: `${Math.max(tip.y - 10, 4)}px` }">
        <div v-for="r in tip.rows" :key="r.key" class="tip-row">
          <span class="line-key" :style="{ background: r.color }" />
          <span>{{ r.text }}</span>
          <b :class="r.win ? 'val-pos' : 'val-neg'">{{ r.value }}</b>
        </div>
      </div>
    </div>
    <p class="foot">Giờ server MT5 (UTC+0). Lăn chuột để zoom, kéo để di chuyển. Bấm một lệnh bên dưới để xem chi tiết.</p>

    <TradeChartTradeList :trades="trades" :currency="currency" :selected-id="selectedId" @select="focusTrade" />
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; font-size: 13px; }
.toolbar label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.select.small { min-height: 32px; padding: 4px 8px; }
.btn.small { padding: 5px 10px; font-size: 12px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); padding: 6px 12px; color: var(--muted); font-size: 12px; font-weight: 500; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.on { background: var(--accent); color: #fff; }
.legend { display: flex; gap: 12px; margin-left: auto; color: var(--muted); font-size: 12px; flex-wrap: wrap; }
.key { display: inline-flex; align-items: center; gap: 5px; }
.arrow { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid var(--muted); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--muted); }
.sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.sw.win { background: var(--chart-pos); }
.sw.loss { background: var(--chart-neg); }
.chart-box { position: relative; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; transition: opacity .2s; }
.chart-box.dim { opacity: .55; }
.chart { height: 440px; width: 100%; }
.tip {
  position: absolute; z-index: 3; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
  border-radius: 6px; padding: 6px 9px; box-shadow: 0 4px 14px rgba(20, 29, 34, .12); font-size: 12px; max-width: 260px;
}
.tip-row { display: flex; align-items: center; gap: 6px; color: var(--muted); white-space: nowrap; }
.tip-row b { color: var(--text); margin-left: auto; padding-left: 8px; }
.tip-row b.val-pos { color: var(--pos); }
.tip-row b.val-neg { color: var(--neg); }
.line-key { width: 10px; height: 2px; border-radius: 1px; flex: none; }
.foot { color: var(--faint); font-size: 11px; margin: 6px 0 14px; text-align: center; }
@media (max-width: 640px) { .chart { height: 320px; } .legend { margin-left: 0; } }
</style>
