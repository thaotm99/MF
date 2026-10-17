import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/**
 * Bảo vệ dev server bằng mật khẩu (HTTP Basic Auth) khi public qua Cloudflare Tunnel / ngrok.
 *
 * - Có DASHBOARD_PASSWORD (trong app/.env): mọi request (trang, JS, báo cáo) phải đúng mật khẩu.
 *   Tên đăng nhập là DASHBOARD_USER (mặc định "admin").
 * - Không có mật khẩu: chỉ phục vụ truy cập trực tiếp trên máy này; request đi qua tunnel/proxy
 *   bị từ chối, để không vô tình public báo cáo (số tài khoản, lịch sử lệnh).
 *
 * Tunnel chuyển request về localhost nên không dựa vào địa chỉ IP được — dấu hiệu nhận biết là
 * các header proxy mà Cloudflare / ngrok luôn thêm vào.
 */
const PROXY_HEADERS = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-host', 'forwarded']

function isLoopback(req: IncomingMessage) {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/** Request đi qua tunnel/proxy hoặc từ máy khác (dùng chung cho các endpoint chỉ cho phép trên máy này) */
export function viaProxyOrRemote(req: IncomingMessage) {
  return !isLoopback(req) || PROXY_HEADERS.some((h) => req.headers[h] !== undefined)
}

/** So sánh không lộ thời gian (băm trước để hai chuỗi cùng độ dài). */
function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function credentialsOf(req: IncomingMessage): { user: string; pass: string } | null {
  const h = req.headers.authorization ?? ''
  if (!h.startsWith('Basic ')) return null
  const decoded = Buffer.from(h.slice(6), 'base64').toString('utf8')
  const i = decoded.indexOf(':')
  return i === -1 ? null : { user: decoded.slice(0, i), pass: decoded.slice(i + 1) }
}

function deny(res: ServerResponse, status: number, message: string, challenge = false) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (challenge) res.setHeader('www-authenticate', 'Basic realm="Exness Dashboard", charset="UTF-8"')
  res.end(message)
}

export function dashboardPasswordGuard(options: { password?: string; user?: string }): Plugin {
  const password = options.password?.trim() || ''
  const user = options.user?.trim() || 'admin'
  return {
    name: 'dashboard-password-guard',
    configureServer(server) {
      if (password && password.length < 8) {
        server.config.logger.warn('[dashboard] DASHBOARD_PASSWORD nên dài ít nhất 8 ký tự.')
      }
      // Gọi trực tiếp (không return hàm) → chạy TRƯỚC mọi middleware nội bộ của Vite
      server.middlewares.use((req, res, next) => {
        if (!password) {
          if (viaProxyOrRemote(req)) {
            return deny(res, 403, 'Dashboard chưa đặt mật khẩu. Thêm DASHBOARD_PASSWORD vào app/.env rồi chạy lại npm run dev.')
          }
          return next()
        }
        const cred = credentialsOf(req)
        if (cred && safeEqual(cred.user, user) && safeEqual(cred.pass, password)) return next()
        // Sai mật khẩu: chờ 1 giây để làm chậm việc dò mật khẩu
        const delay = cred ? 1000 : 0
        setTimeout(() => deny(res, 401, 'Cần đăng nhập.', true), delay)
      })
    },
  }
}
