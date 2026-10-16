<script setup lang="ts">
import { computed } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import type { TimeZoneMode } from '../stores/settings'
import PnlBarChart, { type BarItem } from './PnlBarChart.vue'

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

const hourOf = (iso: string) => {
  const d = new Date(iso)
  return props.timeZone === 'utc' ? d.getUTCHours() : d.getHours()
}
/** Bỏ hậu tố loại tài khoản của Exness: XAUUSDc → XAUUSD */
const baseSymbol = (s: string) => s.replace(/[a-z.#_]+$/, '').toUpperCase()

const byHour = computed(() => group((p) => String(hourOf(p.openTime)), (k) => `${k}:00`, (a, b) => Number(a) - Number(b)))
const bySide = computed(() =>
  group((p) => p.type, (k) => (k === 'buy' ? 'Buy' : 'Sell'), (a, b) => (a === b ? 0 : a === 'sell' ? -1 : 1)),
)
const byVolume = computed(() => group((p) => String(p.volume), (k) => k, (a, b) => Number(a) - Number(b)))
const bySymbol = computed(() => group((p) => baseSymbol(p.symbol), (k) => k, (a, b) => a.localeCompare(b)))

/**
 * Chia giá trị chỉ báo thành khoảng [lo, lo + step); giá trị ≥ cap gộp vào nhóm "≥ cap".
 * Khoá là cận dưới của khoảng để sắp xếp đúng thứ tự số.
 */
function byIndicator(valueOf: (p: Mt5Position) => number | undefined, step: number, cap: number, digits: number) {
  const withValue = props.positions.filter((p) => valueOf(p) !== undefined)
  const binOf = (v: number) => (v >= cap ? cap : Math.floor(v / step + 1e-9) * step)
  const items = groupOf(
    withValue,
    (p) => binOf(valueOf(p)!).toFixed(digits),
    (k) => (Number(k) >= cap ? `≥ ${k}` : `${k}–${(Number(k) + step).toFixed(digits)}`),
    (a, b) => Number(a) - Number(b),
  )
  const missing = props.positions.length - withValue.length
  return { items, note: missing ? `${missing} lệnh không có giá trị trong comment (bỏ qua)` : undefined }
}

// ATR lúc vào lệnh: bước 0.5, gộp từ 5 trở lên. ER5 (0–1): bước 0.1.
const byAtr = computed(() => byIndicator((p) => p.atr, 0.5, 5, 1))
const byEr5 = computed(() => byIndicator((p) => p.er5, 0.1, 1, 1))
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
