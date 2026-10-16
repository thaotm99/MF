<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** Khoảng ngày dạng YYYY-MM-DD, cả hai đầu đều tính (inclusive). */
export interface DateRange {
  start: string
  end: string
}

const props = defineProps<{
  modelValue: DateRange
  /** Ngày hôm nay (YYYY-MM-DD) theo múi giờ đã chọn; không cho chọn ngày sau đó */
  today: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

// Tính toán ngày trên UTC để không bị ảnh hưởng bởi giờ mùa hè / múi giờ máy.
const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toKey = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => {
  const d = toDate(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toKey(d)
}
const fmt = (s: string) => {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const presets = computed(() => {
  const t = props.today
  const td = toDate(t)
  const monthStart = toKey(new Date(Date.UTC(td.getUTCFullYear(), td.getUTCMonth(), 1)))
  const prevStart = toKey(new Date(Date.UTC(td.getUTCFullYear(), td.getUTCMonth() - 1, 1)))
  const prevEnd = addDays(monthStart, -1)
  return [
    { label: 'Hôm nay', start: t, end: t },
    { label: '7 ngày qua', start: addDays(t, -6), end: t },
    { label: '30 ngày qua', start: addDays(t, -29), end: t },
    { label: '90 ngày qua', start: addDays(t, -89), end: t },
    { label: 'Tháng này', start: monthStart, end: t },
    { label: 'Tháng trước', start: prevStart, end: prevEnd },
    { label: '365 ngày qua', start: addDays(t, -364), end: t },
  ]
})

const activePreset = computed(
  () => presets.value.find((p) => p.start === props.modelValue.start && p.end === props.modelValue.end)?.label,
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const draftStart = ref<string>(props.modelValue.start)
const draftEnd = ref<string | null>(props.modelValue.end)
const hover = ref<string | null>(null)
/** Tháng đầu tiên hiển thị (ngày 1) */
const viewMonth = ref(props.modelValue.start.slice(0, 7) + '-01')

function openPicker() {
  draftStart.value = props.modelValue.start
  draftEnd.value = props.modelValue.end
  // Hiển thị sao cho tháng của ngày kết thúc nằm ở lịch bên phải
  // (trên mobile chỉ có một lịch, nên hiển thị luôn tháng của ngày kết thúc)
  const end = toDate(props.modelValue.end)
  const single = window.matchMedia?.('(max-width: 760px)').matches
  viewMonth.value = toKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (single ? 0 : 1), 1)))
  open.value = true
}

function shiftMonth(n: number) {
  const d = toDate(viewMonth.value)
  viewMonth.value = toKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
}

function monthCells(first: string) {
  const d0 = toDate(first)
  const offset = (d0.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1 - offset + i))
    return { key: toKey(d), day: d.getUTCDate(), inMonth: d.getUTCMonth() === d0.getUTCMonth() }
  })
}

const months = computed(() => {
  const d = toDate(viewMonth.value)
  return [0, 1].map((n) => {
    const first = toKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))
    const fd = toDate(first)
    return { first, title: `Tháng ${fd.getUTCMonth() + 1} ${fd.getUTCFullYear()}`, cells: monthCells(first) }
  })
})

const canNext = computed(() => months.value[1].first.slice(0, 7) < props.today.slice(0, 7))
const canNextSingle = computed(() => months.value[0].first.slice(0, 7) < props.today.slice(0, 7))

/** Khoảng đang hiển thị (kể cả khi đang rê chuột chọn ngày kết thúc). */
const preview = computed(() => {
  const s = draftStart.value
  const e = draftEnd.value ?? hover.value ?? s
  return s <= e ? { s, e } : { s: e, e: s }
})

function pick(key: string) {
  if (key > props.today) return
  if (draftEnd.value !== null || key < draftStart.value) {
    // Bắt đầu chọn khoảng mới
    draftStart.value = key
    draftEnd.value = null
  } else {
    draftEnd.value = key
  }
}

function choosePreset(p: { start: string; end: string }) {
  emit('update:modelValue', { start: p.start, end: p.end })
  open.value = false
}

function apply() {
  const { s, e } = preview.value
  emit('update:modelValue', { start: s, end: e })
  open.value = false
}

const label = computed(() =>
  activePreset.value ?? `${fmt(props.modelValue.start)} – ${fmt(props.modelValue.end)}`,
)
const dayCount = computed(
  () => Math.round((toDate(preview.value.e).getTime() - toDate(preview.value.s).getTime()) / 86_400_000) + 1,
)

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKey)
})
watch(() => props.today, () => (open.value = false))
</script>

<template>
  <div ref="root" class="drp">
    <button type="button" class="select trigger" :aria-expanded="open" @click="open ? (open = false) : openPicker()">
      <span>{{ label }}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
    </button>

    <div v-if="open" class="pop card" role="dialog" aria-label="Chọn khoảng thời gian">
      <ul class="presets">
        <li v-for="p in presets" :key="p.label">
          <button type="button" :class="{ active: activePreset === p.label }" @click="choosePreset(p)">{{ p.label }}</button>
        </li>
      </ul>

      <div class="main">
        <div class="months">
          <div v-for="(m, i) in months" :key="m.first" class="month" :class="{ second: i === 1 }">
            <div class="mhead">
              <button v-if="i === 0" type="button" class="nav" aria-label="Tháng trước" @click="shiftMonth(-1)">‹</button>
              <span v-else class="nav-space" />
              <span class="mtitle">{{ m.title }}</span>
              <button v-if="i === 1" type="button" class="nav" aria-label="Tháng sau" :disabled="!canNext" @click="shiftMonth(1)">›</button>
              <button v-else type="button" class="nav only-mobile" aria-label="Tháng sau" :disabled="!canNextSingle" @click="shiftMonth(1)">›</button>
            </div>
            <div class="days">
              <span v-for="w in WEEKDAYS" :key="w" class="wd">{{ w }}</span>
              <template v-for="c in m.cells" :key="c.key">
                <span v-if="!c.inMonth" class="day empty" />
                <button
                  v-else
                  type="button"
                  class="day"
                  :disabled="c.key > today"
                  :class="{
                    today: c.key === today,
                    inrange: c.key > preview.s && c.key < preview.e,
                    edge: c.key === preview.s || c.key === preview.e,
                    start: c.key === preview.s,
                    end: c.key === preview.e,
                  }"
                  @click="pick(c.key)"
                  @mouseenter="hover = c.key"
                  @mouseleave="hover = null"
                >{{ c.day }}</button>
              </template>
            </div>
          </div>
        </div>

        <div class="foot">
          <span class="range">
            <b>{{ fmt(preview.s) }}</b> – <b>{{ draftEnd || hover ? fmt(preview.e) : '…' }}</b>
            <span class="muted">({{ dayCount }} ngày)</span>
          </span>
          <span v-if="draftEnd === null" class="muted hint-text">Chọn ngày kết thúc</span>
          <div class="actions">
            <button type="button" class="btn" @click="open = false">Huỷ</button>
            <button type="button" class="btn btn-primary" @click="apply">Áp dụng</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drp { position: relative; }
.trigger { display: inline-flex; align-items: center; gap: 12px; min-width: 160px; justify-content: space-between; }
.pop {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; display: flex;
  box-shadow: 0 8px 28px rgba(20, 29, 34, .16); border: 1px solid var(--border);
}
.presets { list-style: none; margin: 0; padding: 10px 0; border-right: 1px solid var(--border); min-width: 140px; }
.presets button {
  width: 100%; text-align: left; border: 0; background: none; padding: 8px 16px; font-size: 13px; color: var(--text);
}
.presets button:hover { background: #f4f5f7; }
.presets button.active { color: var(--accent); font-weight: 600; }
.main { padding: 14px 16px 12px; }
.months { display: flex; gap: 24px; }
.month { width: 238px; }
.mhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.mtitle { font-weight: 600; font-size: 14px; }
.nav, .nav-space { width: 26px; height: 26px; }
.nav {
  border-radius: 50%; border: 1px solid var(--border); background: var(--surface); padding: 0;
  display: inline-flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;
}
.nav:disabled { opacity: .35; cursor: default; }
.only-mobile { visibility: hidden; }
.days { display: grid; grid-template-columns: repeat(7, 34px); row-gap: 2px; }
.wd { font-size: 11px; color: var(--faint); text-align: center; padding: 4px 0; }
.day {
  height: 32px; border: 0; background: none; font-size: 13px; color: var(--text); padding: 0; border-radius: 0;
}
.day:not(:disabled):not(.edge):hover { background: #eef3ff; border-radius: 6px; }
.day:disabled { color: #c9cdd0; cursor: default; }
.day.today { font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
.day.inrange { background: #e8f1ff; }
.day.edge { background: var(--accent); color: #fff; }
.day.start { border-radius: 6px 0 0 6px; }
.day.end { border-radius: 0 6px 6px 0; }
.day.start.end { border-radius: 6px; }
.foot {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--border);
  margin-top: 10px; padding-top: 10px; font-size: 13px;
}
.range b { font-weight: 600; }
.range .muted { margin-left: 4px; }
.muted { color: var(--muted); }
.hint-text { font-size: 12px; }
.actions { margin-left: auto; display: flex; gap: 8px; }

@media (max-width: 760px) {
  .pop { position: fixed; left: 16px; right: 16px; top: 80px; flex-direction: column; max-height: calc(100vh - 100px); overflow: auto; }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; border-right: 0; border-bottom: 1px solid var(--border); }
  .presets button { width: auto; border: 1px solid var(--border); border-radius: 999px; padding: 5px 10px; }
  .month.second { display: none; }
  .only-mobile { visibility: visible; }
  .month { width: 100%; }
  .days { grid-template-columns: repeat(7, minmax(0, 1fr)); }
}
</style>
