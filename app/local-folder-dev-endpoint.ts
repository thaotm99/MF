import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { Plugin } from 'vite'

function isLoopback(req: IncomingMessage) {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

interface FolderEndpointOptions {
  /** Tên plugin */
  name: string
  /** Thư mục (tương đối với app/), nằm trong .gitignore */
  dir: string
  /** Tiền tố URL, ví dụ /__mt5-reports */
  urlPrefix: string
  /** Đuôi file được phép, ví dụ /\.html?$/i */
  extension: RegExp
}

/**
 * Dev server endpoint đọc file trong một thư mục cục bộ (chỉ tên file đơn giản → chặn path traversal):
 * - GET <prefix>/list        → { dir, files: [{ name, size, mtime }] }
 * - GET <prefix>/file/<tên>  → nội dung file (nguyên byte)
 */
function localFolderDevEndpoint(opts: FolderEndpointOptions): Plugin {
  const listPath = `${opts.urlPrefix}/list`
  const filePrefix = `${opts.urlPrefix}/file/`
  const safeName = (n: string) => /^[\w\-. ()]+$/.test(n) && opts.extension.test(n)
  let dir = ''
  return {
    name: opts.name,
    configResolved(config) {
      dir = path.resolve(config.root, opts.dir)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (url !== listPath && !url.startsWith(filePrefix)) return next()
        res.setHeader('cache-control', 'no-store')
        if (!isLoopback(req)) {
          res.statusCode = 403
          return res.end()
        }

        if (url === listPath) {
          let files: { name: string; size: number; mtime: string }[] = []
          try {
            const names = (await fs.readdir(dir)).filter(safeName)
            files = await Promise.all(
              names.map(async (name) => {
                const st = await fs.stat(path.join(dir, name))
                return { name, size: st.size, mtime: st.mtime.toISOString() }
              }),
            )
          } catch {
            // Chưa có thư mục → danh sách rỗng
          }
          res.setHeader('content-type', 'application/json')
          return res.end(JSON.stringify({ dir: opts.dir, files }))
        }

        const name = decodeURIComponent(url.slice(filePrefix.length))
        if (!safeName(name)) {
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

/** Báo cáo lịch sử MT5 (HTML, thường UTF-16) trong app/reports/ */
export const mt5ReportsDevEndpoint = () =>
  localFolderDevEndpoint({ name: 'mt5-reports-dev-endpoint', dir: 'reports', urlPrefix: '/__mt5-reports', extension: /\.html?$/i })

/** Nến M1/M5/M15 xuất từ MT5 (CSV) trong app/candles/ */
export const mt5CandlesDevEndpoint = () =>
  localFolderDevEndpoint({ name: 'mt5-candles-dev-endpoint', dir: 'candles', urlPrefix: '/__mt5-candles', extension: /\.csv$/i })
