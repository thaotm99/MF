/** Gọi endpoint phân tích AI của dev server (Claude Code chạy trên máy) */
/** Phân tích AI cần dev server + Claude Code trên máy → không có trên bản deploy tĩnh (Vercel) */
export const AI_AVAILABLE = import.meta.env.DEV

/** Một lượt hỏi tiếp trong cùng session Claude Code */
export interface AiThreadItem { question: string; markdown: string; createdAt: string; costUsd?: number }

export interface AiAnalysis {
  positionId: string
  accountLabel: string
  botFile: string | null
  question: string
  markdown: string
  createdAt: string
  costUsd?: number
  durationMs?: number
  turns?: number
  /** Session Claude Code để hỏi tiếp (--resume) */
  sessionId?: string
  thread?: AiThreadItem[]
}

export interface AiOverallAnalysis {
  id: string
  accountLabel: string
  period: string
  tradeCount: number | null
  botFile: string | null
  question: string
  markdown: string
  createdAt: string
  costUsd?: number
  durationMs?: number
  sessionId?: string
  thread?: AiThreadItem[]
}

export type AiEvent =
  | { kind: 'meta'; botFile: string | null }
  | { kind: 'tool'; name: string; target: string }
  | { kind: 'text'; text: string }
  | ({ kind: 'done' } & AiAnalysis)
  | { kind: 'error'; message: string }

export async function getSavedAnalysis(positionId: string): Promise<AiAnalysis | null> {
  const r = await fetch(`/__ai-analyze/${encodeURIComponent(positionId)}`, { cache: 'no-store' })
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
  return (await r.json()) as AiAnalysis | null
}

async function getJson<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
  return (await r.json()) as T
}
export const getSavedOverall = (id: string) => getJson<AiOverallAnalysis>(`/__ai-analyze-all/${encodeURIComponent(id)}`)
export const listSavedOverall = async () => (await getJson<Omit<AiOverallAnalysis, 'markdown'>[]>('/__ai-analyze-all/list')) ?? []

/** Gửi yêu cầu (url: /__ai-analyze hoặc /__ai-analyze-all) và đọc kết quả dạng NDJSON từng dòng */
export async function runAnalysis(
  url: string,
  body: unknown,
  onEvent: (e: AiEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal,
  })
  if (!r.ok || !r.body) {
    const msg = r.status === 404 ? 'Chỉ dùng được khi chạy npm run dev.' : (await r.text()) || `HTTP ${r.status}`
    return onEvent({ kind: 'error', message: msg })
  }
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) {
        try {
          onEvent(JSON.parse(line) as AiEvent)
        } catch {
          // bỏ dòng hỏng
        }
      }
    }
  }
}
