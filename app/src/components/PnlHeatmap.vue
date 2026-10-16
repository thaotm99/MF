<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import type { TimeZoneMode } from '../stores/settings'
import { money } from '../utils/format'
import { atrDimension, byKeyNumber, er5Dimension, hourDimension, type PositionDimension } from '../utils/position-dimension-bins'

/**
 * Bản đồ nhiệt lãi/lỗ theo 2 chiều (Giờ × ATR, Giờ × ER5, ATR × ER5).
 * Màu phân kỳ quanh xám trung tính: xanh = lãi / thắng nhiều, đỏ = lỗ / thua nhiều; số ghi trong ô.
 */
const props = defineProps<{ positions: Mt5Position[]; currency: string; timeZone: TimeZoneMode }>()

type Pair = 'hour-atr' | 'hour-er5' | 'atr-er5'
const PAIRS: { id: Pair; label: string }[] = [
  { id: 'hour-atr', label: 'Giờ × ATR' },
  { id: 'hour-er5', label: 'Giờ × ER5' },
  { id: 'atr-er5', label: 'ATR × ER5' },
]
const pair = ref<Pair>('hour-atr')
const metric = ref<'pnl' | 'winrate'>('pnl')
/** Ô có ít lệnh hơn ngưỡng này làm mờ — mẫu quá nhỏ để kết luận */
const MIN_SAMPLE = 3

const dims = computed<{ x: PositionDimension; y: PositionDimension }>(() => {
  const hour = hourDimension(props.timeZone)
  if (pair.value === 'hour-atr') return { x: hour, y: atrDimension }
  if (pair.value === 'hour-er5') return { x: hour, y: er5Dimension }
  return { x: er5Dimension, y: atrDimension }
})

interface Cell { value: number; count: number; wins: number }

const grid = computed(() => {
  const { x, y } = dims.value
  const cells = new Map<string, Cell>()
  const xs = new Set<string>()
  const ys = new Set<string>()
  let skipped = 0
  for (const p of props.positions) {
    const kx = x.keyOf(p)
    const ky = y.keyOf(p)
    if (kx === undefined || ky === undefined) {
      skipped++
      continue
    }
    xs.add(kx)
    ys.add(ky)
    const c = cells.get(`${kx}|${ky}`) ?? { value: 0, count: 0, wins: 0 }
    c.value += p.netProfit
    c.count++
    if (p.netProfit >= 0) c.wins++
    cells.set(`${kx}|${ky}`, c)
  }
  const cols = [...xs].sort(byKeyNumber)
  const rows = [...ys].sort(byKeyNumber)
  const maxAbs = Math.max(1e-9, ...[...cells.values()].map((c) => Math.abs(c.value)))
  return { cols, rows, cells, maxAbs, skipped }
})

/** Giá trị theo chỉ số đang chọn, quy về [-1, 1] để tô màu */
function score(c: Cell): number {
  if (metric.value === 'pnl') return c.value / grid.value.maxAbs
  return (c.wins / c.count - 0.5) * 2 // 50% = trung tính
}

// Xám trung tính → xanh / đỏ (cùng cặp màu đã kiểm tra mù màu của biểu đồ cột)
const NEUTRAL = [240, 239, 236]
const POS = [34, 160, 107]
const NEG = [201, 55, 44]
function fill(c: Cell) {
  const s = score(c)
  const t = Math.min(1, Math.sqrt(Math.abs(s))) // căn bậc hai để ô giá trị nhỏ vẫn thấy màu
  const pole = s >= 0 ? POS : NEG
  const rgb = NEUTRAL.map((n, i) => Math.round(n + (pole[i] - n) * t))
  return { background: `rgb(${rgb.join(',')})`, color: t > 0.62 ? '#fff' : 'var(--text)' }
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const cellText = (c: Cell) =>
  metric.value === 'pnl' ? (c.value > 0 ? '+' : '') + compact.format(c.value) : `${Math.round((c.wins / c.count) * 100)}%`

const hover = ref<{ x: string; y: string; c: Cell } | null>(null)
const readout = computed(() => {
  const h = hover.value
  if (!h) return null
  const { x, y } = dims.value
  return {
    where: `${y.label} ${y.labelOf(h.y)} · ${x.label} ${x.labelOf(h.x)}`,
    pnl: `${money(h.c.value, { sign: true })} ${props.currency}`,
    win: h.c.value >= 0,
    detail: `${h.c.count} lệnh · thắng ${Math.round((h.c.wins / h.c.count) * 100)}%`,
  }
})
</script>

<template>
  <section class="heat card">
    <header>
      <h3>Bản đồ nhiệt</h3>
      <div class="controls">
        <div class="seg" role="radiogroup" aria-label="Trục bản đồ nhiệt">
          <button v-for="p in PAIRS" :key="p.id" type="button" role="radio" :aria-checked="pair === p.id"
            :class="{ on: pair === p.id }" @click="pair = p.id">{{ p.label }}</button>
        </div>
        <div class="seg" role="radiogroup" aria-label="Chỉ số">
          <button type="button" role="radio" :aria-checked="metric === 'pnl'" :class="{ on: metric === 'pnl' }" @click="metric = 'pnl'">Lãi/Lỗ</button>
          <button type="button" role="radio" :aria-checked="metric === 'winrate'" :class="{ on: metric === 'winrate' }" @click="metric = 'winrate'">Tỷ lệ thắng</button>
        </div>
      </div>
    </header>

    <p class="readout" aria-live="polite">
      <template v-if="readout">
        <b>{{ readout.where }}</b> — <b :class="readout.win ? 'pos' : 'neg'">{{ readout.pnl }}</b> · {{ readout.detail }}
      </template>
      <template v-else>Rê chuột (hoặc Tab) vào một ô để xem chi tiết.
        <span v-if="grid.skipped"> {{ grid.skipped }} lệnh không có {{ dims.y.label }}/{{ dims.x.label }} trong comment (bỏ qua).</span>
      </template>
    </p>

    <p v-if="!grid.rows.length" class="empty">Không có lệnh đủ dữ liệu trong kỳ đã chọn.</p>
    <div v-else class="scroll">
      <div class="map" :style="{ gridTemplateColumns: `76px repeat(${grid.cols.length}, minmax(40px, 1fr))` }"
        @mouseleave="hover = null">
        <div class="corner">{{ dims.y.label }} \ {{ dims.x.label }}</div>
        <div v-for="cx in grid.cols" :key="'h' + cx" class="col-h">{{ dims.x.labelOf(cx) }}</div>
        <template v-for="ry in grid.rows" :key="'r' + ry">
          <div class="row-h">{{ dims.y.labelOf(ry) }}</div>
          <template v-for="cx in grid.cols" :key="ry + '|' + cx">
            <div v-if="grid.cells.get(`${cx}|${ry}`)" class="cell" tabindex="0"
              :class="{ thin: grid.cells.get(`${cx}|${ry}`)!.count < MIN_SAMPLE }"
              :style="fill(grid.cells.get(`${cx}|${ry}`)!)"
              :aria-label="`${dims.y.label} ${dims.y.labelOf(ry)}, ${dims.x.label} ${dims.x.labelOf(cx)}: ${money(grid.cells.get(`${cx}|${ry}`)!.value, { sign: true })} ${currency}, ${grid.cells.get(`${cx}|${ry}`)!.count} lệnh`"
              @mouseenter="hover = { x: cx, y: ry, c: grid.cells.get(`${cx}|${ry}`)! }"
              @focus="hover = { x: cx, y: ry, c: grid.cells.get(`${cx}|${ry}`)! }">
              <span class="v">{{ cellText(grid.cells.get(`${cx}|${ry}`)!) }}</span>
              <span class="n">{{ grid.cells.get(`${cx}|${ry}`)!.count }}</span>
            </div>
            <div v-else class="cell none" />
          </template>
        </template>
      </div>
    </div>
    <p class="legend">
      <span class="ramp" /> {{ metric === 'pnl' ? 'Lỗ nhiều ← 0 → Lãi nhiều' : 'Thắng < 50% ← 50% → Thắng > 50%' }}
      · Số nhỏ = số lệnh · Ô mờ: dưới {{ MIN_SAMPLE }} lệnh
    </p>
  </section>
</template>

<style scoped>
.heat { padding: 14px 16px 12px; margin-top: 16px; border: 1px solid var(--border); }
header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
h3 { margin: 0; font-size: 14px; font-weight: 600; }
.controls { display: flex; gap: 8px; flex-wrap: wrap; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); padding: 5px 10px; color: var(--muted); font-size: 12px; font-weight: 500; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.on { background: var(--accent); color: #fff; }
.readout { font-size: 12px; color: var(--muted); min-height: 18px; margin: 10px 0 8px; }
.readout b { color: var(--text); font-weight: 600; }
.readout b.pos { color: var(--pos); }
.readout b.neg { color: var(--neg); }
.scroll { overflow-x: auto; }
.map { display: grid; gap: 2px; min-width: max-content; }
.corner, .col-h, .row-h { font-size: 11px; color: var(--muted); display: flex; align-items: center; }
.corner { font-size: 10px; color: var(--faint); }
.col-h { justify-content: center; padding-bottom: 2px; }
.row-h { justify-content: flex-end; padding-right: 6px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cell {
  height: 38px; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-variant-numeric: tabular-nums; outline: none; cursor: default; line-height: 1.1;
}
.cell:hover, .cell:focus-visible { box-shadow: 0 0 0 2px var(--text); }
.cell.thin { opacity: .45; }
.cell.none { background: #fafafa; }
.cell .v { font-size: 11px; font-weight: 600; }
.cell .n { font-size: 9px; opacity: .8; }
.empty { color: var(--muted); text-align: center; padding: 30px 0; margin: 0; font-size: 13px; }
.legend { font-size: 11px; color: var(--muted); margin: 8px 0 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ramp { width: 90px; height: 8px; border-radius: 4px; background: linear-gradient(90deg, rgb(201,55,44), rgb(240,239,236), rgb(34,160,107)); }
</style>
