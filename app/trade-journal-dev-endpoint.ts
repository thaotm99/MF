import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

/** Giới hạn kích thước nhật ký (đủ cho hàng chục nghìn ghi chú) */
const MAX_BYTES = 2 * 1024 * 1024

function isLoopback(req: IncomingMessage) {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BYTES) {
        reject(new Error('too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Chỉ nhận { [positionId]: { tags: string[], note: string, updatedAt: string } } */
function isValidJournal(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  return Object.entries(v as Record<string, unknown>).every(([id, e]) => {
    if (!/^[\w-]{1,40}$/.test(id) || !e || typeof e !== 'object') return false
    const { tags, note } = e as { tags?: unknown; note?: unknown }
    return Array.isArray(tags) && tags.every((t) => typeof t === 'string' && t.length <= 40) && typeof note === 'string' && note.length <= 4000
  })
}

/**
 * Nhật ký nhãn / ghi chú từng lệnh, lưu ở app/journal/trade-journal.json (không commit):
 * - GET /__trade-journal → nội dung JSON ({} nếu chưa có)
 * - PUT /__trade-journal → ghi đè toàn bộ (ghi file tạm rồi rename để không hỏng file khi đang ghi)
 */
export function tradeJournalDevEndpoint(): Plugin {
  let file = ''
  return {
    name: 'trade-journal-dev-endpoint',
    configResolved(config) {
      file = path.resolve(config.root, 'journal', 'trade-journal.json')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== '/__trade-journal') return next()
        res.setHeader('cache-control', 'no-store')
        if (!isLoopback(req)) {
          res.statusCode = 403
          return res.end()
        }
        if (req.method === 'GET') {
          let body = '{}'
          try {
            body = await fs.readFile(file, 'utf8')
          } catch {
            // Chưa có file → nhật ký rỗng
          }
          res.setHeader('content-type', 'application/json')
          return res.end(body)
        }
        if (req.method === 'PUT') {
          try {
            const data = JSON.parse(await readBody(req)) as unknown
            if (!isValidJournal(data)) throw new Error('invalid')
            await fs.mkdir(path.dirname(file), { recursive: true })
            const tmp = `${file}.tmp`
            await fs.writeFile(tmp, JSON.stringify(data, null, 1), 'utf8')
            await fs.rename(tmp, file)
            res.statusCode = 204
          } catch {
            res.statusCode = 400
          }
          return res.end()
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}
