import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { viaProxyOrRemote } from './dashboard-password-guard'
import { createClaudeRunner } from './ai-analysis-claude-runner'
import { buildAiOverallPrompt, buildAiPrompt, type AiAnalyzeRequest, type AiOverallRequest } from './ai-analysis-prompt'

/**
 * Phân tích bằng Claude Code chạy trên máy này (`claude -p`, dùng tài khoản đã đăng nhập, không cần API key).
 *
 * - POST /__ai-analyze             1 lệnh  → stream NDJSON; lưu app/ai-analyses/<ticket>.json
 * - GET  /__ai-analyze/<ticket>    bản phân tích 1 lệnh đã lưu
 * - POST /__ai-analyze-all         toàn bộ lệnh trong kỳ → ghi bảng lệnh ra app/ai-analyses/inputs/<id>.tsv cho Claude đọc;
 *                                  lưu app/ai-analyses/overall/<id>.json
 * - GET  /__ai-analyze-all/list    danh sách bản phân tích tổng thể đã lưu
 * - GET  /__ai-analyze-all/<id>    bản phân tích tổng thể đã lưu
 *
 * Chỉ nhận request trực tiếp trên máy (chặn qua tunnel/proxy kể cả có mật khẩu), mỗi lúc 1 lượt.
 */
const SAFE_ID = /^[\w-]{1,60}$/

interface Options { bin?: string; model?: string }

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > max) {
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

const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
function isTradeRequest(v: unknown): v is AiAnalyzeRequest {
  const r = v as AiAnalyzeRequest
  return !!r && typeof r === 'object' && SAFE_ID.test(String(r.positionId)) && str(r.accountLabel, 100)
    && str(r.context, 40_000) && (r.question === undefined || str(r.question, 1000))
}
function isOverallRequest(v: unknown): v is AiOverallRequest {
  const r = v as AiOverallRequest
  return !!r && typeof r === 'object' && SAFE_ID.test(String(r.id)) && str(r.accountLabel, 100) && str(r.period, 100)
    && str(r.summary, 20_000) && str(r.rows, 3_000_000) && (r.question === undefined || str(r.question, 2000))
}

function text(res: ServerResponse, status: number, msg: string) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.end(msg)
}
async function sendJsonFile(res: ServerResponse, file: string) {
  try {
    const data = await fs.readFile(file, 'utf8')
    res.setHeader('content-type', 'application/json')
    res.end(data)
  } catch {
    // Chưa có bản lưu → null (không dùng 404 để console trình duyệt khỏi báo lỗi)
    res.setHeader('content-type', 'application/json')
    res.end('null')
  }
}

export function aiAnalysisDevEndpoint(opts: Options = {}): Plugin {
  let repoRoot = ''
  let outDir = ''
  let runner: ReturnType<typeof createClaudeRunner>

  async function parse<T>(req: IncomingMessage, res: ServerResponse, max: number, ok: (v: unknown) => v is T): Promise<T | null> {
    let body: unknown
    try {
      body = JSON.parse(await readBody(req, max))
    } catch {
      text(res, 400, 'Dữ liệu gửi lên không hợp lệ hoặc quá lớn.')
      return null
    }
    if (!ok(body)) {
      text(res, 400, 'Dữ liệu gửi lên không hợp lệ.')
      return null
    }
    if (runner.busy()) {
      text(res, 429, 'Đang có một phân tích khác chạy, chờ xong rồi thử lại.')
      return null
    }
    return body
  }

  async function analyzeTrade(req: IncomingMessage, res: ServerResponse) {
    const body = await parse(req, res, 64 * 1024, isTradeRequest)
    if (!body) return
    const botFile = await findBotFile(repoRoot, body.accountLabel)
    runner.run(res, buildAiPrompt(body, botFile), 5 * 60_000, { botFile: botFile ?? null }, async (markdown, meta) => {
      const saved = { positionId: body.positionId, accountLabel: body.accountLabel, botFile: botFile ?? null, question: body.question ?? '', markdown, createdAt: new Date().toISOString(), ...meta }
      await fs.mkdir(outDir, { recursive: true })
      await fs.writeFile(path.join(outDir, `${body.positionId}.json`), JSON.stringify(saved, null, 1), 'utf8')
      return saved
    })
  }

  async function analyzeAll(req: IncomingMessage, res: ServerResponse) {
    const body = await parse(req, res, 3_200_000, isOverallRequest)
    if (!body) return
    const botFile = await findBotFile(repoRoot, body.accountLabel)
    // Bảng lệnh để Claude Code tự đọc (đường dẫn tương đối với repo)
    const inputRel = `app/ai-analyses/inputs/${body.id}.tsv`
    await fs.mkdir(path.join(outDir, 'inputs'), { recursive: true })
    await fs.writeFile(path.join(repoRoot, inputRel), body.rows, 'utf8')
    runner.run(res, buildAiOverallPrompt(body, botFile, inputRel), 10 * 60_000, { botFile: botFile ?? null }, async (markdown, meta) => {
      const saved = { id: body.id, accountLabel: body.accountLabel, period: body.period, tradeCount: body.tradeCount ?? null, botFile: botFile ?? null, question: body.question ?? '', markdown, createdAt: new Date().toISOString(), ...meta }
      await fs.mkdir(path.join(outDir, 'overall'), { recursive: true })
      await fs.writeFile(path.join(outDir, 'overall', `${body.id}.json`), JSON.stringify(saved, null, 1), 'utf8')
      return saved
    })
  }

  async function listOverall(res: ServerResponse) {
    const dir = path.join(outDir, 'overall')
    let items: unknown[] = []
    try {
      const names = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))
      items = (await Promise.all(names.map(async (f) => {
        try {
          const d = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))
          return { id: d.id, accountLabel: d.accountLabel, period: d.period, tradeCount: d.tradeCount, question: d.question, createdAt: d.createdAt }
        } catch {
          return null
        }
      }))).filter(Boolean)
    } catch {
      // chưa có
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(items))
  }

  return {
    name: 'ai-analysis-dev-endpoint',
    configResolved(config) {
      repoRoot = path.resolve(config.root, '..')
      outDir = path.join(config.root, 'ai-analyses')
      runner = createClaudeRunner({ bin: opts.bin || 'claude', model: opts.model, cwd: repoRoot })
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const trade = url === '/__ai-analyze' || url.startsWith('/__ai-analyze/')
        const all = url === '/__ai-analyze-all' || url.startsWith('/__ai-analyze-all/')
        if (!trade && !all) return next()
        res.setHeader('cache-control', 'no-store')
        // Chỉ dùng trên máy này: chặn mọi request qua tunnel / proxy / máy khác
        if (viaProxyOrRemote(req)) return text(res, 403, 'Phân tích AI chỉ dùng được khi mở dashboard trực tiếp trên máy chạy npm run dev.')

        if (req.method === 'POST' && url === '/__ai-analyze') return analyzeTrade(req, res)
        if (req.method === 'POST' && url === '/__ai-analyze-all') return analyzeAll(req, res)
        if (req.method === 'GET' && url === '/__ai-analyze-all/list') return listOverall(res)
        if (req.method === 'GET') {
          const prefix = trade ? '/__ai-analyze/' : '/__ai-analyze-all/'
          const id = decodeURIComponent(url.slice(prefix.length))
          if (!SAFE_ID.test(id)) return text(res, 400, '')
          return sendJsonFile(res, trade ? path.join(outDir, `${id}.json`) : path.join(outDir, 'overall', `${id}.json`))
        }
        text(res, 405, '')
      })
    },
  }
}
