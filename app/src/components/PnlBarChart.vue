<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { money } from '../utils/format'

/** Một cột: tổng lãi/lỗ của một nhóm lệnh (giờ vào lệnh, chiều, khối lượng, mã...). */
export interface BarItem {
  key: string
  label: string
  value: number
  count: number
  wins: number
}

const props = defineProps<{
  title: string
  items: BarItem[]
  currency: string
  /** Ghi chú nhỏ dưới tiêu đề (ví dụ số lệnh không có dữ liệu) */
  note?: string
}>()

// ----- Kích thước: đo bề rộng thật để chữ không bị méo -----
const root = ref<HTMLElement | null>(null)
const width = ref(480)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  ro = new ResizeObserver(([e]) => (width.value = Math.max(260, Math.floor(e.contentRect.width))))
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const HEIGHT = 230
const M = { top: 12, right: 8, bottom: 40, left: 56 }
/** Giới hạn bề rộng cột (không lấp đầy cả khe) */
const MAX_BAR = 24
const RADIUS = 4

/** Mốc trục Y tròn, luôn chứa 0. */
function niceTicks(min: number, max: number, n = 4): number[] {
  if (min === max) max = min + 1
  const raw = (max - min) / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const out: number[] = []
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) {
    out.push(Math.abs(v) < step / 1e6 ? 0 : v)
  }
  return out
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

const geo = computed(() => {
  const values = props.items.map((i) => i.value)
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const plotW = width.value - M.left - M.right
  const plotH = HEIGHT - M.top - M.bottom
  const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * plotH
  const band = plotW / Math.max(1, props.items.length)
  const barW = Math.min(MAX_BAR, Math.max(4, band * 0.6))
  const y0 = y(0)
  // Nhãn trục X xoay khi khe quá hẹp
  const rotate = band < 44
  const labelEvery = band < 18 ? Math.ceil(18 / band) : 1
  const bars = props.items.map((it, i) => {
    const cx = M.left + band * i + band / 2
    const x = cx - barW / 2
    const yv = y(it.value)
    const h = Math.abs(yv - y0)
    const r = Math.min(RADIUS, h, barW / 2)
    // Đầu dữ liệu bo tròn 4px, chân cột (đường 0) vuông
    const path =
      it.value >= 0
        ? `M${x},${y0} V${yv + r} Q${x},${yv} ${x + r},${yv} H${x + barW - r} Q${x + barW},${yv} ${x + barW},${yv + r} V${y0} Z`
        : `M${x},${y0} V${yv - r} Q${x},${yv} ${x + r},${yv} H${x + barW - r} Q${x + barW},${yv} ${x + barW},${yv - r} V${y0} Z`
    return { ...it, cx, band, path, showLabel: i % labelEvery === 0 }
  })
  return { ticks: ticks.map((t) => ({ v: t, y: y(t) })), bars, y0, plotW, rotate, band }
})

// ----- Tooltip -----
const hover = ref<number | null>(null)
const hovered = computed(() => (hover.value === null ? null : geo.value.bars[hover.value]))
const tipLeft = computed(() => {
  if (!hovered.value) return 0
  return Math.min(Math.max(hovered.value.cx, 90), width.value - 90)
})

const showTable = ref(false)
const fmt = (v: number) => `${money(v, { sign: true })} ${props.currency}`
const winRate = (b: BarItem) => (b.count ? Math.round((b.wins / b.count) * 100) : 0)
</script>

<template>
  <section ref="root" class="chart card">
    <header>
      <h3>{{ title }}</h3>
      <button v-if="items.length" class="link" type="button" :aria-pressed="showTable" @click="showTable = !showTable">
        {{ showTable ? 'Biểu đồ' : 'Bảng' }}
      </button>
    </header>
    <p v-if="note" class="note">{{ note }}</p>

    <p v-if="!items.length" class="empty">Không có lệnh trong kỳ đã chọn.</p>

    <div v-else-if="showTable" class="table-wrap">
      <table>
        <thead><tr><th>Nhóm</th><th class="r">Lãi/Lỗ</th><th class="r">Số lệnh</th><th class="r">Tỉ lệ thắng</th></tr></thead>
        <tbody>
          <tr v-for="b in items" :key="b.key">
            <td>{{ b.label }}</td>
            <td class="r num" :class="b.value >= 0 ? 'pos' : 'neg'">{{ fmt(b.value) }}</td>
            <td class="r num">{{ b.count }}</td>
            <td class="r num">{{ winRate(b) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="plot" @mouseleave="hover = null">
      <svg :width="width" :height="HEIGHT" role="img" :aria-label="`${title}: lãi/lỗ theo nhóm`">
        <!-- Lưới & trục Y -->
        <g class="grid">
          <line v-for="t in geo.ticks" :key="t.v" :x1="M.left" :x2="M.left + geo.plotW" :y1="t.y" :y2="t.y"
            :class="{ zero: t.v === 0 }" />
        </g>
        <g class="ytick">
          <text v-for="t in geo.ticks" :key="t.v" :x="M.left - 8" :y="t.y" dy="0.32em" text-anchor="end">
            {{ compact.format(t.v) }}
          </text>
        </g>
        <!-- Cột -->
        <g>
          <path v-for="(b, i) in geo.bars" :key="b.key" :d="b.path" :class="b.value >= 0 ? 'pos' : 'neg'"
            :opacity="hover === null || hover === i ? 1 : 0.45" />
        </g>
        <!-- Nhãn trục X -->
        <g class="xtick">
          <template v-for="b in geo.bars" :key="b.key">
            <text v-if="b.showLabel" :x="b.cx" :y="HEIGHT - M.bottom + 14"
              :text-anchor="geo.rotate ? 'end' : 'middle'"
              :transform="geo.rotate ? `rotate(-45 ${b.cx} ${HEIGHT - M.bottom + 14})` : undefined">
              {{ b.label }}
            </text>
          </template>
        </g>
        <!-- Vùng rê chuột: cả khe, lớn hơn cột -->
        <rect v-for="(b, i) in geo.bars" :key="'hit' + b.key" class="hit" :x="b.cx - b.band / 2" :y="M.top"
          :width="b.band" :height="HEIGHT - M.top - M.bottom" @mouseenter="hover = i" @focus="hover = i"
          @blur="hover = null" tabindex="0" :aria-label="`${b.label}: ${fmt(b.value)}, ${b.count} lệnh`" />
      </svg>

      <div v-if="hovered" class="tip" :style="{ left: `${tipLeft}px` }">
        <div class="tip-title">{{ hovered.label }}</div>
        <div class="tip-row"><span class="dot" :class="hovered.value >= 0 ? 'pos' : 'neg'" />Lãi/Lỗ <b :class="hovered.value >= 0 ? 'val-pos' : 'val-neg'">{{ fmt(hovered.value) }}</b></div>
        <div class="tip-row">Số lệnh <b>{{ hovered.count }}</b> · Thắng <b>{{ winRate(hovered) }}%</b></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chart { padding: 14px 16px 10px; min-width: 0; border: 1px solid var(--border); }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
h3 { margin: 0; font-size: 14px; font-weight: 600; }
.note { margin: -2px 0 6px; color: var(--muted); font-size: 11px; }
.link { border: 0; background: none; color: var(--accent); font-size: 12px; padding: 2px 4px; }
.plot { position: relative; width: 100%; }
svg { display: block; overflow: visible; }
.grid line { stroke: var(--border); stroke-width: 1; }
.grid line.zero { stroke: #c9cdd1; }
.ytick text, .xtick text { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
path.pos, .dot.pos { fill: var(--chart-pos); background: var(--chart-pos); }
path.neg, .dot.neg { fill: var(--chart-neg); background: var(--chart-neg); }
path { transition: opacity .12s; }
.hit { fill: transparent; cursor: default; outline: none; }
.tip {
  position: absolute; top: 4px; transform: translateX(-50%); pointer-events: none; z-index: 2;
  background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;
  box-shadow: 0 4px 14px rgba(20, 29, 34, .12); font-size: 12px; white-space: nowrap; color: var(--text);
}
.tip-title { font-weight: 600; margin-bottom: 4px; }
.tip-row { color: var(--muted); display: flex; align-items: center; gap: 6px; }
.tip-row b { color: var(--text); font-weight: 600; }
.tip-row b.val-pos { color: var(--pos); }
.tip-row b.val-neg { color: var(--neg); }
.dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.empty { color: var(--muted); text-align: center; padding: 60px 0; margin: 0; font-size: 13px; }
.table-wrap { overflow-x: auto; max-height: 230px; overflow-y: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); }
td { padding: 6px; border-bottom: 1px solid var(--border); }
.r { text-align: right; }
.num { font-variant-numeric: tabular-nums; }
</style>
