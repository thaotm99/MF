<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import { useTradeJournalStore } from '../stores/trade-journal'
import type { AutoTag } from '../utils/trade-auto-tags'
import { money } from '../utils/format'
import TradeTagChips from './TradeTagChips.vue'

/** Danh sách lệnh của mã đang xem trên chart; bấm một dòng để zoom tới lệnh đó. */
const props = defineProps<{ trades: Mt5Position[]; currency: string; selectedId?: string; autoTags?: Map<string, AutoTag[]> }>()
const journal = useTradeJournalStore()
const emit = defineEmits<{ select: [p: Mt5Position] }>()

const PAGE = 30
const shown = ref(PAGE)
watch(() => props.trades.length, () => (shown.value = PAGE))
const rows = computed(() => props.trades.slice(0, shown.value))

/** ISO giờ server → "16/10 04:20" */
const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
</script>

<template>
  <div class="list">
    <table v-if="trades.length">
      <thead>
        <tr>
          <th>Vào lúc</th><th>Chiều</th><th class="r">Lot</th><th class="r">Giá vào</th>
          <th>Ra lúc</th><th class="r">Giá ra</th><th class="r">Lãi/Lỗ</th><th>Nhãn</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id" :class="{ sel: p.id === selectedId }" tabindex="0"
          @click="emit('select', p)" @keydown.enter="emit('select', p)">
          <td>{{ fmt(p.openTime) }}</td>
          <td>{{ p.type === 'buy' ? 'Buy' : 'Sell' }}</td>
          <td class="r">{{ p.volume }}</td>
          <td class="r">{{ p.openPrice }}</td>
          <td>{{ fmt(p.closeTime) }}</td>
          <td class="r">{{ p.closePrice }}</td>
          <td class="r" :class="p.netProfit >= 0 ? 'pos' : 'neg'">{{ money(p.netProfit, { sign: true }) }} {{ currency }}</td>
          <td class="tags"><TradeTagChips :auto="autoTags?.get(p.id)" :manual="journal.entries[p.id]?.tags" :note="!!journal.entries[p.id]?.note" /></td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">Không có lệnh của mã này trong kỳ đã chọn.</p>
    <button v-if="trades.length > shown" class="btn more" type="button" @click="shown += PAGE">
      Xem thêm ({{ trades.length - shown }} còn lại)
    </button>
  </div>
</template>

<style scoped>
.list { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 7px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; font-variant-numeric: tabular-nums; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #f7f8fa; }
tbody tr.sel { background: #eef4ff; }
tbody tr:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.r { text-align: right; }
td.tags { white-space: normal; min-width: 160px; }
.empty { color: var(--muted); text-align: center; padding: 20px 0; margin: 0; font-size: 13px; }
.more { margin: 10px auto 0; display: block; }
</style>
