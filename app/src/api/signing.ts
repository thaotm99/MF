import * as ed from '@noble/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'

// @noble/ed25519 cần hàm sha512 đồng bộ để ký không cần WebCrypto.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))

const encoder = new TextEncoder()

export function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64Decode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Tìm khoá 32 byte trong DER PKCS#8 (OCTET STRING lồng: 04 22 04 20 <32 byte>). */
function seedFromPkcs8(der: Uint8Array): Uint8Array | null {
  for (let i = 0; i + 36 <= der.length; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x22 && der[i + 2] === 0x04 && der[i + 3] === 0x20) {
      return der.slice(i + 4, i + 36)
    }
  }
  return null
}

/**
 * Đọc Secret Key Ed25519 từ các định dạng thường gặp:
 * PEM (PKCS#8), hex 32/64 byte, base64/base64url 32/64 byte hoặc DER PKCS#8.
 * Trả về seed 32 byte dùng để ký.
 */
export function parsePrivateKey(raw: string): Uint8Array {
  const text = raw.trim()
  if (!text) throw new Error('Secret Key đang trống')

  if (text.includes('-----BEGIN')) {
    const body = text.replace(/-----[^-]+-----/g, '')
    const seed = seedFromPkcs8(base64Decode(body))
    if (!seed) throw new Error('Không đọc được khoá PEM (cần PKCS#8 Ed25519)')
    return seed
  }

  if (/^(0x)?[0-9a-f]+$/i.test(text) && (text.replace(/^0x/, '').length === 64 || text.replace(/^0x/, '').length === 128)) {
    return ed.etc.hexToBytes(text.replace(/^0x/, '')).slice(0, 32)
  }

  let bytes: Uint8Array
  try {
    bytes = base64Decode(text)
  } catch {
    throw new Error('Secret Key không phải PEM, hex hay base64 hợp lệ')
  }
  if (bytes.length === 32) return bytes
  if (bytes.length === 64) return bytes.slice(0, 32) // seed + public key
  const seed = seedFromPkcs8(bytes)
  if (seed) return seed
  throw new Error(`Secret Key có độ dài không hợp lệ (${bytes.length} byte)`)
}

/** Public key (base64url) suy ra từ secret, giúp đối chiếu với Key Management. */
export function derivePublicKey(raw: string): string {
  return base64UrlEncode(ed.getPublicKey(parsePrivateKey(raw)))
}

export const EMPTY_BODY_HASH = base64UrlEncode(sha256(new Uint8Array()))

export interface SignInput {
  apiKey: string
  privateKey: Uint8Array
  method: string
  /** Path kèm query string, đúng như khi gửi đi. */
  pathWithQuery: string
  body?: string
  idempotencyKey?: string
}

export function buildSignedHeaders(input: SignInput): Record<string, string> {
  const timestamp = Date.now()
  const idempotencyKey = input.idempotencyKey ?? ''
  const bodyHash = input.body ? base64UrlEncode(sha256(encoder.encode(input.body))) : EMPTY_BODY_HASH
  const payload = {
    api_key: input.apiKey,
    idempotency_key: idempotencyKey,
    timestamp,
    sign_version: 1,
    method: input.method.toUpperCase(),
    path: input.pathWithQuery,
    body_hash: bodyHash,
  }
  const payloadBytes = encoder.encode(JSON.stringify(payload))
  const signature = ed.sign(payloadBytes, input.privateKey)
  return {
    'EXN-API-KEY': input.apiKey,
    'EXN-IDEMPOTENCY-KEY': idempotencyKey,
    'EXN-TIMESTAMP': String(timestamp),
    'EXN-SIGN-VERSION': '1',
    'EXN-DATA': base64UrlEncode(payloadBytes),
    'EXN-SIGN': base64UrlEncode(signature),
  }
}
