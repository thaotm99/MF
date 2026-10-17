import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { viaProxyOrRemote } from './dashboard-password-guard'
import { AI_SYSTEM_PROMPT, buildAiPrompt, type AiAnalyzeRequest } from './ai-analysis-prompt'

/**
 * Phân tích lệnh bằng Claude Code chạy trên máy này (`claude -p`, dùng tài khoản đã đăng nhập, không cần API key).
 *
 * - POST /__ai-analyze          body AiAnalyzeRequest → stream NDJSON: {kind:'meta'|'tool'|'text'|'done'|'error', …}
 * - GET  /__ai-analyze/<id>     → bản phân tích đã lưu (app/ai-analyses/<id>.json) hoặc 404
 *
 * An toàn: chỉ nhận request trực tiếp trên máy (chặn qua tunnel/proxy kể cả có mật khẩu), mỗi lúc 1 lượt,
 * Claude Code chỉ có tool đọc (Read / Grep / Glob), không đọc .env, giới hạn thời gian.
 */
const MAX_BODY = 64 * 1024
const TIMEOUT_MS = 5 * 60 * 1000
const SAFE_ID = /^[\w-]{1,40}$/

interface Options { bin?: string; model?: string }

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** MF_01 / MF01 / "MF_1 240826" → file bot trong test/ (bỏ file gộp nhiều chiến lược); nhiều bản thì lấy bản mới nhất */
async function findBotFile(repoRoot: string, accountLabel: string): Promise<string | undefined> {
  const m = /MF[_\s-]*0*(\d{1,3})/i.exec(accountLabel)
  if (!m) return undefined
  const n = Number(m[1])
  const dir = path.join(repoRoot, 'test')
  let names: string[] = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return undefined
  }
  const candidates = names.filter((f) => {
    if (!f.endsWith('.mq5') || /multi-strategy/i.test(f)) return false
    const k = /MF[_-]?0*(\d{1,3})(?!\d)/i.exec(f)
    return !!k && Number(k[1]) === n
  })
  if (!candidates.length) return undefined
  const withTime = await Promise.all(candidates.map(async (f) => ({ f, t: (await fs.stat(path.join(dir, f))).mtimeMs })))
  withTime.sort((a, b) => b.t - a.t)
  return `test/${withTime[0].f}`
}

function isValidRequest(v: unknown): v is AiAnalyzeRequest {
  const r = v as AiAnalyzeRequest
  return !!r && typeof r === 'object' && typeof r.positionId === 'string' && SAFE_ID.test(r.positionId)
    && typeof r.accountLabel === 'string' && r.accountLabel.length <= 100
    && typeof r.context === 'string' && r.context.length <= 40_000
    && (r.question === undefined || (typeof r.question === 'string' && r.question.length <= 1000))
}

export function aiAnalysisDevEndpoint(opts: Options = {}): Plugin {
  const bin = opts.bin || 'claude'
  let appRoot = ''
  let repoRoot = ''
  let outDir = ''
  let running: ChildProcess | null = null
  /** Bản Claude Code cũ chưa có --restricted → bỏ flag đó (vẫn giới hạn bằng --tools + dontAsk) */
  let supportsRestricted: boolean | undefined

  function claudeArgs(): string[] {
    if (supportsRestricted === undefined) {
      const help = spawnSync(bin, ['--help'], { encoding: 'utf8', timeout: 15_000 })
      supportsRestricted = (help.stdout ?? '').includes('--restricted')
    }
    return [
      '-p',
      '--output-format', 'stream-json', '--verbose',
      ...(supportsRestricted ? ['--restricted'] : []),
      '--strict-mcp-config',
      '--no-session-persistence',
      '--tools', 'Read', 'Grep', 'Glob',
      '--allowedTools', 'Read', 'Grep', 'Glob',
      '--disallowedTools', 'Read(**/.env*)', 'Read(**/node_modules/**)',
      '--permission-mode', 'dontAsk',
      '--append-system-prompt', AI_SYSTEM_PROMPT,
      ...(opts.model ? ['--model', opts.model] : []),
    ]
  }

  async function analyze(req: IncomingMessage, res: ServerResponse) {
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      res.statusCode = 400
      return res.end()
    }
    if (!isValidRequest(body)) {
      res.statusCode = 400
      return res.end()
    }
    if (running) {
      res.statusCode = 429
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      return res.end('Đang có một phân tích khác chạy, chờ xong rồi thử lại.')
    }

    const botFile = await findBotFile(repoRoot, body.accountLabel)
    const prompt = buildAiPrompt(body, botFile)
    res.statusCode = 200
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('x-accel-buffering', 'no')
    const send = (o: Record<string, unknown>) => res.write(`${JSON.stringify(o)}\n`)
    send({ kind: 'meta', botFile: botFile ?? null })

    let child: ChildProcess
    try {
      child = spawn(bin, claudeArgs(), { cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
    } catch (e) {
      send({ kind: 'error', message: `Không chạy được Claude Code: ${String(e)}` })
      return res.end()
    }
    running = child
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS)
    // Trình duyệt đóng / bấm dừng → dừng Claude Code
    res.on('close', () => !child.killed && child.exitCode === null && child.kill('SIGTERM'))

    let finalText = ''
    let streamedText = ''
    let stderr = ''
    let buf = ''
    let meta: Record<string, unknown> = {}
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
        }
      }
    })
    child.stderr!.on('data', (c: Buffer) => (stderr = (stderr + c.toString('utf8')).slice(-2000)))
    child.on('error', (e) => {
      send({ kind: 'error', message: `Không chạy được Claude Code (${bin}): ${e.message}. Kiểm tra đã cài và đăng nhập Claude Code trên máy này.` })
    })
    child.on('close', async (code) => {
      clearTimeout(timer)
      running = null
      const markdown = (finalText || streamedText).trim()
      if (code === 0 && markdown && !meta.isError) {
        const saved = { positionId: body.positionId, accountLabel: body.accountLabel, botFile: botFile ?? null, question: body.question ?? '', markdown, createdAt: new Date().toISOString(), ...meta }
        try {
          await fs.mkdir(outDir, { recursive: true })
          await fs.writeFile(path.join(outDir, `${body.positionId}.json`), JSON.stringify(saved, null, 1), 'utf8')
        } catch {
          // Không lưu được vẫn trả kết quả
        }
        send({ kind: 'done', ...saved })
      } else if (!res.writableEnded) {
        send({ kind: 'error', message: `Claude Code dừng (mã ${code ?? 'bị huỷ'}). ${stderr.trim() || markdown}`.slice(0, 1500) })
      }
      res.end()
    })
    child.stdin!.end(prompt)
  }

  return {
    name: 'ai-analysis-dev-endpoint',
    configResolved(config) {
      appRoot = config.root
      repoRoot = path.resolve(appRoot, '..')
      outDir = path.join(appRoot, 'ai-analyses')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (url !== '/__ai-analyze' && !url.startsWith('/__ai-analyze/')) return next()
        res.setHeader('cache-control', 'no-store')
        // Chỉ dùng trên máy này: chặn mọi request qua tunnel / proxy / máy khác
        if (viaProxyOrRemote(req)) {
          res.statusCode = 403
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          return res.end('Phân tích AI chỉ dùng được khi mở dashboard trực tiếp trên máy chạy npm run dev.')
        }
        if (req.method === 'POST' && url === '/__ai-analyze') return analyze(req, res)
        if (req.method === 'GET' && url.startsWith('/__ai-analyze/')) {
          const id = decodeURIComponent(url.slice('/__ai-analyze/'.length))
          if (!SAFE_ID.test(id)) {
            res.statusCode = 400
            return res.end()
          }
          try {
            const data = await fs.readFile(path.join(outDir, `${id}.json`), 'utf8')
            res.setHeader('content-type', 'application/json')
            return res.end(data)
          } catch {
            res.statusCode = 404
            return res.end()
          }
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}
