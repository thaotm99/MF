<script setup lang="ts">
import type { Summary } from '../utils/stats'
import { int, money, splitMoney } from '../utils/format'

import { computed } from 'vue'

const props = defineProps<{
  summary: Summary
  equity: number
  currency: string
  loading: boolean
  /** Lãi/lỗ ròng của các lệnh đóng hôm nay (không phụ thuộc kỳ đã chọn) */
  todayPnl: number
  todayTrades: number
  /** Ngày hôm nay, dạng dd/mm */
  todayLabel: string
}>()

/** Tỷ lệ chiến thắng = lệnh có lãi (profit ≥ 0, như MT5) / lệnh đã đóng */
/** Màu chữ theo dấu: dương xanh, âm đỏ, 0 giữ màu thường */
const signClass = (v: number) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '')

const winRate = computed(() =>
  props.summary.closedOrders ? (props.summary.profitable / props.summary.closedOrders) * 100 : 0,
)
</script>

<template>
  <div class="grid" :class="{ dim: loading }">
    <div class="col">
      <div class="label">Lợi nhuận ròng</div>
      <div class="big" :class="signClass(summary.netProfit)">
        {{ splitMoney(summary.netProfit).int }}<small>{{ splitMoney(summary.netProfit).frac }}</small> {{ currency }}
      </div>
      <ul>
        <li>
          Lợi nhuận hôm nay ({{ todayLabel }})
          <b :class="todayPnl > 0 ? 'pos' : todayPnl < 0 ? 'neg' : ''">{{ money(todayPnl, { sign: true }) }} {{ currency }}</b>
        </li>
        <li>Lãi <b :class="signClass(summary.profit)">{{ money(summary.profit, { sign: true }) }} {{ currency }}</b></li>
        <li>Lỗ <b :class="signClass(summary.loss)">{{ money(summary.loss) }} {{ currency }}</b></li>
      </ul>
    </div>

    <div class="col">
      <div class="label">Lệnh đã đóng</div>
      <div class="big">{{ int(summary.closedOrders) }}</div>
      <ul>
        <li>
          Tỷ lệ chiến thắng <b>{{ winRate.toFixed(1) }}%</b>
        </li>
        <li>Có lãi <b>{{ int(summary.profitable) }}</b></li>
        <li>Thua lỗ <b>{{ int(summary.unprofitable) }}</b></li>
      </ul>
    </div>

    <div class="col">
      <div class="label">
        Khối lượng giao dịch
      </div>
      <div class="big">
        {{ splitMoney(summary.volume).int }}<small>{{ splitMoney(summary.volume).frac }}</small> {{ currency }}
      </div>
      <ul>
        <li>Số lot <b>{{ money(summary.volumeLots) }}</b></li>
        <li v-if="summary.volumeUnconverted" class="warn">
          {{ int(summary.volumeUnconverted) }} deal không quy đổi được sang {{ currency }}
        </li>
      </ul>
    </div>

    <div class="col">
      <div class="label">Equity</div>
      <div class="big">{{ splitMoney(equity).int }}<small>{{ splitMoney(equity).frac }}</small> {{ currency }}</div>
      <ul>
        <li>Hiện tại <b>{{ money(equity) }} {{ currency }}</b></li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; transition: opacity .2s; }
.dim { opacity: .55; }
.label { color: var(--muted); font-size: 13px; }
.big { font-size: 20px; font-weight: 600; margin: 4px 0 40px; white-space: nowrap; }
.big small { font-size: 15px; font-weight: 600; }
.big.pos { color: var(--pos); }
.big.neg { color: var(--neg); }
ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; color: var(--muted); font-size: 13px; }
b { color: var(--text); font-weight: 500; }
b.pos { color: var(--pos); }
b.neg { color: var(--neg); }
.warn { color: #9a6b00; }
@media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .big { margin-bottom: 16px; } }
@media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
</style>
