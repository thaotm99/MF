<script setup lang="ts">
import type { DayExtreme, LosingStreak } from '../utils/trading-extremes-stats'
import { money } from '../utils/format'

/** Hàng thống kê phụ: ngày lãi / lỗ lớn nhất, chuỗi thua dài nhất — trong kỳ đã chọn. */
defineProps<{
  best?: DayExtreme
  worst?: DayExtreme
  streak: LosingStreak
  currency: string
  loading: boolean
}>()

/** "2026-10-01" → "01/10/2026" */
const fmtDay = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`
/** ISO giờ server → "01/10" (ngày đóng lệnh) */
const fmtShort = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
</script>

<template>
  <div class="strip" :class="{ dim: loading }">
    <div class="item">
      <div class="label">Ngày lãi lớn nhất</div>
      <template v-if="best">
        <div class="value pos">{{ money(best.pnl, { sign: true }) }} {{ currency }}</div>
        <div class="sub">{{ fmtDay(best.day) }} · {{ best.trades }} lệnh</div>
      </template>
      <div v-else class="value none">—</div>
    </div>

    <div class="item">
      <div class="label">Ngày lỗ lớn nhất</div>
      <template v-if="worst">
        <div class="value neg">{{ money(worst.pnl) }} {{ currency }}</div>
        <div class="sub">{{ fmtDay(worst.day) }} · {{ worst.trades }} lệnh</div>
      </template>
      <div v-else class="value none">—</div>
    </div>

    <div class="item">
      <div class="label">
        Thua liên tiếp nhiều nhất
      </div>
      <template v-if="streak.count">
        <div class="value">{{ streak.count }} lệnh</div>
        <div class="sub">
          <span class="neg">{{ money(streak.sum) }} {{ currency }}</span> ·
          {{ fmtShort(streak.from) }}{{ fmtShort(streak.from) !== fmtShort(streak.to) ? ` – ${fmtShort(streak.to)}` : '' }}
        </div>
      </template>
      <div v-else class="value none">0 lệnh</div>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px;
  margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); transition: opacity .2s;
}
.dim { opacity: .55; }
.label { color: var(--muted); font-size: 13px; }
.value { font-size: 17px; font-weight: 600; margin: 4px 0 2px; white-space: nowrap; }
.value.none { color: var(--faint); }
.sub { color: var(--muted); font-size: 12px; }
@media (max-width: 640px) { .strip { grid-template-columns: 1fr; gap: 14px; } }
</style>
