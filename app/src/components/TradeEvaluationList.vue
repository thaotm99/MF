<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { money } from '../utils/format'
import { PATTERN_LABEL, TREND_LABEL, type EvaluationOptions, type TradeEvaluation } from '../utils/trade-evaluation'

/** Danh sách từng lệnh kèm bối cảnh price action lúc vào lệnh */
const props = defineProps<{ evals: TradeEvaluation[]; currency: string; options: EvaluationOptions }>()
const emit = defineEmits<{ show: [positionId: string] }>()

const result = ref<'all' | 'win' | 'loss'>('all')
const PAGE = 40
const shown = ref(PAGE)
const rows = computed(() =>
  props.evals
    .filter((e) => result.value === 'all' || (result.value === 'win') === e.win)
    .sort((a, b) => b.position.openTime.localeCompare(a.position.openTime)),
)
watch([result, () => props.evals], () => (shown.value = PAGE))

const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
const alignLabel = (e: TradeEvaluation) => (e.alignment === 'with' ? 'Thuận' : e.alignment === 'against' ? 'Ngược' : 'Sideway')
const zone = (pos?: number) => (pos === undefined ? '—' : pos < 1 / 3 ? 'Thấp' : pos > 2 / 3 ? 'Cao' : 'Giữa')
</script>

<template>
  <div>
    <div class="bar">
      <h3>Từng lệnh</h3>
      <div class="seg" role="radiogroup" aria-label="Kết quả lệnh">
        <button v-for="o in ([['all', 'Tất cả'], ['win', 'Thắng'], ['loss', 'Thua']] as const)" :key="o[0]" type="button"
          role="radio" :aria-checked="result === o[0]" :class="{ on: result === o[0] }" @click="result = o[0]">{{ o[1] }}</button>
      </div>
      <span class="muted">{{ rows.length }} lệnh</span>
    </div>
    <div class="wrap">
      <table v-if="rows.length">
        <thead>
          <tr>
            <th>Vào lúc</th><th>Chiều</th><th class="r">Lãi/Lỗ</th><th>Cấu trúc</th><th>Thuận/Ngược</th>
            <th>Vị trí</th><th class="r">Cản (ATR)</th><th>Nến trước</th><th>Mô tả</th><th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in rows.slice(0, shown)" :key="e.position.id">
            <td>{{ fmt(e.position.openTime) }}</td>
            <td>{{ e.position.type === 'buy' ? 'Buy' : 'Sell' }}</td>
            <td class="r num" :class="e.win ? 'pos' : 'neg'">{{ money(e.position.netProfit, { sign: true }) }} {{ currency }}</td>
            <template v-if="e.ok">
              <td>{{ TREND_LABEL[e.trend!] }}</td>
              <td :class="{ neg: e.alignment === 'against' }">{{ alignLabel(e) }}</td>
              <td>{{ zone(e.rangePos) }} <span class="muted">{{ Math.round((e.rangePos ?? 0) * 100) }}%</span></td>
              <td class="r num" :class="{ neg: e.levelDistAtr !== undefined && e.levelDistAtr < options.nearLevelAtr }">
                {{ e.levelDistAtr === undefined ? '—' : e.levelDistAtr.toFixed(1) }}
              </td>
              <td>{{ PATTERN_LABEL[e.pattern!] }}<span v-if="e.patternAgree === 'against'" class="neg"> · ngược</span></td>
              <td class="desc">{{ e.summary }}</td>
            </template>
            <td v-else colspan="6" class="muted">{{ e.summary }}</td>
            <td><button type="button" class="link" @click="emit('show', e.position.id)">Xem trên chart</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Không có lệnh.</p>
    </div>
    <button v-if="rows.length > shown" class="btn more" type="button" @click="shown += PAGE">
      Xem thêm ({{ rows.length - shown }} còn lại)
    </button>
  </div>
</template>

<style scoped>
.bar { display: flex; align-items: center; gap: 10px; margin: 18px 0 8px; flex-wrap: wrap; }
h3 { margin: 0; font-size: 14px; font-weight: 600; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); padding: 5px 10px; color: var(--muted); font-size: 12px; font-weight: 500; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.on { background: var(--accent); color: #fff; }
.muted { color: var(--muted); font-size: 12px; }
.wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td.desc { white-space: normal; min-width: 280px; color: var(--muted); }
.r { text-align: right; }
.num { font-variant-numeric: tabular-nums; }
.link { border: 0; background: none; color: var(--accent); padding: 0; font-size: 12px; white-space: nowrap; }
.empty { color: var(--muted); text-align: center; padding: 20px 0; margin: 0; }
.more { margin: 10px auto 0; display: block; }
</style>
