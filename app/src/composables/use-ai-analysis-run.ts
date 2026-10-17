import { onBeforeUnmount, ref } from 'vue'
import { runAnalysis, type AiEvent } from '../api/ai-analysis-client'

const STEP_LABEL: Record<string, string> = { Read: 'Đọc', Grep: 'Tìm trong', Glob: 'Liệt kê' }

/** Trạng thái một lượt phân tích AI đang chạy: tiến trình (file đã đọc), chữ đang về, lỗi, dừng */
export function useAiAnalysisRun<T>() {
  const state = ref<'idle' | 'running' | 'error'>('idle')
  const error = ref('')
  const live = ref('')
  const steps = ref<string[]>([])
  const botFile = ref<string | null>(null)
  let ctrl: AbortController | null = null

  async function start(url: string, body: unknown, onDone: (saved: T) => void) {
    ctrl?.abort()
    const mine = (ctrl = new AbortController())
    state.value = 'running'
    error.value = ''
    live.value = ''
    steps.value = []
    botFile.value = null
    try {
      await runAnalysis(url, body, (e: AiEvent) => {
        if (mine !== ctrl) return
        if (e.kind === 'meta') botFile.value = e.botFile
        else if (e.kind === 'tool') steps.value.push(`${STEP_LABEL[e.name] ?? e.name} ${e.target.replace(/^.*?\/(test|app|docs)\//, '$1/')}`.trim())
        else if (e.kind === 'text') live.value += e.text
        else if (e.kind === 'done') {
          onDone(e as unknown as T)
          state.value = 'idle'
        } else if (e.kind === 'error') {
          error.value = e.message
          state.value = 'error'
        }
      }, mine.signal)
      if (mine === ctrl && state.value === 'running') state.value = 'idle'
    } catch (e) {
      if (mine !== ctrl) return
      if ((e as Error).name === 'AbortError') state.value = 'idle'
      else {
        error.value = e instanceof Error ? e.message : String(e)
        state.value = 'error'
      }
    }
  }
  function stop() {
    ctrl?.abort()
    ctrl = null
    state.value = 'idle'
  }
  onBeforeUnmount(stop)
  return { state, error, live, steps, botFile, start, stop }
}
