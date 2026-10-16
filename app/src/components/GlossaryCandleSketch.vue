<script setup lang="ts">
import { computed } from 'vue'
import type { Sketch } from '../glossary/glossary-sketch-builders'

/** Vẽ nến minh hoạ (SVG) + nhãn, đường giá, vùng tô, điểm vào/ra, đoạn đo — dùng ở trang Thuật ngữ */
const props = defineProps<{ sketch: Sketch }>()

const W = 360
const H = 190
const M = { top: 18, right: 64, bottom: 14, left: 8 }

const geo = computed(() => {
  const s = props.sketch
  const n = s.candles.length
  const ys = [
    ...s.candles.flatMap((c) => [c[1], c[2]]),
    ...(s.lines ?? []).map((l) => l.y),
    ...(s.priceBands ?? []).flatMap((b) => [b.y1, b.y2]),
    ...(s.path?.ys ?? []).filter((v): v is number => v !== null),
    ...(s.markers ?? []).map((m) => m.y),
  ]
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = (hi - lo) * 0.12 || 1
  const min = lo - pad
  const max = hi + pad
  const pw = W - M.left - M.right
  const ph = H - M.top - M.bottom
  const step = pw / n
  const x = (i: number) => M.left + step * (i + 0.5)
  const y = (v: number) => M.top + ph - ((v - min) / (max - min)) * ph
  const bodyW = Math.max(3, Math.min(14, step * 0.62))
  return { n, step, x, y, bodyW, pw, ph }
})

const candles = computed(() => {
  const { x, y, bodyW } = geo.value
  return props.sketch.candles.map(([o, h, l, c], i) => {
    const top = y(Math.max(o, c))
    return { i, cx: x(i), x: x(i) - bodyW / 2, w: bodyW, top, hgt: Math.max(1.5, y(Math.min(o, c)) - top), yh: y(h), yl: y(l), up: c >= o }
  })
})

const pathD = computed(() => {
  const p = props.sketch.path
  if (!p) return ''
  const { x, y } = geo.value
  let d = ''
  p.ys.forEach((v, i) => {
    if (v === null) return
    d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  return d
})
const zigzagPts = computed(() => (props.sketch.zigzag ?? []).map(([i, v]) => `${geo.value.x(i)},${geo.value.y(v)}`).join(' '))
const lastPathPoint = computed(() => {
  const ys = props.sketch.path?.ys ?? []
  for (let i = ys.length - 1; i >= 0; i--) if (ys[i] !== null) return { x: geo.value.x(i), y: geo.value.y(ys[i] as number) }
  return null
})
</script>

<template>
  <figure class="sketch">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="sketch.caption ?? 'Hình minh hoạ'">
      <!-- Vùng tô theo giá (range, vùng cao/thấp) -->
      <g v-for="(b, k) in sketch.priceBands ?? []" :key="'pb' + k">
        <rect class="pband" :x="M.left" :width="geo.pw" :y="geo.y(Math.max(b.y1, b.y2))" :height="Math.abs(geo.y(b.y1) - geo.y(b.y2))" />
        <text v-if="b.text" class="side-text" :x="M.left + geo.pw + 4" :y="(geo.y(b.y1) + geo.y(b.y2)) / 2" dy="0.32em">{{ b.text }}</text>
      </g>
      <!-- Vùng tô theo nến -->
      <g v-for="(b, k) in sketch.bands ?? []" :key="'b' + k">
        <rect class="band" :x="geo.x(b.from) - geo.step / 2" :width="geo.step * (b.to - b.from + 1)" :y="M.top - 4" :height="geo.ph + 8" rx="3" />
        <text v-if="b.text" class="band-text" :x="geo.x(b.from) - geo.step / 2 + 3" :y="M.top - 7">{{ b.text }}</text>
      </g>
      <g v-for="(d, k) in sketch.dividers ?? []" :key="'d' + k">
        <line class="divider" :x1="geo.x(d.i) - geo.step / 2" :x2="geo.x(d.i) - geo.step / 2" :y1="M.top - 4" :y2="H - M.bottom + 4" />
        <text v-if="d.text" class="band-text" :x="geo.x(d.i) - geo.step / 2 + 3" :y="H - 3">{{ d.text }}</text>
      </g>
      <!-- Đường ngang -->
      <g v-for="(l, k) in sketch.lines ?? []" :key="'l' + k">
        <line class="hline" :class="{ solid: l.solid }" :x1="l.from === undefined ? M.left : geo.x(l.from)" :x2="l.to === undefined ? M.left + geo.pw : geo.x(l.to)"
          :y1="geo.y(l.y)" :y2="geo.y(l.y)" />
        <text v-if="l.text" class="side-text" :x="(l.to === undefined ? M.left + geo.pw : geo.x(l.to)) + 4" :y="geo.y(l.y)" dy="0.32em">{{ l.text }}</text>
      </g>
      <!-- Nến -->
      <g v-for="c in candles" :key="'c' + c.i" :class="c.up ? 'up' : 'down'">
        <line class="wick" :x1="c.cx" :x2="c.cx" :y1="c.yh" :y2="c.yl" />
        <rect class="body" :x="c.x" :y="c.top" :width="c.w" :height="c.hgt" rx="1" />
      </g>
      <polyline v-if="zigzagPts" class="zigzag" :points="zigzagPts" />
      <path v-if="pathD" class="path" :d="pathD" />
      <text v-if="sketch.path?.text && lastPathPoint" class="path-text" :x="lastPathPoint.x + 6" :y="lastPathPoint.y" dy="0.32em">{{ sketch.path.text }}</text>
      <!-- Đoạn đo -->
      <g v-for="(m, k) in sketch.measures ?? []" :key="'m' + k" class="measure">
        <line :x1="geo.x(m.i)" :x2="geo.x(m.i)" :y1="geo.y(m.y1)" :y2="geo.y(m.y2)" />
        <line :x1="geo.x(m.i) - 4" :x2="geo.x(m.i) + 4" :y1="geo.y(m.y1)" :y2="geo.y(m.y1)" />
        <line :x1="geo.x(m.i) - 4" :x2="geo.x(m.i) + 4" :y1="geo.y(m.y2)" :y2="geo.y(m.y2)" />
        <text :x="geo.x(m.i) + 6" :y="(geo.y(m.y1) + geo.y(m.y2)) / 2" dy="0.32em">{{ m.text }}</text>
      </g>
      <!-- Nhãn swing / mẫu nến -->
      <text v-for="(l, k) in sketch.labels ?? []" :key="'t' + k" class="label" :class="l.tone" text-anchor="middle"
        :x="geo.x(l.i)" :y="l.at === 'high' ? geo.y(sketch.candles[l.i][1]) - 5 : geo.y(sketch.candles[l.i][2]) + 12">{{ l.text }}</text>
      <!-- Điểm vào / ra -->
      <g v-for="(m, k) in sketch.markers ?? []" :key="'k' + k" class="marker" :class="m.kind">
        <path v-if="m.kind === 'buy'" :d="`M${geo.x(m.i)},${geo.y(m.y) + 3} l-5,9 h10 z`" />
        <path v-else-if="m.kind === 'sell'" :d="`M${geo.x(m.i)},${geo.y(m.y) - 3} l-5,-9 h10 z`" />
        <circle v-else :cx="geo.x(m.i)" :cy="geo.y(m.y)" r="4" />
        <text v-if="m.text" class="marker-text" :x="geo.x(m.i)" text-anchor="middle"
          :y="m.kind === 'buy' ? geo.y(m.y) + 22 : m.kind === 'sell' ? geo.y(m.y) - 15 : geo.y(m.y) - 8">{{ m.text }}</text>
      </g>
    </svg>
    <figcaption v-if="sketch.caption">{{ sketch.caption }}</figcaption>
  </figure>
</template>

<style scoped>
.sketch { margin: 0; }
svg { display: block; width: 100%; height: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
figcaption { font-size: 12px; color: var(--muted); text-align: center; margin-top: 4px; }
.up .body { fill: var(--chart-pos); }
.down .body { fill: var(--chart-neg); }
.up .wick { stroke: var(--chart-pos); }
.down .wick { stroke: var(--chart-neg); }
.wick { stroke-width: 1.2; }
.zigzag { fill: none; stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 2; }
.path { fill: none; stroke: var(--accent); stroke-width: 2; }
.path-text { fill: var(--accent); font-size: 10px; font-weight: 600; }
.hline { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; }
.hline.solid { stroke-dasharray: none; }
.side-text { fill: var(--muted); font-size: 10px; }
.band { fill: var(--accent); opacity: 0.08; }
.band-text { fill: var(--accent); font-size: 10px; font-weight: 600; }
.pband { fill: var(--muted); opacity: 0.08; }
.divider { stroke: var(--faint); stroke-width: 1; }
.label { fill: var(--text); font-size: 10px; font-weight: 700; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
.measure line { stroke: var(--text); stroke-width: 1.2; }
.measure text { fill: var(--text); font-size: 10px; font-weight: 600; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
.marker path { fill: var(--accent); stroke: var(--surface); stroke-width: 1.5; }
.marker circle { fill: var(--surface); stroke: var(--text); stroke-width: 2; }
.marker-text { fill: var(--text); font-size: 10px; font-weight: 600; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
</style>
