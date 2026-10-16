<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import { money } from '../utils/format'
import { percentile, summarizeExcursions, type Excursion } from '../utils/trade-excursion'

/** MAE / MFE: tóm tắt gợi ý SL/TP + biểu đồ phân tán (trục X = MAE, trục Y = MFE, theo ATR) */
const props = defineProps<{ items: { p: Mt5Position; x: Excursion }[]; timeframe: string; currency: string }>()

const ok = computed(() => props.items.filter((i) => i.x.ok))
const s = computed(() => summarizeExcursions(ok.value.map((i) => i.x)))
const pct = (v: number) => `${Math.round(v * 100)}%`
const atr = (v: number) => `${v.toFixed(2)} ATR`
const price = (v: number) => (v * s.value.medianAtr).toFixed(2)

// ----- Biểu đồ phân tán -----
const root = ref<HTMLElement | null>(null)
const width = ref(600)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  ro = new ResizeObserver(([e]) => (width.value = Math.max(280, Math.floor(e.contentRect.width))))
  ro.observe(root.value)
})
onBeforeUnmount(() => ro?.disconnect())

const H = 300
const M = { top: 10, right: 12, bottom: 34, left: 44 }
const geo = computed(() => {
  // Cắt ở phân vị 98% để vài điểm cực đoan không ép nhỏ phần còn lại
  const maxX = Math.max(0.5, percentile(ok.value.map((i) => i.x.maeAtr), 0.98))
  const maxY = Math.max(0.5, percentile(ok.value.map((i) => i.x.mfeAtr), 0.98))
  const pw = width.value - M.left - M.right
  const ph = H - M.top - M.bottom
  const sx = (v: number) => M.left + (Math.min(v, maxX) / maxX) * pw
  const sy = (v: number) => M.top + ph - (Math.min(v, maxY) / maxY) * ph
  const ticks = (max: number) => {
    const step = max > 4 ? 1 : max > 2 ? 0.5 : 0.25
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, k) => +(k * step).toFixed(2))
  }
  return {
    dots: ok.value.map((i) => ({ ...i, cx: sx(i.x.maeAtr), cy: sy(i.x.mfeAtr) })),
    xt: ticks(maxX).map((v) => ({ v, x: sx(v) })),
    yt: ticks(maxY).map((v) => ({ v, y: sy(v) })),
    p90x: sx(s.value.winMae.p90),
    pw, ph,
  }
})
const hover = ref<number | null>(null)
const hovered = computed(() => (hover.value === null ? null : geo.value.dots[hover.value]))
const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
</script>

<template>
  <section class="exc">
    <div class="head">
      <h2>Biên độ trong lệnh (MAE / MFE)</h2>
      <span class="muted">Nến {{ timeframe }} từ lúc vào đến lúc ra · {{ ok.length }}/{{ items.length }} lệnh · 1 ATR ≈ {{ s.medianAtr.toFixed(2) }} giá</span>
    </div>

    <div v-if="ok.length" class="cards">
      <div class="card stat">
        <div class="label">Lệnh thắng đi ngược tối đa (MAE)</div>
        <div class="value">{{ atr(s.winMae.p90) }}</div>
        <div class="sub">90% lệnh thắng ngược không quá {{ atr(s.winMae.p90) }} (≈ {{ price(s.winMae.p90) }} giá) · trung vị {{ atr(s.winMae.p50) }} · 75%: {{ atr(s.winMae.p75) }}</div>
        <div class="hint-text">→ SL rộng hơn mức này ít khi cứu thêm lệnh thắng; SL hẹp hơn sẽ cắt mất lệnh thắng.</div>
      </div>
      <div class="card stat">
        <div class="label">Lệnh thua từng có lãi (MFE)</div>
        <div class="value">{{ pct(s.loserMfeShare[1].share) }} <small>có ≥ 1 ATR</small></div>
        <div class="sub">
          <span v-for="t in s.loserMfeShare" :key="t.at">≥ {{ t.at }} ATR: <b>{{ pct(t.share) }}</b> · </span>{{ s.losers }} lệnh thua
        </div>
        <div class="hint-text">→ Dời SL về hoà vốn sau khi lãi X ATR có thể cứu được tỷ lệ lệnh thua này.</div>
      </div>
      <div class="card stat">
        <div class="label">Lệnh thắng chốt được</div>
        <div class="value">{{ pct(s.winCapture) }} <small>đoạn giá tốt nhất</small></div>
        <div class="sub">Trung vị kết quả / MFE của {{ s.winners }} lệnh thắng</div>
        <div class="hint-text">→ Thấp nghĩa là TP / trailing nhả nhiều lợi nhuận.</div>
      </div>
    </div>

    <div v-if="ok.length" ref="root" class="card plot" @mouseleave="hover = null">
      <svg :width="width" :height="H" role="img" aria-label="Biểu đồ phân tán MAE và MFE của từng lệnh">
        <g class="grid">
          <line v-for="t in geo.yt" :key="'y' + t.v" :x1="M.left" :x2="M.left + geo.pw" :y1="t.y" :y2="t.y" />
          <line v-for="t in geo.xt" :key="'x' + t.v" :y1="M.top" :y2="M.top + geo.ph" :x1="t.x" :x2="t.x" />
        </g>
        <line class="p90" :x1="geo.p90x" :x2="geo.p90x" :y1="M.top" :y2="M.top + geo.ph" />
        <text class="p90-label" :x="geo.p90x + 4" :y="M.top + 10">90% lệnh thắng</text>
        <g class="tick">
          <text v-for="t in geo.yt" :key="'ty' + t.v" :x="M.left - 6" :y="t.y" dy="0.32em" text-anchor="end">{{ t.v }}</text>
          <text v-for="t in geo.xt" :key="'tx' + t.v" :x="t.x" :y="H - M.bottom + 14" text-anchor="middle">{{ t.v }}</text>
          <text :x="M.left + geo.pw / 2" :y="H - 4" text-anchor="middle">MAE — đi ngược tối đa (ATR)</text>
          <text :transform="`rotate(-90) translate(${-(M.top + geo.ph / 2)}, 12)`" text-anchor="middle">MFE — đi thuận tối đa (ATR)</text>
        </g>
        <circle v-for="(d, i) in geo.dots" :key="d.p.id" :cx="d.cx" :cy="d.cy" :r="hover === i ? 6 : 4"
          :class="d.x.win ? 'win' : 'loss'" @mouseenter="hover = i" />
      </svg>
      <div v-if="hovered" class="tip" :style="{ left: `${Math.min(hovered.cx + 12, width - 200)}px`, top: `${Math.max(hovered.cy - 30, 0)}px` }">
        <b :class="hovered.x.win ? 'pos' : 'neg'">{{ money(hovered.p.netProfit, { sign: true }) }} {{ currency }}</b>
        · {{ hovered.p.type === 'buy' ? 'Buy' : 'Sell' }} {{ fmt(hovered.p.openTime) }}<br />
        MAE {{ atr(hovered.x.maeAtr) }} · MFE {{ atr(hovered.x.mfeAtr) }}
      </div>
      <div class="legend"><span class="dot win" />Thắng <span class="dot loss" />Thua · đường dọc = MAE mà 90% lệnh thắng không vượt quá</div>
    </div>
    <p v-else class="empty">Cần nến {{ timeframe }} phủ thời gian giữ lệnh.</p>
  </section>
</template>

<style scoped>
.exc { margin-top: 22px; }
.head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
h2 { font-size: 14px; font-weight: 600; margin: 0; }
.muted { color: var(--muted); font-size: 12px; }
.cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.stat { border: 1px solid var(--border); padding: 12px 14px; }
.label { color: var(--muted); font-size: 12px; }
.value { font-size: 20px; font-weight: 600; margin: 4px 0; }
.value small { font-size: 12px; font-weight: 400; color: var(--muted); }
.sub { font-size: 12px; color: var(--muted); }
.sub b { color: var(--text); }
.hint-text { font-size: 11px; color: var(--faint); margin-top: 6px; }
.plot { position: relative; border: 1px solid var(--border); padding: 10px; }
svg { display: block; }
.grid line { stroke: #f0f1f3; }
.p90 { stroke: var(--accent); stroke-dasharray: 4 3; }
.p90-label { fill: var(--accent); font-size: 10px; }
.tick text { fill: var(--muted); font-size: 10px; }
circle { stroke: #fff; stroke-width: 1.5; cursor: default; }
circle.win, .dot.win { fill: var(--chart-pos); background: var(--chart-pos); }
circle.loss, .dot.loss { fill: var(--chart-neg); background: var(--chart-neg); }
.tip {
  position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
  padding: 6px 9px; font-size: 12px; box-shadow: 0 4px 14px rgba(20, 29, 34, .12); white-space: nowrap; color: var(--muted);
}
.legend { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.empty { color: var(--muted); text-align: center; padding: 20px 0; margin: 0; font-size: 13px; }
@media (max-width: 760px) { .cards { grid-template-columns: 1fr; } }
</style>
