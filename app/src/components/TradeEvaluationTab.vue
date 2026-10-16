<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { TIMEFRAME_SECONDS, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { useCandlesStore } from '../stores/candles'
import { useTradeJournalStore } from '../stores/trade-journal'
import { symbolMatches } from '../utils/trade-chart-markers'
import { DEFAULT_EVALUATION_OPTIONS, evaluateTrade, type TradeEvaluation } from '../utils/trade-evaluation'
import { EVALUATION_FEATURES, groupByFeature } from '../utils/trade-evaluation-features'
import { evaluateExit, EXIT_FEATURES, groupExits, type ExitEvaluation } from '../utils/trade-exit-evaluation'
import { evaluateExcursion } from '../utils/trade-excursion'
import { groupByTag } from '../utils/trade-journal-stats'
import EvaluationGroupGrid from './EvaluationGroupGrid.vue'
import ExcursionSection from './ExcursionSection.vue'
import SetupCombinationSection from './SetupCombinationSection.vue'
import TradeEvaluationList from './TradeEvaluationList.vue'
import TradeEvaluationMethod from './TradeEvaluationMethod.vue'

/**
 * Đánh giá từng lệnh theo price action:
 * - Lúc vào lệnh: cấu trúc thị trường (chỉ dùng nến đã đóng trước giờ vào)
 * - Trước khi đóng lệnh: N nến đã đóng ngay trước giờ đóng (đà giá, lợi nhuận trả lại, nến đảo chiều)
 * rồi thống kê thắng/thua theo từng yếu tố để biết bot thắng/thua ở bối cảnh nào.
 */
const props = defineProps<{ positions: Mt5Position[]; currency: string }>()
const emit = defineEmits<{ show: [positionId: string, timeframe: CandleTimeframe] }>()

const candles = useCandlesStore()
const TIMEFRAMES: CandleTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

const symbols = computed(() => [...new Set(candles.files.map((f) => f.symbol))].sort())
const symbol = ref('')
const timeframe = ref<CandleTimeframe>('M15')
/** Khung riêng cho phần đóng lệnh: lệnh bot thường giữ ngắn nên mặc định M5 */
const exitTimeframe = ref<CandleTimeframe>('M5')
const exitBars = ref(5)
const timeframes = computed(() => TIMEFRAMES.filter((tf) => candles.files.some((f) => f.symbol === symbol.value && f.timeframe === tf)))
const fileFor = (tf: CandleTimeframe) => candles.files.find((f) => f.symbol === symbol.value && f.timeframe === tf)
const options = reactive({ ...DEFAULT_EVALUATION_OPTIONS })

watch(symbols, (list) => {
  if (list.includes(symbol.value)) return
  const count = (s: string) => props.positions.filter((p) => symbolMatches(p.symbol, s)).length
  symbol.value = [...list].sort((a, b) => count(b) - count(a))[0] ?? ''
}, { immediate: true })
const pick = (list: CandleTimeframe[], current: CandleTimeframe, prefer: CandleTimeframe[]) =>
  list.includes(current) ? current : (prefer.find((tf) => list.includes(tf)) ?? list[0] ?? current)
watch(timeframes, (list) => {
  timeframe.value = pick(list, timeframe.value, ['M15', 'M5'])
  exitTimeframe.value = pick(list, exitTimeframe.value, ['M5', 'M1', 'M15'])
}, { immediate: true })

// Nến cho phần vào lệnh và phần đóng lệnh (có thể cùng một file)
const entryData = ref<Candle[]>([])
const exitData = ref<Candle[]>([])
const loading = ref(false)
const error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [a, b] = await Promise.all([timeframe.value, exitTimeframe.value].map((tf) => {
      const f = fileFor(tf)
      return f ? candles.load(f.name) : Promise.resolve([] as Candle[])
    }))
    entryData.value = a
    exitData.value = b
  } catch (e) {
    entryData.value = []
    exitData.value = []
    error.value = e instanceof Error ? e.message : String(e)
  }
  loading.value = false
}
watch(() => [fileFor(timeframe.value)?.name, fileFor(exitTimeframe.value)?.name], load)
onMounted(() => {
  if (candles.state === 'idle') candles.list()
  void journal.ensureLoaded()
  void load()
})

const trades = computed(() => props.positions.filter((p) => symbolMatches(p.symbol, symbol.value)))
const evals = computed<TradeEvaluation[]>(() =>
  entryData.value.length ? trades.value.map((p) => evaluateTrade(p, entryData.value, TIMEFRAME_SECONDS[timeframe.value], options)) : [],
)
const exits = computed(() => {
  const out = new Map<string, ExitEvaluation>()
  if (!exitData.value.length) return out
  for (const p of trades.value) out.set(p.id, evaluateExit(p, exitData.value, TIMEFRAME_SECONDS[exitTimeframe.value], exitBars.value))
  return out
})
/** MAE / MFE dùng nến khung đóng lệnh (khung nhỏ, chính xác hơn) */
const excursions = computed(() =>
  exitData.value.length ? trades.value.map((p) => ({ p, x: evaluateExcursion(p, exitData.value, TIMEFRAME_SECONDS[exitTimeframe.value]) })) : [],
)
const excursionById = computed(() => new Map(excursions.value.map((e) => [e.p.id, e.x])))
const okCount = computed(() => evals.value.filter((e) => e.ok).length)
const exitOkCount = computed(() => [...exits.value.values()].filter((e) => e.ok).length)

const entryGroups = computed(() =>
  EVALUATION_FEATURES.map((f) => ({ id: f.id, title: f.title, stats: groupByFeature(evals.value, f, options) })),
)
/** Thống kê theo nhãn người dùng gắn (nhật ký) — không cần nến */
const journal = useTradeJournalStore()
const tagGroups = computed(() => [{ id: 'tags', title: 'Theo nhãn của bạn', stats: groupByTag(trades.value, journal.entries) }])
const taggedCount = computed(() => trades.value.filter((p) => journal.entries[p.id]).length)
const exitGroups = computed(() => {
  const items = trades.value.flatMap((p) => (exits.value.get(p.id) ? [{ exit: exits.value.get(p.id)!, p }] : []))
  return EXIT_FEATURES.map((f) => ({ id: f.id, title: f.title, stats: groupExits(items, f) }))
})
</script>

<template>
  <div>
    <div class="toolbar">
      <label>Mã
        <select v-model="symbol" class="select small" :disabled="!symbols.length">
          <option v-for="s in symbols" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label>Khung vào lệnh
        <select v-model="timeframe" class="select small"><option v-for="tf in timeframes" :key="tf" :value="tf">{{ tf }}</option></select>
      </label>
      <label>Độ mạnh swing
        <select v-model.number="options.swingStrength" class="select small">
          <option v-for="k in [2, 3, 4, 5]" :key="k" :value="k">{{ k }} nến</option>
        </select>
      </label>
      <label>Range
        <select v-model.number="options.rangeBars" class="select small">
          <option v-for="n in [10, 20, 30, 50]" :key="n" :value="n">{{ n }} nến</option>
        </select>
      </label>
      <span class="muted">
        <template v-if="loading">Đang đọc nến…</template>
        <template v-else-if="evals.length">Đánh giá {{ okCount }}/{{ evals.length }} lệnh<template v-if="okCount < evals.length"> ({{ evals.length - okCount }} thiếu nến)</template></template>
      </span>
    </div>

    <p v-if="candles.state === 'ok' && !candles.files.length" class="alert">
      Cần file nến trong <code>app/candles/</code> (xem trang Chart giá) để đánh giá lệnh.
    </p>
    <p v-if="error" class="alert error">Không đọc được nến: {{ error }}</p>

    <template v-if="okCount">
      <h2 class="section">Lúc vào lệnh</h2>
      <EvaluationGroupGrid :groups="entryGroups" />
      <p class="foot">
        Nến {{ timeframe }} đã đóng trước giờ vào lệnh (không dùng nến tương lai). Swing = fractal {{ options.swingStrength }} nến mỗi bên;
        HH+HL = tăng, LH+LL = giảm. "Cản" = đỉnh swing phía trên (Buy) / đáy swing phía dưới (Sell). H1/H4 gộp từ nến {{ timeframe }}.
        Phiên theo giờ server UTC+0. Dòng mờ: dưới 5 lệnh. Lãi/lỗ theo {{ currency }}.
      </p>
      <SetupCombinationSection :evals="evals" :options="options" :currency="currency" />
    </template>

    <template v-if="exits.size">
      <div class="section-head">
        <h2 class="section">Trước khi đóng lệnh</h2>
        <label>Khung
          <select v-model="exitTimeframe" class="select small"><option v-for="tf in timeframes" :key="tf" :value="tf">{{ tf }}</option></select>
        </label>
        <label>Số nến
          <select v-model.number="exitBars" class="select small"><option v-for="n in [3, 5, 10]" :key="n" :value="n">{{ n }} nến</option></select>
        </label>
        <span class="muted">{{ exitOkCount }}/{{ exits.size }} lệnh</span>
      </div>
      <EvaluationGroupGrid :groups="exitGroups" />
      <ExcursionSection :items="excursions" :timeframe="exitTimeframe" :currency="currency" />
      <p class="foot">
        {{ exitBars }} nến {{ exitTimeframe }} đã đóng ngay trước giờ đóng lệnh. "Chạy thuận / quay đầu" = giá đi ≥ 0.5 ATR theo / ngược chiều lệnh.
        "Trả lại" = giá tốt nhất trong {{ exitBars }} nến so với giá đóng, theo ATR — lớn nghĩa là lệnh nhả nhiều lợi nhuận trước khi đóng.
      </p>
    </template>

    <template v-if="taggedCount">
      <div class="section-head">
        <h2 class="section">Nhật ký của bạn</h2>
        <span class="muted">{{ taggedCount }}/{{ trades.length }} lệnh đã gắn nhãn / ghi chú</span>
      </div>
      <EvaluationGroupGrid :groups="tagGroups" />
      <p class="foot">Gắn nhãn ở cột "Nhãn" bên dưới hoặc trên trang Chart giá. Lệnh có nhiều nhãn được tính vào mỗi nhãn.</p>
    </template>

    <TradeEvaluationMethod :options="options" :entry-timeframe="timeframe" :exit-timeframe="exitTimeframe" :exit-bars="exitBars" />

    <TradeEvaluationList v-if="evals.length" :evals="evals" :exits="exits" :excursions="excursionById" :currency="currency" :options="options"
      @show="(id) => emit('show', id, timeframe)" />
  </div>
</template>

<style scoped>
.toolbar, .section-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
.toolbar label, .section-head label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.select.small { min-height: 32px; padding: 4px 8px; }
.muted { color: var(--muted); font-size: 12px; }
.section { font-size: 14px; font-weight: 600; margin: 8px 0 10px; }
.section-head { margin-top: 22px; }
.section-head .section { margin: 0; }
.foot { color: var(--faint); font-size: 11px; margin: 10px 0 0; text-align: center; }
</style>
