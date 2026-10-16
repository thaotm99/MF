import type { Deal } from './types'

/**
 * Đọc báo cáo "Trade History Report" xuất từ MetaTrader 5 (History → Report → HTML).
 *
 * Cấu trúc báo cáo (bản tiếng Anh):
 * - Phần đầu: Name / Account ("12345678 (USD, Exness-MT5Real8, real, Hedge)") / Company / Date
 * - Các bảng: Positions, Orders, Deals — tiêu đề bảng là một dòng chữ đậm chiếm cả hàng
 * - Bảng Deals: Time | Deal | Symbol | Type | Direction | Volume | Price | Order | Commission | Fee | Swap | Profit | Balance | Comment
 * - Phần tổng kết: Balance: / Floating P/L: / Equity: ...
 * Thời gian trong báo cáo là giờ server MT5 (Exness: UTC+0).
 */

/** Một vị thế đã đóng trong bảng Positions (đủ thông tin mở + đóng). */
export interface Mt5Position {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  volume: number
  /** ISO, giờ server */
  openTime: string
  closeTime: string
  /** Lãi/lỗ ròng = Profit + Commission + Swap */
  netProfit: number
}

export interface Mt5Report {
  login: string
  name?: string
  currency: string
  server?: string
  /** Thời điểm xuất báo cáo (ISO) */
  reportTime?: string
  balance?: number
  equity?: number
  floatingPnl?: number
  deals: Deal[]
  positions: Mt5Position[]
}

/** MT5 thường lưu báo cáo dạng UTF-16 LE có BOM. */
export function decodeReport(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b)
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b)
  // Không có BOM nhưng byte thứ 2 toàn 0 → UTF-16 LE
  if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b)
  return new TextDecoder('utf-8').decode(b)
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

/** "1 234.56" / "-12.30" → số; rỗng → 0 */
function num(s: string | undefined): number {
  const t = clean(s).replace(/\s/g, '')
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

const DATE_RE = /^(\d{4})\.(\d{2})\.(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/

/** "2026.10.01 09:00:01" (giờ server, UTC+0) → ISO */
function toIso(s: string): string | null {
  const m = DATE_RE.exec(clean(s))
  if (!m) return null
  const [, y, mo, d, h = '00', mi = '00', se = '00'] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${se}+00:00`
}

/**
 * Ô của một hàng, mở rộng theo colspan để khớp chỉ số cột với hàng tiêu đề.
 * Bỏ ô class="hidden": MT5 dùng ô ẩn (cột Cost, comment colspan=8 trong Positions) làm lệch cột.
 */
function rowCells(tr: Element): string[] {
  const out: string[] = []
  for (const td of Array.from(tr.children)) {
    if (td.tagName !== 'TD' && td.tagName !== 'TH') continue
    if (td.classList.contains('hidden')) continue
    const span = Math.max(1, Number(td.getAttribute('colspan') ?? 1) || 1)
    out.push(clean(td.textContent))
    for (let i = 1; i < span; i++) out.push('')
  }
  return out
}

/** Giá trị nằm ngay sau ô nhãn (ví dụ "Equity:") trong cùng hàng. */
function valueAfterLabel(rows: string[][], label: string): string | undefined {
  const l = label.toLowerCase()
  for (const cells of rows) {
    const i = cells.findIndex((c) => c.toLowerCase() === l)
    if (i !== -1) return cells.slice(i + 1).find((c) => c !== '')
  }
  return undefined
}

const TRADE_TYPES = new Set(['buy', 'sell'])
const BALANCE_TYPES = new Set(['balance', 'credit', 'bonus', 'correction', 'deposit', 'withdrawal'])

export function parseMt5Report(html: string): Mt5Report {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const trs = Array.from(doc.querySelectorAll('tr'))
  const rows = trs.map(rowCells)

  // ----- Phần đầu báo cáo -----
  const accountText = valueAfterLabel(rows, 'Account:')
  if (!accountText) throw new Error('Không thấy dòng "Account:" — có phải báo cáo MT5 bản tiếng Anh không?')
  const am = /^(\d+)\s*(?:\(([^)]*)\))?/.exec(accountText)
  if (!am) throw new Error(`Không đọc được số tài khoản từ "${accountText}"`)
  const meta = (am[2] ?? '').split(',').map((s) => s.trim())
  const currency = meta[0] && /^[A-Z]{3,4}$/.test(meta[0]) ? meta[0] : 'USD'
  const reportDate = valueAfterLabel(rows, 'Date:')

  // ----- Bảng Deals -----
  const headerIdx = rows.findIndex((c) => {
    const lc = c.map((x) => x.toLowerCase())
    return lc.includes('deal') && lc.includes('direction') && lc.includes('profit')
  })
  if (headerIdx === -1) throw new Error('Không thấy bảng "Deals" trong báo cáo')
  const header = rows[headerIdx].map((c) => c.toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const C = {
    time: col('time'), deal: col('deal'), symbol: col('symbol'), type: col('type'), direction: col('direction'),
    volume: col('volume'), price: col('price'), order: col('order'), commission: col('commission'),
    fee: col('fee'), swap: col('swap'), profit: col('profit'),
  }

  const deals: Deal[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const c = rows[i]
    const time = toIso(c[C.time] ?? '')
    // Hết bảng Deals khi gặp hàng không bắt đầu bằng thời gian (tổng cộng, tiêu đề phần sau...)
    if (!time) {
      if (c.filter(Boolean).length > 0 && !/^\d/.test(c[0] ?? '')) break
      continue
    }
    const ticket = c[C.deal]
    if (!/^\d+$/.test(ticket ?? '')) continue
    const type = (c[C.type] ?? '').toLowerCase()
    const dir = (c[C.direction] ?? '').toLowerCase()
    const profit = num(c[C.profit])
    const commission = num(c[C.commission]) + (C.fee >= 0 ? num(c[C.fee]) : 0)
    const swap = C.swap >= 0 ? num(c[C.swap]) : 0

    if (TRADE_TYPES.has(type)) {
      deals.push({
        deal_id: ticket,
        order_id: C.order >= 0 ? c[C.order] || undefined : undefined,
        // in = mở vị thế; out / out by / in/out = đóng (có lãi/lỗ)
        type: dir === 'in' ? 'open' : 'close',
        direction: type as 'buy' | 'sell',
        instrument: c[C.symbol],
        volume: (c[C.volume] ?? '').split('/')[0].trim(),
        price: c[C.price],
        profit: { amount: String(profit) },
        commission: String(commission),
        create_time: time,
      })
      // Swap trong MT5 nằm trên deal; tách thành deal swap_fee để cộng vào phí giao dịch
      if (swap) deals.push({ deal_id: `${ticket}-swap`, type: 'swap_fee', profit: { amount: String(swap) }, create_time: time })
    } else if (BALANCE_TYPES.has(type)) {
      deals.push({ deal_id: ticket, type: 'balance', profit: { amount: String(profit) }, create_time: time })
    } else if (profit || commission) {
      // commission, fee, interest... → chi phí khác
      deals.push({ deal_id: ticket, type: 'admin_fee', profit: { amount: String(profit + commission) }, create_time: time })
    }
  }

  // ----- Bảng Positions (vị thế đã đóng) -----
  const positions = parsePositions(rows)

  // ----- Tổng kết -----
  const after = rows.slice(headerIdx)
  const pick = (label: string) => {
    const v = valueAfterLabel(after, label)
    return v === undefined ? undefined : num(v)
  }

  return {
    login: am[1],
    name: valueAfterLabel(rows, 'Name:'),
    currency,
    server: meta[1],
    reportTime: reportDate ? (toIso(reportDate) ?? undefined) : undefined,
    balance: pick('Balance:'),
    equity: pick('Equity:'),
    floatingPnl: pick('Floating P/L:'),
    deals,
    positions,
  }
}

/** Bảng Positions: Time | Position | Symbol | Type | Volume | Price | S / L | T / P | Time | Price | Commission | Swap | Profit */
function parsePositions(rows: string[][]): Mt5Position[] {
  const headerIdx = rows.findIndex((c) => {
    const lc = c.map((x) => x.toLowerCase())
    return lc.includes('position') && lc.includes('symbol') && lc.includes('profit') && lc.includes('s / l')
  })
  if (headerIdx === -1) return []
  const header = rows[headerIdx].map((c) => c.toLowerCase())
  const C = {
    open: header.indexOf('time'), close: header.lastIndexOf('time'), id: header.indexOf('position'),
    symbol: header.indexOf('symbol'), type: header.indexOf('type'), volume: header.indexOf('volume'),
    commission: header.indexOf('commission'), swap: header.indexOf('swap'), profit: header.indexOf('profit'),
  }
  const out: Mt5Position[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const c = rows[i]
    const openTime = toIso(c[C.open] ?? '')
    if (!openTime) {
      if (c.filter(Boolean).length > 0) break // hết bảng
      continue
    }
    const closeTime = toIso(c[C.close] ?? '')
    const type = (c[C.type] ?? '').toLowerCase()
    if (!closeTime || (type !== 'buy' && type !== 'sell')) continue
    out.push({
      id: c[C.id],
      symbol: c[C.symbol],
      type,
      volume: num((c[C.volume] ?? '').split('/')[0]),
      openTime,
      closeTime,
      netProfit: num(c[C.profit]) + num(c[C.commission]) + num(c[C.swap]),
    })
  }
  return out
}

/**
 * Báo cáo MT5 không có contract size → ước lượng theo tên mã:
 * vàng 100 oz, bạc 5 000 oz, cặp tiền 6 ký tự 100 000; mã khác không quy đổi được.
 * Bỏ hậu tố loại tài khoản của Exness (XAUUSDm, EURUSDc...).
 */
export function estimateContract(symbol: string): { size: number; base: string; quote: string } | null {
  const s = symbol.replace(/[a-z.#_]+$/, '').toUpperCase()
  if (!/^[A-Z]{6}$/.test(s)) return null
  const base = s.slice(0, 3)
  const quote = s.slice(3)
  const size = base === 'XAU' ? 100 : base === 'XAG' ? 5000 : /^X(PT|PD)/.test(s) ? 100 : 100_000
  return { size, base, quote }
}
