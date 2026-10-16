import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// Chỉ cho phép chuyển tiếp tới các host của Exness.
const ALLOWED_HOST = /^([a-z0-9-]+\.)*(exness|exness-api)\.com$/i
const PREFIX = '/__exness/'

/**
 * Proxy dùng khi phát triển, để tránh lỗi CORS nếu API Exness không cho phép
 * gọi trực tiếp từ trình duyệt. URL dạng: /__exness/<host>/<path>?<query>
 * Header ký (EXN-*) được chuyển tiếp nguyên vẹn; chữ ký vẫn tạo ở trình duyệt.
 */
function exnessDevProxy(): Plugin {
  return {
    name: 'exness-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(PREFIX)) return next()
        const rest = req.url.slice(PREFIX.length)
        const slash = rest.indexOf('/')
        const host = slash === -1 ? rest : rest.slice(0, slash)
        const pathWithQuery = slash === -1 ? '/' : rest.slice(slash)
        if (!ALLOWED_HOST.test(host)) {
          res.statusCode = 400
          res.end(JSON.stringify({ code: 'PROXY_HOST_NOT_ALLOWED', error_message: `Host không hợp lệ: ${host}` }))
          return
        }
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(req.headers)) {
          if (k.toLowerCase().startsWith('exn-') && typeof v === 'string') headers[k] = v
        }
        headers['accept'] = 'application/json'
        try {
          const upstream = await fetch(`https://${host}${pathWithQuery}`, { method: req.method, headers })
          res.statusCode = upstream.status
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
          res.end(Buffer.from(await upstream.arrayBuffer()))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ code: 'PROXY_UPSTREAM_ERROR', error_message: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), exnessDevProxy()],
})
