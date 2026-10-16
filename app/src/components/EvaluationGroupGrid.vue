<script setup lang="ts">
import type { CategoryStat } from '../utils/trade-evaluation-features'
import { money } from '../utils/format'

/** Lưới các bảng thống kê thắng/thua theo nhóm (dùng cho phần vào lệnh và phần đóng lệnh) */
defineProps<{ groups: { id: string; title: string; stats: CategoryStat[] }[] }>()

/** Nhóm dưới ngưỡng này làm mờ — mẫu quá nhỏ để kết luận */
const MIN_SAMPLE = 5
const pct = (w: number, n: number) => `${Math.round((w / n) * 100)}%`
</script>

<template>
  <div class="grid">
    <section v-for="g in groups" :key="g.id" class="card group">
      <h3>{{ g.title }}</h3>
      <table>
        <thead><tr><th>Nhóm</th><th class="r">Lệnh</th><th class="r">Thắng</th><th class="r">Lãi/Lỗ</th></tr></thead>
        <tbody>
          <tr v-for="s in g.stats" :key="s.label" :class="{ thin: s.count < MIN_SAMPLE }">
            <td>{{ s.label }}</td>
            <td class="r num">{{ s.count }}</td>
            <td class="r num"><span class="wr"><i :style="{ width: pct(s.wins, s.count) }" /></span>{{ pct(s.wins, s.count) }}</td>
            <td class="r num" :class="s.pnl >= 0 ? 'pos' : 'neg'">{{ money(s.pnl, { sign: true }) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
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
@media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
</style>
