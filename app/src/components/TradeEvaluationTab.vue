<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { TIMEFRAME_SECONDS, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { useCandlesStore } from '../stores/candles'
import { money } from '../utils/format'
import { symbolMatches } from '../utils/trade-chart-markers'
import {
  DEFAULT_EVALUATION_OPTIONS, EVALUATION_FEATURES, evaluateTrade, groupByFeature, type TradeEvaluation,
} from '../utils/trade-evaluation'
import TradeEvaluationList from './TradeEvaluationList.vue'

/**
 * Đánh giá từng lệnh theo price action: cấu trúc thị trường tại thời điểm vào lệnh (chỉ dùng nến đã đóng trước đó),
 * rồi thống kê thắng/thua theo từng yếu tố để biết bot thắng/thua ở bối cảnh nào.
 */
const props = defineProps<{ positions: Mt5Position[]; currency: string }>()
const emit = defineEmits<{ show: [positionId: string, timeframe: CandleTimeframe] }>()

const candles = useCandlesStore()
const TIMEFRAMES: CandleTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']
/** Lệnh hoà vốn tính là thắng (như MT5); nhóm dưới ngưỡng này làm mờ */
const MIN_SAMPLE = 5

const symbols = computed(() => [...new Set(candles.files.map((f) => f.symbol))].sort())
const symbol = ref('')
const timeframe = ref<CandleTimeframe>('M15')
const timeframes = computed(() => TIMEFRAMES.filter((tf) => candles.files.some((f) => f.symbol === symbol.value && f.timeframe === tf)))
const file = computed(() => candles.files.find((f) => f.symbol === symbol.value && f.timeframe === timeframe.value))
const options = reactive({ ...DEFAULT_EVALUATION_OPTIONS })

watch(symbols, (list) => {
  if (list.includes(symbol.value)) return
  const count = (s: string) => props.positions.filter((p) => symbolMatches(p.symbol, s)).length
  symbol.value = [...list].sort((a, b) => count(b) - count(a))[0] ?? ''
}, { immediate: true })
// Mặc định M15 (đủ bối cảnh cho lệnh M1/M5), nếu không có thì M5
watch(timeframes, (list) => {
  if (!list.includes(timeframe.value)) timeframe.value = list.includes('M15') ? 'M15' : list.includes('M5') ? 'M5' : (list[0] ?? 'M15')
}, { immediate: true })

const data = ref<Candle[]>([])
const loading = ref(false)
const error = ref('')
async function load() {
  if (!file.value) return (data.value = [])
  loading.value = true
  error.value = ''
  try {
    data.value = await candles.load(file.value.name)
  } catch (e) {
    data.value = []
    error.value = e instanceof Error ? e.message : String(e)
  }
  loading.value = false
}
watch(file, load)
onMounted(() => {
  if (candles.state === 'idle') candles.list()
  void load()
})

const trades = computed(() => props.positions.filter((p) => symbolMatches(p.symbol, symbol.value)))
const evals = computed<TradeEvaluation[]>(() =>
  data.value.length ? trades.value.map((p) => evaluateTrade(p, data.value, TIMEFRAME_SECONDS[timeframe.value], options)) : [],
)
const okCount = computed(() => evals.value.filter((e) => e.ok).length)
const groups = computed(() => EVALUATION_FEATURES.map((f) => ({ feature: f, stats: groupByFeature(evals.value, f, options) })))

const pct = (w: number, n: number) => `${Math.round((w / n) * 100)}%`
</script>

<template>
  <div>
    <div class="toolbar">
      <label>Mã
        <select v-model="symbol" class="select small" :disabled="!symbols.length">
          <option v-for="s in symbols" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <label>Khung đánh giá
        <select v-model="timeframe" class="select small">
          <option v-for="tf in timeframes" :key="tf" :value="tf">{{ tf }}</option>
        </select>
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
        <template v-else-if="evals.length">Đánh giá {{ okCount }}/{{ evals.length }} lệnh trong kỳ<template v-if="okCount < evals.length"> ({{ evals.length - okCount }} thiếu nến)</template></template>
      </span>
    </div>

    <p v-if="candles.state === 'ok' && !candles.files.length" class="alert">
      Cần file nến trong <code>app/candles/</code> (xem tab Chart giá) để đánh giá lệnh.
    </p>
    <p v-if="error" class="alert error">Không đọc được nến: {{ error }}</p>

    <template v-if="okCount">
      <div class="grid">
        <section v-for="g in groups" :key="g.feature.id" class="card group">
          <h3>{{ g.feature.title }}</h3>
          <table>
            <thead><tr><th>Nhóm</th><th class="r">Lệnh</th><th class="r">Thắng</th><th class="r">Lãi/Lỗ</th></tr></thead>
            <tbody>
              <tr v-for="s in g.stats" :key="s.label" :class="{ thin: s.count < MIN_SAMPLE }">
                <td>{{ s.label }}</td>
                <td class="r num">{{ s.count }}</td>
                <td class="r num">
                  <span class="wr"><i :style="{ width: pct(s.wins, s.count) }" /></span>{{ pct(s.wins, s.count) }}
                </td>
                <td class="r num" :class="s.pnl >= 0 ? 'pos' : 'neg'">{{ money(s.pnl, { sign: true }) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <p class="foot">
        Đánh giá trên nến {{ timeframe }} đã đóng trước giờ vào lệnh (không dùng nến tương lai). Swing = fractal {{ options.swingStrength }} nến
        mỗi bên; HH+HL = tăng, LH+LL = giảm. "Cản" = đỉnh swing phía trên (Buy) / đáy swing phía dưới (Sell). Dòng mờ: dưới {{ MIN_SAMPLE }} lệnh.
        Lãi/lỗ theo {{ currency }}.
      </p>
    </template>

    <TradeEvaluationList v-if="evals.length" :evals="evals" :currency="currency" :options="options"
      @show="(id) => emit('show', id, timeframe)" />
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
.toolbar label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.select.small { min-height: 32px; padding: 4px 8px; }
.muted { color: var(--muted); font-size: 12px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.group { border: 1px solid var(--border); padding: 12px 14px; }
h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 5px 6px; border-bottom: 1px solid var(--border); }
td { padding: 6px; border-bottom: 1px solid var(--border); }
tr.thin td { opacity: .5; }
.r { text-align: right; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.wr { display: inline-block; width: 40px; height: 4px; background: #eceef0; border-radius: 2px; margin-right: 6px; vertical-align: middle; overflow: hidden; }
.wr i { display: block; height: 100%; background: var(--muted); }
.foot { color: var(--faint); font-size: 11px; margin: 10px 0 0; text-align: center; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
