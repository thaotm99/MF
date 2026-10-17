import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import type { ServerResponse } from 'node:http'
import { AI_SYSTEM_PROMPT } from './ai-analysis-prompt'

/**
 * Chạy Claude Code (`claude -p`) trên máy, stream tiến trình về trình duyệt dạng NDJSON:
 * {kind:'tool'|'text'} trong lúc chạy; khi xong gọi onDone(markdown, meta) để lưu rồi gửi {kind:'done'} hoặc {kind:'error'}.
 * Quyền hạn: --restricted (nếu bản CLI có), chỉ Read / Grep / Glob, cấm đọc .env, không MCP.
 * Session được lưu (~/.claude/projects/<repo>/<sessionId>.jsonl) để "Hỏi tiếp" bằng --resume.
 */
export interface RunnerOptions { bin: string; model?: string; cwd: string }
export interface RunMeta { costUsd?: number; durationMs?: number; turns?: number; isError?: boolean; sessionId?: string }

/**
 * Biến môi trường gắn process với một session Claude Code đang chạy (khi `npm run dev` được chạy từ trong Claude Code):
 * phải bỏ đi, nếu không lượt phân tích sẽ ghi lẫn vào session đó thay vì tạo session riêng.
 */
const SESSION_ENV = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_AFTER_LAST_COMPACT|CLAUDE_CODE_(SESSION_ID|REMOTE_SESSION_ID|CHILD_SESSION|ENTRYPOINT|MESSAGING_\w+|SESSION_ATTENDED|WORKER_EPOCH|TEE_SDK_STDOUT|POST_FOR_SESSION_INGRESS_V2|SYNC_SESSION_REFS))$/
const childEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !SESSION_ENV.test(k)))
const SAFE_SESSION = /^[0-9a-f-]{36}$/i

export function createClaudeRunner(opts: RunnerOptions) {
  let running: ChildProcess | null = null
  let supportsRestricted: boolean | undefined

  function args(resumeId?: string): string[] {
    if (supportsRestricted === undefined) {
      const help = spawnSync(opts.bin, ['--help'], { encoding: 'utf8', timeout: 15_000 })
      supportsRestricted = (help.stdout ?? '').includes('--restricted')
    }
    return [
      '-p',
      '--output-format', 'stream-json', '--verbose',
      ...(supportsRestricted ? ['--restricted'] : []),
      '--strict-mcp-config',
      '--tools', 'Read', 'Grep', 'Glob',
      '--allowedTools', 'Read', 'Grep', 'Glob',
      '--disallowedTools', 'Read(**/.env*)', 'Read(**/node_modules/**)',
      '--permission-mode', 'dontAsk',
      '--append-system-prompt', AI_SYSTEM_PROMPT,
      ...(opts.model ? ['--model', opts.model] : []),
      ...(resumeId && SAFE_SESSION.test(resumeId) ? ['--resume', resumeId] : []),
    ]
  }

  const busy = () => running !== null

  /** Ghi stream vào res; res phải chưa gửi header */
  function run(
    res: ServerResponse,
    prompt: string,
    timeoutMs: number,
    first: Record<string, unknown>,
    onDone: (markdown: string, meta: RunMeta) => Promise<Record<string, unknown>>,
    /** Tiếp tục session cũ (Hỏi tiếp) */
    resumeId?: string,
  ) {
    res.statusCode = 200
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('x-accel-buffering', 'no')
    const send = (o: Record<string, unknown>) => !res.writableEnded && res.write(`${JSON.stringify(o)}\n`)
    send({ kind: 'meta', ...first })

    let child: ChildProcess
    try {
      child = spawn(opts.bin, args(resumeId), { cwd: opts.cwd, stdio: ['pipe', 'pipe', 'pipe'], env: childEnv() })
    } catch (e) {
      send({ kind: 'error', message: `Không chạy được Claude Code: ${String(e)}` })
      return res.end()
    }
    running = child
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    // Trình duyệt đóng / bấm dừng → dừng Claude Code
    res.on('close', () => child.exitCode === null && !child.killed && child.kill('SIGTERM'))

    let finalText = ''
    let streamedText = ''
    let stderr = ''
    let buf = ''
    let meta: RunMeta = {}
    let sessionId: string | undefined
    child.stdout!.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8')
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let ev: any
        try {
          ev = JSON.parse(line)
        } catch {
          continue
        }
        if (typeof ev.session_id === 'string') sessionId = ev.session_id
        if (ev.type === 'assistant') {
          for (const c of ev.message?.content ?? []) {
            if (c.type === 'text' && c.text) {
              streamedText += c.text
              send({ kind: 'text', text: c.text })
            } else if (c.type === 'tool_use') {
              send({ kind: 'tool', name: c.name, target: c.input?.file_path ?? c.input?.pattern ?? c.input?.path ?? '' })
            }
          }
        } else if (ev.type === 'result') {
          finalText = typeof ev.result === 'string' ? ev.result : ''
          meta = { costUsd: ev.total_cost_usd, durationMs: ev.duration_ms, turns: ev.num_turns, isError: ev.is_error }
          if (ev.is_error && typeof ev.result !== 'string') stderr += ` ${ev.subtype ?? ''}`
        }
      }
    })
    child.stderr!.on('data', (c: Buffer) => (stderr = (stderr + c.toString('utf8')).slice(-2000)))
    child.on('error', (e) => {
      send({ kind: 'error', message: `Không chạy được Claude Code (${opts.bin}): ${e.message}. Kiểm tra đã cài và đăng nhập Claude Code trên máy này.` })
    })
    child.on('close', async (code) => {
      clearTimeout(timer)
      running = null
      const markdown = (finalText || streamedText).trim()
      meta.sessionId = sessionId
      if (code === 0 && markdown && !meta.isError) {
        let saved: Record<string, unknown> = { markdown, ...meta }
        try {
          saved = await onDone(markdown, meta)
        } catch {
          // Không lưu được vẫn trả kết quả
        }
        send({ kind: 'done', ...saved })
      } else {
        const gone = /No conversation found/i.test(stderr)
        send({
          kind: 'error',
          message: gone
            ? 'Không tìm thấy session cũ của Claude Code (có thể đã bị xoá) — bấm "Phân tích lại" để tạo session mới.'
            : `Claude Code dừng (mã ${code ?? 'bị huỷ'}). ${stderr.trim() || markdown}`.slice(0, 1500),
        })
      }
      res.end()
    })
    child.stdin!.end(prompt)
  }

  return { run, busy }
}
