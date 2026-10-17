<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { AiThreadItem } from '../api/ai-analysis-client'
import { useAiAnalysisRun } from '../composables/use-ai-analysis-run'
import AiMarkdownResult from './AiMarkdownResult.vue'

/**
 * Hỏi tiếp trong cùng session Claude Code của bản phân tích (claude --resume): AI còn nhớ code bot và dữ liệu đã đọc.
 * Câu hỏi + trả lời được nối vào file đã lưu; emit 'updated' với bản lưu mới.
 */
const props = defineProps<{ kind: 'trade' | 'overall'; id: string; thread: AiThreadItem[]; hasSession: boolean }>()
const emit = defineEmits<{ updated: [saved: { thread?: AiThreadItem[] }] }>()

const question = ref('')
const asking = ref('')
const run = useAiAnalysisRun<{ thread?: AiThreadItem[] }>()
const { state, error, live, steps } = run
const box = ref<HTMLTextAreaElement | null>(null)

function send() {
  const q = question.value.trim()
  if (!q || state.value === 'running') return
  asking.value = q
  void run.start('/__ai-followup', { kind: props.kind, id: props.id, question: q }, (saved) => {
    question.value = ''
    asking.value = ''
    emit('updated', saved)
    void nextTick(() => box.value?.focus())
  })
}
function onKey(e: KeyboardEvent) {
  // Ctrl/Cmd + Enter để gửi
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    send()
  }
}
const fmtTime = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="thread">
    <div v-for="(t, k) in thread" :key="k" class="turn">
      <p class="q"><span class="who">Bạn</span>{{ t.question }} <span class="time">{{ fmtTime(t.createdAt) }}</span></p>
      <AiMarkdownResult class="a" :markdown="t.markdown" />
    </div>
    <div v-if="state === 'running'" class="turn">
      <p class="q"><span class="who">Bạn</span>{{ asking }}</p>
      <p class="progress"><span class="spinner" aria-hidden="true" /> Đang trả lời…<template v-if="steps.length"> · {{ steps[steps.length - 1] }}</template></p>
      <AiMarkdownResult v-if="live" class="a" :markdown="live" />
    </div>
    <p v-if="state === 'error'" class="err">{{ error }}</p>

    <p v-if="!hasSession" class="hint">Bản phân tích này tạo trước khi có "Hỏi tiếp" — bấm "Phân tích lại" để hỏi tiếp được.</p>
    <div v-else class="ask">
      <textarea ref="box" v-model="question" rows="2" maxlength="2000" :disabled="state === 'running'"
        placeholder="Hỏi tiếp (AI nhớ code bot và dữ liệu đã đọc)… Ctrl + Enter để gửi" aria-label="Hỏi tiếp AI" @keydown="onKey" />
      <button v-if="state !== 'running'" type="button" class="btn small primary" :disabled="!question.trim()" @click="send">Gửi</button>
      <button v-else type="button" class="btn small" @click="run.stop">Dừng</button>
    </div>
  </div>
</template>

<style scoped>
.thread { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 8px; }
.turn { margin: 8px 0 12px; }
.q { margin: 0 0 6px; font-size: 13px; background: var(--bg); border-radius: 6px; padding: 6px 10px; white-space: pre-wrap; }
.who { font-weight: 600; margin-right: 8px; color: var(--accent); }
.time { color: var(--faint); font-size: 11px; margin-left: 6px; }
.a { padding-left: 2px; }
.progress { font-size: 12px; color: var(--muted); margin: 4px 0; }
.spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; vertical-align: -1px; }
@keyframes spin { to { transform: rotate(360deg); } }
.err { color: var(--neg); font-size: 12px; white-space: pre-wrap; }
.hint { color: var(--faint); font-size: 11px; margin: 6px 0 0; }
.ask { display: flex; gap: 8px; align-items: flex-end; }
textarea { flex: 1; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; font-size: 13px; background: var(--surface); color: var(--text); resize: vertical; }
.btn.small { min-height: 32px; padding: 4px 12px; font-size: 12px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn:disabled { opacity: .5; cursor: default; }
</style>
