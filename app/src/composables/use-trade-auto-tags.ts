import { computed, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { TIMEFRAME_SECONDS, type Candle, type CandleTimeframe } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import { useCandlesStore } from '../stores/candles'
import { autoTagsFor, type AutoTag } from '../utils/trade-auto-tags'
import { symbolMatches } from '../utils/trade-chart-markers'
import { DEFAULT_EVALUATION_OPTIONS, evaluateTrade } from '../utils/trade-evaluation'
import { evaluateExcursion } from '../utils/trade-excursion'
import { evaluateExit } from '../utils/trade-exit-evaluation'

/** Khung ưu tiên — giống mặc định của trang Đánh giá lệnh */
const ENTRY_PREFER: CandleTimeframe[] = ['M15', 'M5', 'M30', 'H1', 'M1']
const EXIT_PREFER: CandleTimeframe[] = ['M5', 'M1', 'M15', 'M30']
const EXIT_BARS = 5

/**
 * Nhãn tự động cho các lệnh (dùng ở Chart giá): với mỗi mã có file nến, đọc khung vào lệnh (ưu tiên M15)
 * và khung đóng lệnh (ưu tiên M5), tham số đánh giá mặc định.
 */
export function useTradeAutoTags(positions: Ref<Mt5Position[]>) {
  const candles = useCandlesStore()
  const tags = shallowRef(new Map<string, AutoTag[]>())
  const loading = ref(false)
  /** Khung đã dùng, theo mã — để hiện trong mô tả */
  const used = ref<{ symbol: string; entry: CandleTimeframe; exit: CandleTimeframe }[]>([])

  const plan = computed(() => {
    const symbols = [...new Set(candles.files.map((f) => f.symbol))]
    return symbols.flatMap((symbol) => {
      const pick = (prefer: CandleTimeframe[]) =>
        prefer.map((tf) => candles.files.find((f) => f.symbol === symbol && f.timeframe === tf)).find(Boolean)
      const entry = pick(ENTRY_PREFER)
      const exit = pick(EXIT_PREFER)
      return entry && exit ? [{ symbol, entry, exit }] : []
    })
  })

  let run = 0
  async function compute() {
    const id = ++run
    loading.value = true
    const out = new Map<string, AutoTag[]>()
    try {
      for (const { symbol, entry, exit } of plan.value) {
        const trades = positions.value.filter((p) => symbolMatches(p.symbol, symbol))
        if (!trades.length) continue
        const [ec, xc]: Candle[][] = await Promise.all([candles.load(entry.name), candles.load(exit.name)])
        if (id !== run) return
        const eSec = TIMEFRAME_SECONDS[entry.timeframe]
        const xSec = TIMEFRAME_SECONDS[exit.timeframe]
        for (const p of trades) {
          out.set(p.id, autoTagsFor({
            p,
            ev: evaluateTrade(p, ec, eSec, DEFAULT_EVALUATION_OPTIONS),
            exit: evaluateExit(p, xc, xSec, EXIT_BARS),
            exc: evaluateExcursion(p, xc, xSec),
            options: DEFAULT_EVALUATION_OPTIONS,
          }))
        }
      }
    } catch {
      // Lỗi đọc nến đã hiện ở chart; nhãn tự động để trống
    }
    if (id !== run) return
    used.value = plan.value.map((x) => ({ symbol: x.symbol, entry: x.entry.timeframe, exit: x.exit.timeframe }))
    tags.value = out
    loading.value = false
  }

  watch([plan, positions], compute)
  onMounted(() => void compute())
  return { tags, loading, used }
}
