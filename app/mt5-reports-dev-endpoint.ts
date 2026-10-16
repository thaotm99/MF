import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

/** Thư mục chứa báo cáo MT5 (HTML) — nằm trong .gitignore */
export const MT5_REPORTS_DIR = 'reports'
const LIST_PATH = '/__mt5-reports/list'
const FILE_PREFIX = '/__mt5-reports/file/'
/** Chỉ nhận tên file đơn giản, không có thư mục → chặn path traversal */
const SAFE_NAME = /^[\w\-. ()]+\.html?$/i

function isLoopback(req: IncomingMessage) {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/**
 * Dev server endpoint đọc báo cáo lịch sử MT5 đã xuất ra HTML:
 * - GET /__mt5-reports/list        → [{ name, size, mtime }]
 * - GET /__mt5-reports/file/<tên>  → nội dung file (nguyên byte; MT5 thường dùng UTF-16)
 */
export function mt5ReportsDevEndpoint(): Plugin {
  let dir = ''
  return {
    name: 'mt5-reports-dev-endpoint',
    configResolved(config) {
      dir = path.resolve(config.root, MT5_REPORTS_DIR)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (url !== LIST_PATH && !url.startsWith(FILE_PREFIX)) return next()
        res.setHeader('cache-control', 'no-store')
        if (!isLoopback(req)) {
          res.statusCode = 403
          return res.end()
        }

        if (url === LIST_PATH) {
          let files: { name: string; size: number; mtime: string }[] = []
          try {
            const names = (await fs.readdir(dir)).filter((n) => SAFE_NAME.test(n))
            files = await Promise.all(
              names.map(async (name) => {
                const st = await fs.stat(path.join(dir, name))
                return { name, size: st.size, mtime: st.mtime.toISOString() }
              }),
            )
          } catch {
            // Chưa có thư mục reports/ → danh sách rỗng
          }
          res.setHeader('content-type', 'application/json')
          return res.end(JSON.stringify({ dir: MT5_REPORTS_DIR, files }))
        }

        const name = decodeURIComponent(url.slice(FILE_PREFIX.length))
        if (!SAFE_NAME.test(name)) {
          res.statusCode = 400
          return res.end()
        }
        try {
          const buf = await fs.readFile(path.join(dir, name))
          res.setHeader('content-type', 'application/octet-stream')
          res.end(buf)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })
    },
  }
}
