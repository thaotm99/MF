<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AccountDeal } from '../utils/stats'
import { closeProfit, dealCost } from '../utils/stats'
import { money } from '../utils/format'

const props = defineProps<{ deals: AccountDeal[]; from: number; to: number; showAccount: boolean }>()
const PAGE = 50
const shown = ref(PAGE)

const rows = computed(() =>
  props.deals
    .filter((d) => d.deal.type === 'close')
    .filter((d) => {
      const t = Date.parse(d.deal.create_time)
      return t >= props.from && t < props.to
    })
    .sort((a, b) => Date.parse(b.deal.create_time) - Date.parse(a.deal.create_time)),
)
watch(() => [props.from, props.to, props.deals.length], () => (shown.value = PAGE))

const fmtTime = (s: string) =>
  new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
</script>

<template>
  <div class="wrap">
    <table v-if="rows.length">
      <thead>
        <tr>
          <th>Thời gian đóng</th>
          <th v-if="showAccount">Tài khoản</th>
          <th>Mã</th>
          <th>Chiều deal</th>
          <th class="r">Lot</th>
          <th class="r">Giá đóng</th>
          <th class="r">Phí</th>
          <th class="r">Lãi/Lỗ</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows.slice(0, shown)" :key="r.accountKey + r.deal.deal_id">
          <td>{{ fmtTime(r.deal.create_time) }}</td>
          <td v-if="showAccount">#{{ r.accountId }}</td>
          <td>{{ r.deal.instrument }}</td>
          <td>{{ r.deal.direction === 'buy' ? 'Buy' : r.deal.direction === 'sell' ? 'Sell' : '' }}</td>
          <td class="r">{{ r.deal.volume }}</td>
          <td class="r">{{ r.deal.price }}</td>
          <td class="r">{{ money(dealCost(r.deal)) }}</td>
          <td class="r" :class="closeProfit(r.deal) >= 0 ? 'pos' : 'neg'">
            {{ money(closeProfit(r.deal), { sign: true }) }} {{ r.currency }}
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">Không có giao dịch đã đóng trong kỳ này.</p>
    <button v-if="rows.length > shown" class="btn more" @click="shown += PAGE">
      Xem thêm ({{ rows.length - shown }} còn lại)
    </button>
  </div>
</template>

<style scoped>
.wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px; border-bottom: 1px solid var(--border); }
td { padding: 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.r { text-align: right; }
.empty { color: var(--muted); text-align: center; padding: 32px 0; }
.more { margin: 12px auto 0; display: block; }
</style>
