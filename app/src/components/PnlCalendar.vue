<script setup lang="ts">
import { computed } from 'vue'
import type { TimeZoneMode } from '../stores/settings'
import { dayKey, type DayStat } from '../utils/stats'
import { moneyVi } from '../utils/format'

const props = defineProps<{
  year: number
  month: number // 0-based
  daily: Map<string, DayStat>
  timeZone: TimeZoneMode
  loading: boolean
}>()
const emit = defineEmits<{ change: [year: number, month: number]; refresh: [] }>()

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const todayKey = computed(() => dayKey(Date.now(), props.timeZone))

/** 6 tuần × 7 ngày, bắt đầu từ thứ Hai. */
const cells = computed(() => {
  const first = new Date(Date.UTC(props.year, props.month, 1))
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(props.year, props.month, 1 - offset + i))
    const k = key(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    return { key: k, day: d.getUTCDate(), inMonth: d.getUTCMonth() === props.month, stat: props.daily.get(k) }
  })
})

const monthStats = computed(() => {
  let pnl = 0
  let days = 0
  for (const c of cells.value) {
    if (!c.inMonth || !c.stat) continue
    pnl += c.stat.pnl
    if (c.stat.trades > 0) days++
  }
  return { pnl, days }
})

function shift(delta: number) {
  const d = new Date(Date.UTC(props.year, props.month + delta, 1))
  emit('change', d.getUTCFullYear(), d.getUTCMonth())
}

function goToday() {
  const [y, m] = todayKey.value.split('-').map(Number)
  emit('change', y, m - 1)
}
</script>

<template>
  <div class="cal">
    <div class="toolbar">
      <button class="btn" @click="goToday">Hôm nay</button>
      <button class="nav" aria-label="Tháng trước" @click="shift(-1)">‹</button>
      <span class="title">Tháng {{ month + 1 }} {{ year }}</span>
      <button class="nav" aria-label="Tháng sau" @click="shift(1)">›</button>
      <div class="spacer" />
      <span class="muted">Số liệu thống kê hằng tháng:</span>
      <span class="chip" :class="monthStats.pnl >= 0 ? 'chip-pos' : 'chip-neg'">{{ moneyVi(monthStats.pnl) }} $</span>
      <span class="chip chip-gray">Ngày giao dịch: {{ monthStats.days }}</span>
      <button class="nav" :class="{ spin: loading }" title="Tải lại" @click="emit('refresh')">↻</button>
    </div>

    <div class="grid">
      <div v-for="w in WEEKDAYS" :key="w" class="head">{{ w }}</div>
      <div v-for="c in cells" :key="c.key" class="cell" :class="{ out: !c.inMonth }">
        <span class="day" :class="{ today: c.key === todayKey }">{{ c.day }}</span>
        <div v-if="c.inMonth && c.stat" class="stat" :class="c.stat.pnl >= 0 ? 'stat-pos' : 'stat-neg'">
          <b>{{ moneyVi(c.stat.pnl) }} $</b>
          <span>Các giao dịch: {{ c.stat.trades }}</span>
        </div>
      </div>
    </div>
    <p class="foot">
      Các giao dịch được tính theo
      {{ timeZone === 'utc' ? 'giờ nền tảng (UTC+0)' : 'giờ máy của bạn' }}, có thể khác với múi giờ của bạn.
    </p>
  </div>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.title { font-weight: 600; font-size: 15px; min-width: 110px; text-align: center; }
.nav {
  width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--border); background: var(--surface);
  display: inline-flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1; padding: 0;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.spacer { flex: 1; }
.muted { color: var(--muted); font-size: 12px; font-weight: 500; }
.chip { font-size: 12px; padding: 3px 8px; border-radius: 4px; }
.chip-pos { background: var(--pos-bg); color: var(--pos); }
.chip-neg { background: var(--neg-bg); color: var(--neg); }
.chip-gray { background: #e6e8ea; color: var(--muted); }
.grid {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  border-top: 1px solid var(--border); border-left: 1px solid var(--border);
}
.head, .cell { border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.head { padding: 4px 6px; color: var(--faint); font-size: 12px; }
.cell { min-height: 74px; padding: 6px 4px 4px; display: flex; flex-direction: column; gap: 6px; }
.out .day { color: var(--faint); }
.day {
  font-size: 11px; color: var(--muted); width: 18px; height: 18px; display: inline-flex;
  align-items: center; justify-content: center; border-radius: 50%; margin-left: 2px;
}
.day.today { background: var(--accent); color: #fff; }
.stat { border-radius: 4px; padding: 4px 6px; display: grid; gap: 2px; font-size: 11px; }
.stat b { font-size: 12px; font-weight: 600; }
.stat span { color: var(--muted); font-size: 10px; }
.stat-pos { background: var(--pos-bg); }
.stat-pos b { color: var(--pos); }
.stat-neg { background: var(--neg-bg); }
.stat-neg b { color: var(--neg); }
.foot { text-align: center; color: var(--faint); font-size: 10px; margin: 10px 0 0; }
@media (max-width: 640px) {
  .stat span { display: none; }
  .stat b { font-size: 10px; }
  .cell { min-height: 56px; }
}
</style>
