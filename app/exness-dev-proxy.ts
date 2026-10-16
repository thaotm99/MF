import crypto, { type KeyObject } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin } from 'vite'

// Chỉ cho phép chuyển tiếp tới các host của Exness (và host khai báo trong API_HOST của .env).
const ALLOWED_HOST = /^([a-z0-9-]+\.)*(exness|exness-api)\.com$/i
const PROXY_PREFIX = '/__exness/'
const ENV_INFO_PATH = '/__exness-env/info'
/** Header trình duyệt gửi để yêu cầu dev server tự ký bằng key trong .env */
const SERVER_SIGN_HEADER = 'x-exn-server-sign'

/** DER PKCS#8 header cho khoá Ed25519 32 byte. */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/** Đọc Secret Key Ed25519: PEM, hex 32/64 byte hoặc base64 32/64 byte. */
function privateKeyFromSecret(secret: string): KeyObject {
  const text = secret.trim()
  if (text.includes('-----BEGIN')) return crypto.createPrivateKey(text)
  let bytes: Buffer
  if (/^[0-9a-f]+$/i.test(text) && (text.length === 64 || text.length === 128)) bytes = Buffer.from(text, 'hex')
  else bytes = Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  if (bytes.length !== 32 && bytes.length !== 64) throw new Error(`SECRET_KEY có độ dài không hợp lệ (${bytes.length} byte)`)
  const seed = bytes.subarray(0, 32) // 64 byte = seed + public key
  return crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' })
}

const EMPTY_BODY_HASH = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('base64url')

/** Tạo header EXN-* cho một request GET, theo mục Authentication của tài liệu Exness. */
function signedGetHeaders(apiKey: string, key: KeyObject, pathWithQuery: string): Record<string, string> {
  const timestamp = Date.now()
  const payload = Buffer.from(
    JSON.stringify({
      api_key: apiKey,
      idempotency_key: '',
      timestamp,
      sign_version: 1,
      method: 'GET',
      path: pathWithQuery,
      body_hash: EMPTY_BODY_HASH,
    }),
  )
  return {
    'EXN-API-KEY': apiKey,
    'EXN-IDEMPOTENCY-KEY': '',
    'EXN-TIMESTAMP': String(timestamp),
    'EXN-SIGN-VERSION': '1',
    'EXN-DATA': payload.toString('base64url'),
    'EXN-SIGN': crypto.sign(null, payload, key).toString('base64url'),
  }
}

interface EnvKey {
  apiKey: string
  key: KeyObject
  /** Host mặc định, ví dụ https://api.exness.com */
  host: URL
}

function loadEnvKey(mode: string, envDir: string): { envKey: EnvKey | null; error?: string } {
  const env = loadEnv(mode, envDir, '')
  if (!env.API_KEY || !env.SECRET_KEY) return { envKey: null }
  try {
    return {
      envKey: {
        apiKey: env.API_KEY.trim(),
        key: privateKeyFromSecret(env.SECRET_KEY),
        host: new URL(env.API_HOST?.trim() || 'https://api.exness.com'),
      },
    }
  } catch (e) {
    return { envKey: null, error: e instanceof Error ? e.message : String(e) }
  }
}

const mask = (s: string) => (s.length > 14 ? `${s.slice(0, 10)}…${s.slice(-4)}` : s)

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/** Chỉ phục vụ request từ chính máy này, kể cả khi chạy `vite --host`. */
function isLoopback(req: IncomingMessage) {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

/**
 * Proxy cho dev server, URL dạng /__exness/<host>/<path>?<query>.
 * - Mặc định: chuyển tiếp nguyên header EXN-* do trình duyệt ký (tránh lỗi CORS).
 * - Có header x-exn-server-sign: 1 → dev server tự ký bằng API_KEY/SECRET_KEY trong .env;
 *   Secret Key không bao giờ được gửi xuống trình duyệt. Chỉ cho phép GET (dashboard chỉ đọc).
 */
export function exnessDevProxy(): Plugin {
  let state: ReturnType<typeof loadEnvKey> = { envKey: null }
  return {
    name: 'exness-dev-proxy',
    configResolved(config) {
      state = loadEnvKey(config.mode, config.envDir || config.root)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (url !== ENV_INFO_PATH && !url.startsWith(PROXY_PREFIX)) return next()
        if (!isLoopback(req)) return sendJson(res, 403, { code: 'PROXY_FORBIDDEN', error_message: 'Chỉ dùng từ localhost' })

        if (url === ENV_INFO_PATH) {
          const k = state.envKey
          return sendJson(res, 200, k
            ? { available: true, apiKey: mask(k.apiKey), host: k.host.origin }
            : { available: false, error: state.error })
        }

        const rest = url.slice(PROXY_PREFIX.length)
        const slash = rest.indexOf('/')
        const host = slash === -1 ? rest : rest.slice(0, slash)
        const pathWithQuery = slash === -1 ? '/' : rest.slice(slash)
        const envHost = state.envKey?.host
        const isEnvHost = envHost?.host === host
        if (!ALLOWED_HOST.test(host) && !isEnvHost) {
          return sendJson(res, 400, { code: 'PROXY_HOST_NOT_ALLOWED', error_message: `Host không hợp lệ: ${host}` })
        }

        let headers: Record<string, string> = {}
        if (req.headers[SERVER_SIGN_HEADER] === '1') {
          if (!state.envKey) {
            return sendJson(res, 400, { code: 'ENV_KEY_MISSING', error_message: state.error ?? 'Chưa có API_KEY/SECRET_KEY trong .env' })
          }
          if (req.method !== 'GET') {
            return sendJson(res, 405, { code: 'PROXY_METHOD_NOT_ALLOWED', error_message: 'Key .env chỉ dùng cho request GET' })
          }
          headers = signedGetHeaders(state.envKey.apiKey, state.envKey.key, pathWithQuery)
        } else {
          for (const [k, v] of Object.entries(req.headers)) {
            if (k.toLowerCase().startsWith('exn-') && typeof v === 'string') headers[k] = v
          }
        }
        headers['accept'] = 'application/json'

        const scheme = isEnvHost ? envHost!.protocol : 'https:'
        try {
          const upstream = await fetch(`${scheme}//${host}${pathWithQuery}`, { method: req.method, headers })
          res.statusCode = upstream.status
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
          res.end(Buffer.from(await upstream.arrayBuffer()))
        } catch (e) {
          sendJson(res, 502, { code: 'PROXY_UPSTREAM_ERROR', error_message: String(e) })
        }
      })
    },
  }
}
