<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AccountComparisonRow } from '../utils/account-comparison-stats'
import { int, money } from '../utils/format'

/** Bảng so sánh các tài khoản trong kỳ đã chọn; bấm tiêu đề cột để sắp xếp. */
const props = defineProps<{ rows: AccountComparisonRow[]; currency: string }>()

type Key = keyof AccountComparisonRow
interface Column {
  key: Key
  label: string
  /** true: giá trị lớn hơn là tốt hơn (dùng để đánh dấu tài khoản tốt nhất) */
  higherIsBetter?: boolean
  format: (r: AccountComparisonRow) => string
  /** Màu chữ theo dấu (lãi xanh / lỗ đỏ) */
  signed?: (r: AccountComparisonRow) => number
}

const m = (v: number, sign = false) => `${money(v, { sign })} ${props.currency}`
const COLUMNS: Column[] = [
  { key: 'net', label: 'Lợi nhuận ròng', higherIsBetter: true, format: (r) => m(r.net, true), signed: (r) => r.net },
  { key: 'trades', label: 'Lệnh', format: (r) => int(r.trades) },
  { key: 'winRate', label: 'Tỷ lệ thắng', higherIsBetter: true, format: (r) => `${r.winRate.toFixed(1)}%` },
  { key: 'profitFactor', label: 'Profit Factor', higherIsBetter: true, format: (r) => (r.profitFactor === null ? '—' : r.profitFactor.toFixed(2)) },
  { key: 'avgWin', label: 'Lãi TB', higherIsBetter: true, format: (r) => m(r.avgWin, true), signed: (r) => r.avgWin },
  { key: 'avgLoss', label: 'Lỗ TB', higherIsBetter: true, format: (r) => m(r.avgLoss), signed: (r) => r.avgLoss },
  { key: 'expectancy', label: 'Kỳ vọng / lệnh', higherIsBetter: true, format: (r) => m(r.expectancy, true), signed: (r) => r.expectancy },
  { key: 'losingStreak', label: 'Thua liên tiếp', higherIsBetter: false, format: (r) => `${r.losingStreak} lệnh` },
  { key: 'maxDrawdownPct', label: 'Max drawdown', higherIsBetter: false, format: (r) => `${m(-r.maxDrawdown)} (${r.maxDrawdownPct.toFixed(2)}%)` },
  { key: 'equity', label: 'Equity', format: (r) => m(r.equity) },
]

const sortKey = ref<Key>('net')
const desc = ref(true)
function sortBy(k: Key) {
  if (sortKey.value === k) desc.value = !desc.value
  else {
    sortKey.value = k
    desc.value = true
  }
}

const sorted = computed(() => {
  const k = sortKey.value
  const val = (r: AccountComparisonRow) => {
    const v = r[k]
    return typeof v === 'number' ? v : v === null ? -Infinity : String(v)
  }
  return [...props.rows].sort((a, b) => {
    const va = val(a)
    const vb = val(b)
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return desc.value ? -c : c
  })
})

/** Tài khoản tốt nhất theo từng cột (chỉ khi có ≥ 2 tài khoản) */
const best = computed(() => {
  const out = new Map<Key, string>()
  if (props.rows.length < 2) return out
  for (const c of COLUMNS) {
    if (c.higherIsBetter === undefined) continue
    const withVal = props.rows.filter((r) => r.trades > 0 && r[c.key] !== null)
    if (!withVal.length) continue
    const pick = withVal.reduce((a, b) => {
      const va = a[c.key] as number
      const vb = b[c.key] as number
      return (c.higherIsBetter ? vb > va : vb < va) ? b : a
    })
    out.set(c.key, pick.id)
  }
  return out
})
</script>

<template>
  <div class="wrap">
    <table v-if="rows.length">
      <thead>
        <tr>
          <th>Tài khoản</th>
          <th v-for="c in COLUMNS" :key="c.key" class="r" :aria-sort="sortKey === c.key ? (desc ? 'descending' : 'ascending') : 'none'">
            <button type="button" class="sort" @click="sortBy(c.key)">
              {{ c.label }}<span class="arrow">{{ sortKey === c.key ? (desc ? '▼' : '▲') : '' }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in sorted" :key="r.id">
          <td><b>{{ r.label }}</b><div class="muted">#{{ r.login }}</div></td>
          <td v-for="c in COLUMNS" :key="c.key" class="r num"
            :class="[c.signed ? (c.signed(r) > 0 ? 'pos' : c.signed(r) < 0 ? 'neg' : '') : '', { best: best.get(c.key) === r.id }]">
            {{ r.trades || c.key === 'equity' ? c.format(r) : '—' }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">Chưa có tài khoản nào.</p>
    <p class="foot">
      Tính trong kỳ đã chọn. Ô viền đậm = tốt nhất ở cột đó. Max drawdown: sụt giảm lớn nhất của balance (đã chốt lệnh)
      so với đỉnh trong kỳ. Profit Factor = tổng lãi / tổng lỗ.
    </p>
  </div>
</template>

<style scoped>
.wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; text-align: left; }
.sort { border: 0; background: none; color: inherit; font: inherit; padding: 0; cursor: pointer; }
.sort:hover { color: var(--text); }
.arrow { font-size: 9px; margin-left: 3px; }
td { padding: 9px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.num { font-variant-numeric: tabular-nums; }
.r { text-align: right; }
.muted { color: var(--muted); font-size: 11px; }
td.best { box-shadow: inset 0 0 0 2px var(--accent); border-radius: 4px; font-weight: 600; }
.empty { color: var(--muted); text-align: center; padding: 30px 0; margin: 0; }
.foot { color: var(--faint); font-size: 11px; margin: 10px 0 0; text-align: center; }
</style>
