<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getSavedAnalysis, runAnalysis, type AiAnalysis } from '../api/ai-analysis-client'
import { renderMarkdown } from '../utils/simple-markdown'

/**
 * Phân tích một lệnh bằng Claude Code chạy trên máy (đọc code EA của bot + dữ liệu lệnh).
 * Kết quả lưu ở app/ai-analyses/, mở lại không phải chạy lại.
 */
const props = defineProps<{ positionId: string; accountLabel: string; buildContext: () => string }>()

const saved = ref<AiAnalysis | null>(null)
const state = ref<'idle' | 'running' | 'error'>('idle')
const error = ref('')
const live = ref('')
const steps = ref<string[]>([])
const botFile = ref<string | null>(null)
const question = ref('')
const askOpen = ref(false)
let ctrl: AbortController | null = null

watch(() => props.positionId, async (id) => {
  ctrl?.abort()
  state.value = 'idle'
  saved.value = null
  live.value = ''
  error.value = ''
  try {
    const s = await getSavedAnalysis(id)
    if (id === props.positionId) saved.value = s
  } catch {
    // chưa có
  }
}, { immediate: true })
onBeforeUnmount(() => ctrl?.abort())

const STEP_LABEL: Record<string, string> = { Read: 'Đọc', Grep: 'Tìm trong', Glob: 'Liệt kê' }
async function start() {
  ctrl?.abort()
  ctrl = new AbortController()
  state.value = 'running'
  error.value = ''
  live.value = ''
  steps.value = []
  botFile.value = null
  const id = props.positionId
  try {
    await runAnalysis({ positionId: id, accountLabel: props.accountLabel, context: props.buildContext(), question: question.value || undefined }, (e) => {
      if (id !== props.positionId) return
      if (e.kind === 'meta') botFile.value = e.botFile
      else if (e.kind === 'tool') steps.value.push(`${STEP_LABEL[e.name] ?? e.name} ${e.target.replace(/^.*?\/mf\//, '')}`.trim())
      else if (e.kind === 'text') live.value += e.text
      else if (e.kind === 'done') {
        saved.value = e
        state.value = 'idle'
        askOpen.value = false
      } else if (e.kind === 'error') {
        error.value = e.message
        state.value = 'error'
      }
    }, ctrl.signal)
    if (state.value === 'running') state.value = 'idle'
  } catch (e) {
    if ((e as Error).name === 'AbortError') state.value = 'idle'
    else {
      error.value = e instanceof Error ? e.message : String(e)
      state.value = 'error'
    }
  }
}
const stop = () => {
  ctrl?.abort()
  state.value = 'idle'
}

const html = computed(() => renderMarkdown(state.value === 'running' ? live.value : (saved.value?.markdown ?? '')))
const fmtTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <section class="ai">
    <div class="ai-head">
      <h4>Phân tích bằng AI <small>Claude Code trên máy này · đọc code bot + dữ liệu lệnh</small></h4>
      <div class="actions">
        <button v-if="state !== 'running'" type="button" class="btn small ghost" @click="askOpen = !askOpen">{{ askOpen ? 'Ẩn câu hỏi' : '+ Câu hỏi' }}</button>
        <button v-if="state !== 'running'" type="button" class="btn small primary" @click="start">{{ saved ? 'Phân tích lại' : 'Phân tích bằng AI' }}</button>
        <button v-else type="button" class="btn small" @click="stop">Dừng</button>
      </div>
    </div>
    <textarea v-if="askOpen && state !== 'running'" v-model="question" rows="2" maxlength="1000"
      placeholder="Câu hỏi thêm (tuỳ chọn), ví dụ: vì sao bot không đóng lệnh khi Coral M1 đảo chiều?" aria-label="Câu hỏi thêm cho AI" />

    <div v-if="state === 'running'" class="progress" aria-live="polite">
      <span class="spinner" aria-hidden="true" /> Đang phân tích<template v-if="botFile"> · bot: <code>{{ botFile }}</code></template>…
      <ul v-if="steps.length" class="steps"><li v-for="(s, k) in steps" :key="k">{{ s }}</li></ul>
    </div>
    <p v-if="state === 'error'" class="err">{{ error }}</p>
    <!-- Markdown đã escape toàn bộ, chỉ tạo lại vài thẻ định dạng (simple-markdown.ts) -->
    <div v-if="html" class="md" v-html="html" />
    <p v-if="saved && state !== 'running'" class="meta">
      {{ fmtTime(saved.createdAt) }}<template v-if="saved.botFile"> · đối chiếu {{ saved.botFile }}</template><template v-else> · chưa xác định được file bot</template>
      <template v-if="saved.question"> · hỏi: “{{ saved.question }}”</template>
      · ý kiến tham khảo, AI có thể sai
    </p>
    <p v-if="!saved && state === 'idle'" class="hint">Bot được xác định theo tên tài khoản (MF_xx → test/…MFxx….mq5). Mỗi lần mất khoảng 10–60 giây và tính vào giới hạn gói Claude của bạn.</p>
  </section>
</template>

<style scoped>
.ai { border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px; }
.ai-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
h4 { margin: 0; font-size: 13px; }
h4 small { font-weight: 400; color: var(--muted); font-size: 11px; margin-left: 6px; }
.actions { display: flex; gap: 6px; }
.btn.small { min-height: 30px; padding: 4px 10px; font-size: 12px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.ghost { background: none; }
textarea { width: 100%; box-sizing: border-box; margin-top: 8px; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; font-size: 13px; background: var(--surface); color: var(--text); }
.progress { font-size: 12px; color: var(--muted); margin-top: 8px; }
.steps { margin: 4px 0 0; padding-left: 18px; max-height: 96px; overflow-y: auto; }
.spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: -1px; }
@keyframes spin { to { transform: rotate(360deg); } }
.err { color: var(--neg); font-size: 12px; white-space: pre-wrap; }
.md { font-size: 13px; line-height: 1.55; margin-top: 8px; }
.md :deep(h2), .md :deep(h3), .md :deep(h4) { font-size: 13px; margin: 12px 0 4px; }
.md :deep(p) { margin: 4px 0; }
.md :deep(ul), .md :deep(ol) { margin: 4px 0; padding-left: 20px; }
.md :deep(code) { background: var(--bg); padding: 1px 4px; border-radius: 4px; font-size: 12px; }
.md :deep(pre) { background: var(--bg); padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
.meta, .hint { color: var(--faint); font-size: 11px; margin: 8px 0 0; }
</style>
