<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTradeJournalStore } from '../stores/trade-journal'
import { money } from '../utils/format'
import { PATTERN_LABEL, TREND_LABEL, type EvaluationOptions, type TradeEvaluation } from '../utils/trade-evaluation'
import type { ExitEvaluation } from '../utils/trade-exit-evaluation'
import type { Excursion } from '../utils/trade-excursion'
import { UNTAGGED } from '../utils/trade-journal-stats'
import TradeJournalEditor from './TradeJournalEditor.vue'

/** Danh sách từng lệnh kèm bối cảnh price action lúc vào lệnh */
const props = defineProps<{
  evals: TradeEvaluation[]
  exits: Map<string, ExitEvaluation>
  excursions: Map<string, Excursion>
  currency: string
  options: EvaluationOptions
}>()
const emit = defineEmits<{ show: [positionId: string] }>()

const journal = useTradeJournalStore()
onMounted(() => void journal.ensureLoaded())
const tagsOf = (id: string) => journal.entries[id]?.tags ?? []

const result = ref<'all' | 'win' | 'loss'>('all')
/** Lọc theo nhãn: '' = tất cả, UNTAGGED = chưa gắn nhãn */
const tag = ref('')
const PAGE = 40
const shown = ref(PAGE)
const rows = computed(() =>
  props.evals
    .filter((e) => result.value === 'all' || (result.value === 'win') === e.win)
    .filter((e) => {
      if (!tag.value) return true
      const tags = tagsOf(e.position.id)
      return tag.value === UNTAGGED ? !tags.length : tags.includes(tag.value)
    })
    .sort((a, b) => b.position.openTime.localeCompare(a.position.openTime)),
)
watch([result, tag, () => props.evals], () => (shown.value = PAGE))
/** Dòng đang mở trình sửa nhãn / ghi chú */
const editing = ref<string | null>(null)
const COLS = 13

const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
const alignLabel = (e: TradeEvaluation) => (e.alignment === 'with' ? 'Thuận' : e.alignment === 'against' ? 'Ngược' : 'Sideway')
/** Tóm tắt N nến trước khi đóng: "Quay đầu · 1/5 thuận · trả 1.2" */
const exitShort = (x?: ExitEvaluation) =>
  !x || !x.ok ? '—' : `${x.momentum === 'with' ? 'Chạy thuận' : x.momentum === 'against' ? 'Quay đầu' : 'Đi ngang'} · ${x.favor}/${x.bars} thuận · trả ${x.givebackAtr.toFixed(1)}`
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
      <select v-model="tag" class="select small" aria-label="Lọc theo nhãn">
        <option value="">Mọi nhãn</option>
        <option v-for="t in journal.allTags" :key="t" :value="t">{{ t }}</option>
        <option :value="UNTAGGED">{{ UNTAGGED }}</option>
      </select>
      <span class="muted">{{ rows.length }} lệnh</span>
    </div>
    <div class="wrap">
      <table v-if="rows.length">
        <thead>
          <tr>
            <th>Vào lúc</th><th>Chiều</th><th class="r">Lãi/Lỗ</th><th>Cấu trúc</th><th>Thuận/Ngược</th>
            <th>Vị trí</th><th class="r">Cản (ATR)</th><th>Nến trước</th><th>Trước khi đóng</th><th class="r">MAE / MFE</th><th>Nhãn</th><th>Mô tả</th><th />
          </tr>
        </thead>
        <tbody>
          <template v-for="e in rows.slice(0, shown)" :key="e.position.id">
          <tr>
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
            </template>
            <td v-else colspan="5" class="muted">{{ e.summary }}</td>
            <td :class="{ neg: exits.get(e.position.id)?.momentum === 'against' }">{{ exitShort(exits.get(e.position.id)) }}</td>
            <td class="r num">
              <template v-if="excursions.get(e.position.id)?.ok">
                {{ excursions.get(e.position.id)!.maeAtr.toFixed(1) }} / {{ excursions.get(e.position.id)!.mfeAtr.toFixed(1) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="tags-cell">
              <button type="button" class="tag-btn" :aria-expanded="editing === e.position.id"
                :title="journal.entries[e.position.id]?.note || 'Gắn nhãn / ghi chú'"
                @click="editing = editing === e.position.id ? null : e.position.id">
                <span v-for="t in tagsOf(e.position.id)" :key="t" class="chip">{{ t }}</span>
                <span v-if="journal.entries[e.position.id]?.note" class="chip note">✎</span>
                <span v-if="!journal.entries[e.position.id]" class="add">+ nhãn</span>
              </button>
            </td>
            <td class="desc">
              <template v-if="e.ok">Vào: {{ e.summary }}.</template>
              <template v-if="exits.get(e.position.id)?.ok"> Trước khi đóng: {{ exits.get(e.position.id)!.summary }}.</template>
            </td>
            <td><button type="button" class="link" @click="emit('show', e.position.id)">Xem trên chart</button></td>
          </tr>
          <tr v-if="editing === e.position.id" class="editor-row">
            <td :colspan="COLS"><TradeJournalEditor :position="e.position" compact /></td>
          </tr>
          </template>
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
.select.small { min-height: 30px; padding: 3px 8px; font-size: 12px; }
.tags-cell { white-space: normal; min-width: 120px; }
.tag-btn { border: 0; background: none; padding: 0; text-align: left; display: flex; flex-wrap: wrap; gap: 3px; cursor: pointer; }
.chip { background: #eef2ff; color: var(--text); border-radius: 4px; padding: 1px 6px; font-size: 11px; }
.chip.note { background: #f1f3f5; }
.add { color: var(--faint); font-size: 11px; }
.editor-row td { background: var(--bg, #fafbfc); padding: 10px 12px; }
.empty { color: var(--muted); text-align: center; padding: 20px 0; margin: 0; }
.more { margin: 10px auto 0; display: block; }
</style>
