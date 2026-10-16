<script setup lang="ts">
import { computed } from 'vue'
import type { SketchRsi } from '../glossary/glossary-sketch-builders'

/** Khung RSI (0–100) bên dưới chart giá minh hoạ — vẽ như một nhóm <g> trong cùng SVG */
const props = defineProps<{ rsi: SketchRsi; x: (i: number) => number; step: number; left: number; width: number; top: number; height: number }>()

const y = (v: number) => props.top + props.height - (v / 100) * props.height
const line = (ys: (number | null)[]) => {
  let d = ''
  ys.forEach((v, i) => {
    if (v === null) return
    d += `${d ? 'L' : 'M'}${props.x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  return d
}
const main = computed(() => line(props.rsi.ys))
</script>

<template>
  <g class="rsi">
    <rect class="frame" :x="left" :y="top" :width="width" :height="height" rx="3" />
    <rect v-if="rsi.zone" class="zone" :x="left" :width="width" :y="y(Math.max(rsi.zone.from, rsi.zone.to))" :height="Math.abs(y(rsi.zone.from) - y(rsi.zone.to))" />
    <g v-for="l in rsi.levels ?? []" :key="'lv' + l.v">
      <line class="level" :x1="left" :x2="left + width" :y1="y(l.v)" :y2="y(l.v)" />
      <text class="level-text" :x="left + width + 4" :y="y(l.v)" dy="0.32em">{{ l.text ?? l.v }}</text>
    </g>
    <text class="title" :x="left + 4" :y="top + 10">RSI</text>
    <path v-for="(p, k) in rsi.paths ?? []" :key="'p' + k" class="sub" :class="p.tone ?? 'fast'" :d="line(p.ys)" />
    <path class="main" :d="main" />
    <g v-for="(sg, k) in rsi.segments ?? []" :key="'s' + k">
      <polyline class="seg" :points="sg.pts.map(([i, v]) => `${x(i)},${y(v)}`).join(' ')" />
      <text v-if="sg.text" class="seg-text" :x="x(sg.pts[sg.pts.length - 1][0]) + 5" :y="y(sg.pts[sg.pts.length - 1][1])" dy="0.32em">{{ sg.text }}</text>
    </g>
    <text v-for="(l, k) in rsi.labels ?? []" :key="'l' + k" class="label" text-anchor="middle"
      :x="x(l.i)" :y="l.at === 'low' ? y(rsi.ys[l.i] ?? 50) + 12 : y(rsi.ys[l.i] ?? 50) - 5">{{ l.text }}</text>
    <!-- Chú thích bên phải khung (không đè lên đường) -->
    <g v-if="rsi.paths?.length" class="legend">
      <text v-if="rsi.mainText" class="main-key" :x="left + width + 4" :y="top + height - 4">{{ rsi.mainText }}</text>
      <text v-for="(p, k) in rsi.paths" :key="'lg' + k" :class="p.tone ?? 'fast'" :x="left + width + 4" :y="top + 10 + k * 11">{{ p.text }}</text>
    </g>
  </g>
</template>

<style scoped>
.frame { fill: none; stroke: var(--border); }
.zone { fill: var(--accent); opacity: 0.07; }
.level { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; }
.level-text { fill: var(--muted); font-size: 10px; }
.title { fill: var(--muted); font-size: 9px; font-weight: 700; }
.main { fill: none; stroke: var(--text); stroke-width: 1.6; }
.sub { fill: none; stroke-width: 1.4; }
.sub.fast, .legend .fast { stroke: var(--accent); fill: var(--accent); }
.sub.slow, .legend .slow { stroke: #d97706; fill: #d97706; }
.sub.fast, .sub.slow { fill: none; }
.legend text { font-size: 9px; font-weight: 700; stroke: none; }
.legend .main-key { fill: var(--text); }
.seg { fill: none; stroke: var(--accent); stroke-width: 2; }
.seg-text { fill: var(--accent); font-size: 10px; font-weight: 600; }
.label { fill: var(--text); font-size: 10px; font-weight: 700; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
</style>
