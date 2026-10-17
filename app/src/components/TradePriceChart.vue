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
import { labelSwings, lastClosedIndex, swingPoints } from '../utils/price-action-features'
import { barTime, buildTradeMarkers, positionsAtBar, resultColor, symbolMatches } from '../utils/trade-chart-markers'
import TradeChartTradeList from './TradeChartTradeList.vue'
import TradeJournalEditor from './TradeJournalEditor.vue'
import AutoTagLegend from './AutoTagLegend.vue'
import TradeTagFilterSelect from './TradeTagFilterSelect.vue'
import AiTradeAnalysis from './AiTradeAnalysis.vue'
import { useReportsStore } from '../stores/reports'
import { buildAiTradeContext } from '../utils/ai-trade-context'
import { useTradeAutoTags } from '../composables/use-trade-auto-tags'
import { useTradeJournalStore } from '../stores/trade-journal'
import { matchesTagFilter } from '../utils/trade-journal-stats'

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
  /** Mở chart và zoom ngay tới lệnh này (từ tab Đánh giá lệnh) */
  focusId?: string
  focusTimeframe?: CandleTimeframe
}>()

/** Lệnh cần zoom tới sau khi nến tải xong */
const pendingFocus = ref<Mt5Position | undefined>(props.positions.find((p) => p.id === props.focusId))

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
    const focus = pendingFocus.value
    if (focus) {
      const match = list.find((s) => symbolMatches(focus.symbol, s))
      if (match) return void (symbol.value = match)
    }
    if (list.includes(symbol.value)) return
    const count = (s: string) => props.positions.filter((p) => symbolMatches(p.symbol, s)).length
    symbol.value = [...list].sort((a, b) => count(b) - count(a))[0] ?? ''
  },
  { immediate: true },
)
watch(timeframes, (list) => {
  const wanted = pendingFocus.value && props.focusTimeframe
  if (wanted && list.includes(wanted)) return void (timeframe.value = wanted)
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

/** Lọc theo kết quả: tất cả / chỉ lệnh thắng (lãi ≥ 0) / chỉ lệnh thua */
type ResultFilter = 'all' | 'win' | 'loss'
const RESULTS: { id: ResultFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'win', label: 'Thắng' },
  { id: 'loss', label: 'Thua' },
]
const result = ref<ResultFilter>('all')

/** Nhãn tự động (khung M15 / M5 mặc định) + nhãn của bạn; lọc theo nhãn */
const journal = useTradeJournalStore()
const allPositions = computed(() => props.positions)
const { tags: autoTags, details: autoDetails, used: autoTfs } = useTradeAutoTags(allPositions)
const tagFilter = ref('')
const autoTfText = computed(() => autoTfs.value.find((u) => u.symbol === symbol.value))

/** Phân tích AI: tên tài khoản chứa lệnh (MF_xx → file bot) + bối cảnh lệnh soạn khi bấm */
const reports = useReportsStore()
const selectedAccount = computed(() => (selected.value ? reports.accounts.find((a) => a.positions.some((p) => p.id === selected.value!.id)) : undefined))
function aiContext(): string {
  const p = selected.value!
  const d = autoDetails.value.get(p.id)
  return buildAiTradeContext({
    p, accountLabel: selectedAccount.value?.label ?? '', currency: props.currency,
    ev: d?.ev, exit: d?.exit, exc: d?.exc, entryTf: d?.entryTf, exitTf: d?.exitTf,
    autoTags: autoTags.value.get(p.id), journal: journal.entries[p.id],
    candles: data.value, timeframe: timeframe.value, tfSec: tfSec.value,
  })
}

const trades = computed(() =>
  props.positions
    .filter((p) => symbolMatches(p.symbol, symbol.value) && (side.value === 'all' || p.type === side.value))
    .filter((p) => result.value === 'all' || (result.value === 'win') === p.netProfit >= 0)
    .filter((p) => matchesTagFilter(tagFilter.value, journal.entries[p.id]?.tags ?? [], autoTags.value.get(p.id) ?? []))
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
const selected = computed(() => trades.value.find((p) => p.id === selectedId.value))

onMounted(() => {
  void journal.ensureLoaded()
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
  setCandles()
  candleTimes = new Set(data.value.map((c) => c.time))
  const focus = pendingFocus.value
  pendingFocus.value = undefined
  if (focus) {
    side.value = 'all'
    focusTrade(focus)
  } else {
    drawMarkers()
    fitToRange()
  }
}

/** Hiện điểm swing HH / HL / LH / LL (fractal 3 nến mỗi bên) để nhìn cấu trúc thị trường */
const showSwings = ref(false)
const swingMarkers = computed(() => {
  const c = data.value
  if (!showSwings.value || c.length < 10) return []
  return labelSwings(swingPoints(c, 3, 0, c.length - 1)).map((s) => ({
    time: s.time as UTCTimestamp,
    position: (s.kind === 'high' ? 'aboveBar' : 'belowBar') as 'aboveBar' | 'belowBar',
    shape: 'circle' as const,
    color: '#8a939b',
    size: 0.4,
    text: s.label,
  }))
})

function drawMarkers() {
  const markers = [...buildTradeMarkers(trades.value, tfSec.value, candleTimes, selectedId.value), ...swingMarkers.value]
  series?.setMarkers(markers.sort((a, b) => (a.time as number) - (b.time as number)))
}
watch(swingMarkers, drawMarkers)

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
/** Số nến trước khi đóng lệnh được tô đậm khi zoom tới lệnh (khớp phần "Trước khi đóng" ở trang Đánh giá lệnh) */
const EXIT_WINDOW_BARS = 5
const SOLID = { up: '#22a06b', down: '#c9372c' }

/** Đổ nến lên chart; nếu đang chọn lệnh thì tô đậm EXIT_WINDOW_BARS nến đã đóng ngay trước giờ đóng lệnh */
function setCandles(p?: Mt5Position) {
  if (!series) return
  let from = -1
  let to = -1
  if (p) {
    to = lastClosedIndex(data.value, Date.parse(p.closeTime) / 1000, tfSec.value)
    from = to - EXIT_WINDOW_BARS + 1
  }
  series.setData(data.value.map((c, i) => {
    const bar = { ...c, time: c.time as UTCTimestamp }
    if (i < from || i > to) return bar
    const color = c.close >= c.open ? SOLID.up : SOLID.down
    return { ...bar, color, wickColor: color }
  }))
}

function focusTrade(p: Mt5Position) {
  selectedId.value = p.id
  drawMarkers()
  if (!chart || !series) return
  setCandles(p)
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
// Lệnh đang chọn bị lọc mất (đổi Buy/Sell, Thắng/Thua, nhãn, đổi kỳ) → bỏ chọn và xoá đường giá vào/ra
watch(trades, (list) => {
  if (selectedId.value && !list.some((p) => p.id === selectedId.value)) {
    selectedId.value = undefined
    for (const l of priceLines) series?.removePriceLine(l)
    priceLines = []
    setCandles()
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
      <div class="seg" role="radiogroup" aria-label="Kết quả lệnh">
        <button v-for="o in RESULTS" :key="o.id" type="button" role="radio" :aria-checked="result === o.id"
          :class="{ on: result === o.id }" @click="result = o.id">{{ o.label }}</button>
      </div>
      <TradeTagFilterSelect v-model="tagFilter" />
      <label class="check"><input v-model="showSwings" type="checkbox" /> Cấu trúc (HH/HL/LH/LL)</label>
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

    <section v-if="selected" class="card note-box">
      <h3>Nhãn &amp; ghi chú · {{ selected.type === 'buy' ? 'Buy' : 'Sell' }} {{ selected.openTime.slice(8, 10) }}/{{ selected.openTime.slice(5, 7) }} {{ selected.openTime.slice(11, 16) }}
        <b :class="selected.netProfit >= 0 ? 'pos' : 'neg'">{{ money(selected.netProfit, { sign: true }) }} {{ currency }}</b></h3>
      <TradeJournalEditor :position="selected" :auto-tags="autoTags.get(selected.id) ?? []" />
      <AiTradeAnalysis :position-id="selected.id" :account-label="selectedAccount?.label ?? ''" :build-context="aiContext" />
    </section>

    <AutoTagLegend :entry-timeframe="autoTfText?.entry" :exit-timeframe="autoTfText?.exit" />
    <TradeChartTradeList :trades="trades" :currency="currency" :selected-id="selectedId" :auto-tags="autoTags" @select="focusTrade" />
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; font-size: 13px; }
.toolbar label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.select.small { min-height: 32px; padding: 4px 8px; }
.btn.small { padding: 5px 10px; font-size: 12px; }
.check { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; }
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
.note-box { border: 1px solid var(--border); padding: 12px 14px; margin-bottom: 14px; }
.note-box h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; gap: 10px; }
@media (max-width: 640px) { .chart { height: 320px; } .legend { margin-left: 0; } }
</style>
