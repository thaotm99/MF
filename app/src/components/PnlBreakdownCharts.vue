<script setup lang="ts">
import { computed } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import type { TimeZoneMode } from '../stores/settings'
import { atrDimension, byKeyNumber, er5Dimension, hourDimension, type PositionDimension } from '../utils/position-dimension-bins'
import PnlBarChart, { type BarItem } from './PnlBarChart.vue'
import PnlHeatmap from './PnlHeatmap.vue'

/** Vị thế đã lọc theo kỳ và đã quy đổi netProfit sang tiền tệ hiển thị. */
const props = defineProps<{ positions: Mt5Position[]; currency: string; timeZone: TimeZoneMode }>()

/** Gộp lãi/lỗ theo khoá; `order` quyết định thứ tự cột. */
function group(keyOf: (p: Mt5Position) => string, labelOf: (k: string) => string, order: (a: string, b: string) => number): BarItem[] {
  return groupOf(props.positions, keyOf, labelOf, order)
}

function groupOf(
  list: Mt5Position[],
  keyOf: (p: Mt5Position) => string,
  labelOf: (k: string) => string,
  order: (a: string, b: string) => number,
): BarItem[] {
  const map = new Map<string, BarItem>()
  for (const p of list) {
    const k = keyOf(p)
    const it = map.get(k) ?? { key: k, label: labelOf(k), value: 0, count: 0, wins: 0 }
    it.value += p.netProfit
    it.count++
    if (p.netProfit >= 0) it.wins++
    map.set(k, it)
  }
  return [...map.values()].sort((a, b) => order(a.key, b.key))
}

/** Bỏ hậu tố loại tài khoản của Exness: XAUUSDc → XAUUSD */
const baseSymbol = (s: string) => s.replace(/[a-z.#_]+$/, '').toUpperCase()

const hourDim = computed(() => hourDimension(props.timeZone))
const byHour = computed(() => group((p) => hourDim.value.keyOf(p)!, hourDim.value.labelOf, byKeyNumber))
const bySide = computed(() =>
  group((p) => p.type, (k) => (k === 'buy' ? 'Buy' : 'Sell'), (a, b) => (a === b ? 0 : a === 'sell' ? -1 : 1)),
)
const byVolume = computed(() => group((p) => String(p.volume), (k) => k, (a, b) => Number(a) - Number(b)))
const bySymbol = computed(() => group((p) => baseSymbol(p.symbol), (k) => k, (a, b) => a.localeCompare(b)))

/** Biểu đồ cột theo ATR / ER5; vị thế không có giá trị trong comment thì bỏ qua và ghi chú số lượng */
function byIndicator(dim: PositionDimension) {
  const withValue = props.positions.filter((p) => dim.keyOf(p) !== undefined)
  const items = groupOf(withValue, (p) => dim.keyOf(p)!, dim.labelOf, byKeyNumber)
  const missing = props.positions.length - withValue.length
  return { items, note: missing ? `${missing} lệnh không có giá trị trong comment (bỏ qua)` : undefined }
}

const byAtr = computed(() => byIndicator(atrDimension))
const byEr5 = computed(() => byIndicator(er5Dimension))
</script>

<template>
  <div class="grid">
    <PnlBarChart title="Giờ vào lệnh" :items="byHour" :currency="currency" />
    <PnlBarChart title="Mua & Bán" :items="bySide" :currency="currency" />
    <PnlBarChart title="Khối lượng" :items="byVolume" :currency="currency" />
    <PnlBarChart title="Mã" :items="bySymbol" :currency="currency" />
    <PnlBarChart title="ATR lúc vào lệnh" :items="byAtr.items" :note="byAtr.note" :currency="currency" />
    <PnlBarChart title="ER5 lúc vào lệnh" :items="byEr5.items" :note="byEr5.note" :currency="currency" />
  </div>
  <PnlHeatmap :positions="positions" :currency="currency" :time-zone="timeZone" />
  <p class="foot">
    Lãi/lỗ ròng (gồm commission, swap) của các vị thế đóng trong kỳ đã chọn, theo bảng Positions của báo cáo.
    ATR / ER5 đọc từ comment lệnh của EA ("A:", "er5:"; bản cũ "ATR :", "er:").
    Giờ vào lệnh theo {{ timeZone === 'utc' ? 'giờ server (UTC+0)' : 'giờ máy của bạn' }}.
  </p>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.foot { text-align: center; color: var(--faint); font-size: 11px; margin: 12px 0 0; }
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
