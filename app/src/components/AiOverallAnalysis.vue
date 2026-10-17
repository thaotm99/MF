<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getSavedOverall, listSavedOverall, type AiOverallAnalysis } from '../api/ai-analysis-client'
import { useAiAnalysisRun } from '../composables/use-ai-analysis-run'
import { useDashboardData } from '../composables/use-dashboard-data'
import { useTradeAutoTags } from '../composables/use-trade-auto-tags'
import { useFiltersStore } from '../stores/filters'
import { useTradeJournalStore } from '../stores/trade-journal'
import { buildOverallRows, buildOverallSummary } from '../utils/ai-overall-rows'
import AiMarkdownResult from './AiMarkdownResult.vue'

/**
 * Phân tích AI tổng thể: toàn bộ lệnh của 1 tài khoản trong kỳ đang chọn → Claude Code đọc bảng lệnh + code bot,
 * mô tả các kiểu lệnh thắng / thua lặp lại, dấu hiệu chạy sai code, ticket nên xem lại (định tính, không tối ưu tham số).
 */
const { accounts, positions, currency } = useDashboardData()
const { range } = storeToRefs(useFiltersStore())
const journal = useTradeJournalStore()
const { tags, details, loading: candlesLoading, used } = useTradeAutoTags(positions)

const account = computed(() => (accounts.value.length === 1 ? accounts.value[0] : undefined))
const fmtDay = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`
const period = computed(() => `${fmtDay(range.value.start)} – ${fmtDay(range.value.end)}`)
const analysisId = computed(() => (account.value ? `${account.value.login}-${range.value.start.replace(/-/g, '')}-${range.value.end.replace(/-/g, '')}` : ''))
const withCandles = computed(() => positions.value.filter((p) => details.value.has(p.id)).length)

const saved = ref<AiOverallAnalysis | null>(null)
const history = ref<Omit<AiOverallAnalysis, 'markdown'>[]>([])
const question = ref('')
const run = useAiAnalysisRun<AiOverallAnalysis>()
const { state, error, live, steps, botFile } = run

async function refreshHistory() {
  try {
    history.value = (await listSavedOverall()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    history.value = []
  }
}
async function open(id: string) {
  try {
    saved.value = await getSavedOverall(id)
  } catch {
    saved.value = null
  }
}
watch(analysisId, (id) => {
  run.stop()
  saved.value = null
  if (id) void open(id)
}, { immediate: true })
onMounted(() => {
  void journal.ensureLoaded()
  void refreshHistory()
})

function start() {
  const a = account.value
  if (!a || !positions.value.length) return
  const u = used.value[0]
  const rows = buildOverallRows(positions.value.map((p) => ({
    p, ...details.value.get(p.id), autoTags: tags.value.get(p.id), journal: journal.entries[p.id],
  })))
  const summary = buildOverallSummary({
    accountLabel: a.label, login: a.login, server: a.server, currency: currency.value, period: period.value,
    positions: positions.value, entryTf: u?.entry, exitTf: u?.exit, candleCount: withCandles.value,
  })
  const body = { id: analysisId.value, accountLabel: a.label, period: period.value, tradeCount: positions.value.length, summary, rows, question: question.value || undefined }
  void run.start('/__ai-analyze-all', body, (s) => {
    saved.value = s
    void refreshHistory()
  })
}
const fmtTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="overall">
    <p v-if="!account" class="alert">Chọn <b>một</b> tài khoản ở bộ lọc phía trên — mỗi tài khoản ứng với một bot (MF_xx).</p>
    <template v-else>
      <div class="card box">
        <div class="head">
          <div>
            <h3>{{ account.label }} · {{ period }}</h3>
            <p class="muted">
              {{ positions.length }} lệnh đóng trong kỳ ·
              <template v-if="candlesLoading">đang đọc nến…</template>
              <template v-else-if="used.length">{{ withCandles }} lệnh có bối cảnh nến ({{ used[0].entry }} / {{ used[0].exit }})</template>
              <template v-else>chưa có file nến — AI chỉ thấy dữ liệu lệnh</template>
            </p>
          </div>
          <div class="actions">
            <button v-if="state !== 'running'" type="button" class="btn primary" :disabled="!positions.length || candlesLoading" @click="start">
              {{ saved ? 'Phân tích lại' : `Phân tích ${positions.length} lệnh bằng AI` }}
            </button>
            <button v-else type="button" class="btn" @click="run.stop">Dừng</button>
          </div>
        </div>
        <textarea v-if="state !== 'running'" v-model="question" rows="2" maxlength="2000"
          placeholder="Câu hỏi / trọng tâm (tuỳ chọn), ví dụ: tập trung vào các lệnh thua liên tiếp trong phiên Á" aria-label="Câu hỏi thêm cho AI" />
        <p class="hint">
          AI (Claude Code trên máy này) đọc bảng toàn bộ lệnh + code bot, mô tả các kiểu lệnh thắng / thua lặp lại, dấu hiệu bot chạy sai code
          và ticket nên xem lại — phân tích định tính, <b>không</b> đưa tham số tối ưu từ dữ liệu lịch sử. Bấm #ticket để mở lệnh trên Chart giá.
          Mất khoảng 1–5 phút, tính vào giới hạn gói Claude.
        </p>
      </div>

      <div v-if="state === 'running'" class="card box progress" aria-live="polite">
        <span class="spinner" aria-hidden="true" /> Đang phân tích<template v-if="botFile"> · bot: <code>{{ botFile }}</code></template>…
        <ul v-if="steps.length" class="steps"><li v-for="(s, k) in steps" :key="k">{{ s }}</li></ul>
      </div>
      <p v-if="state === 'error'" class="alert error">{{ error }}</p>

      <div v-if="state === 'running' ? live : saved" class="card box">
        <AiMarkdownResult :markdown="state === 'running' ? live : saved!.markdown" />
        <p v-if="saved && state !== 'running'" class="meta">
          {{ fmtTime(saved.createdAt) }} · {{ saved.tradeCount }} lệnh
          <template v-if="saved.botFile"> · đối chiếu {{ saved.botFile }}</template><template v-else> · chưa xác định được file bot</template>
          <template v-if="saved.question"> · trọng tâm: “{{ saved.question }}”</template> · ý kiến tham khảo, AI có thể sai
        </p>
      </div>
    </template>

    <div v-if="history.length" class="card box">
      <h3>Đã phân tích</h3>
      <ul class="history">
        <li v-for="h in history" :key="h.id">
          <button type="button" class="link" :class="{ on: saved?.id === h.id }" @click="open(h.id)">{{ h.accountLabel }} · {{ h.period }}</button>
          <span class="muted">{{ h.tradeCount }} lệnh · {{ fmtTime(h.createdAt) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.overall { display: flex; flex-direction: column; gap: 12px; }
.box { border: 1px solid var(--border); padding: 14px 16px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
h3 { margin: 0 0 2px; font-size: 14px; }
.muted { color: var(--muted); font-size: 12px; margin: 0; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn:disabled { opacity: .5; cursor: default; }
textarea { width: 100%; box-sizing: border-box; margin-top: 10px; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; font-size: 13px; background: var(--surface); color: var(--text); }
.hint { color: var(--faint); font-size: 11px; margin: 8px 0 0; line-height: 1.5; }
.progress { font-size: 12px; color: var(--muted); }
.steps { margin: 6px 0 0; padding-left: 18px; max-height: 120px; overflow-y: auto; }
.spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: -1px; }
@keyframes spin { to { transform: rotate(360deg); } }
.meta { color: var(--faint); font-size: 11px; margin: 10px 0 0; }
.history { list-style: none; margin: 6px 0 0; padding: 0; font-size: 13px; }
.history li { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid var(--border); }
.link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; cursor: pointer; }
.link.on { font-weight: 600; }
.alert.error { white-space: pre-wrap; }
</style>
