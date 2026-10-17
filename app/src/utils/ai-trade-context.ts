import type { Candle } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import type { JournalEntry } from '../stores/trade-journal'
import type { AutoTag } from './trade-auto-tags'
import type { TradeEvaluation } from './trade-evaluation'
import type { Excursion } from './trade-excursion'
import type { ExitEvaluation } from './trade-exit-evaluation'

/** Số nến đưa vào prompt: trước giờ vào / sau giờ đóng (trong lệnh lấy hết, tối đa MAX_BARS) */
const BARS_BEFORE = 40
const BARS_AFTER = 5
const MAX_BARS = 160

export interface AiTradeContextInput {
  p: Mt5Position
  accountLabel: string
  currency: string
  ev?: TradeEvaluation
  exit?: ExitEvaluation
  exc?: Excursion
  entryTf?: string
  exitTf?: string
  autoTags?: AutoTag[]
  journal?: JournalEntry
  candles: Candle[]
  timeframe: string
  tfSec: number
}

const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 16).replace('T', ' ')
const n = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(2) : v.toFixed(4)).replace(/\.?0+$/, '')

/** Nến quanh lệnh: BARS_BEFORE nến trước giờ vào → BARS_AFTER nến sau giờ đóng */
function candleTable(c: Candle[], p: Mt5Position, tfSec: number): string {
  const open = Date.parse(p.openTime) / 1000
  const close = Date.parse(p.closeTime) / 1000
  let first = c.findIndex((x) => x.time + tfSec > open)
  if (first < 0) return '(không có nến phủ thời gian lệnh)'
  first = Math.max(0, first - BARS_BEFORE)
  let last = c.findIndex((x) => x.time > close)
  last = last < 0 ? c.length - 1 : Math.min(c.length - 1, last + BARS_AFTER - 1)
  if (last - first + 1 > MAX_BARS) first = last - MAX_BARS + 1
  const rows = c.slice(first, last + 1).map((x) => {
    const mark = x.time + tfSec <= open ? '' : x.time <= close ? ' *' : ' (sau đóng)'
    return `${iso(x.time)} ${n(x.open)} ${n(x.high)} ${n(x.low)} ${n(x.close)}${mark}`
  })
  return ['thời gian(UTC) open high low close — "*" = nến trong lúc giữ lệnh', ...rows].join('\n')
}

/** Văn bản bối cảnh một lệnh gửi cho Claude Code (chỉ dữ liệu của lệnh này, không có thống kê lịch sử) */
export function buildAiTradeContext(x: AiTradeContextInput): string {
  const { p } = x
  const lines = [
    `Tài khoản: ${x.accountLabel}`,
    `Mã: ${p.symbol} · ${p.type === 'buy' ? 'BUY' : 'SELL'} ${p.volume} lot`,
    `Vào: ${p.openTime.replace('T', ' ').slice(0, 19)} @ ${p.openPrice}`,
    `Ra: ${p.closeTime.replace('T', ' ').slice(0, 19)} @ ${p.closePrice}`,
    `Lãi/lỗ ròng: ${p.netProfit.toFixed(2)} ${x.currency}`,
    p.comment ? `Comment lệnh (EA ghi): ${p.comment}` : '',
    p.atr !== undefined ? `ATR lúc vào (comment): ${p.atr}` : '',
    p.er5 !== undefined ? `ER5 lúc vào (comment): ${p.er5}` : '',
    '',
  ]
  if (x.ev?.ok) lines.push(`Bối cảnh lúc vào (nến ${x.entryTf}, chỉ nến đã đóng): ${x.ev.summary}.`)
  if (x.exit?.ok) lines.push(`Trước khi đóng (${x.exit.bars} nến ${x.exitTf}): ${x.exit.summary}.`)
  if (x.exc?.ok) {
    lines.push(`Trong lệnh (nến ${x.exitTf}): MAE ${x.exc.maeAtr.toFixed(2)} ATR, MFE ${x.exc.mfeAtr.toFixed(2)} ATR, kết quả ${x.exc.realizedAtr.toFixed(2)} ATR (1 ATR ≈ ${n(x.exc.atr)} giá).`)
  }
  if (x.autoTags?.length) lines.push(`Nhãn tự động: ${x.autoTags.map((t) => `${t.label} (${t.reason})`).join('; ')}.`)
  if (x.journal?.tags.length) lines.push(`Nhãn chủ bot gắn: ${x.journal.tags.join(', ')}.`)
  if (x.journal?.note.trim()) lines.push(`Ghi chú chủ bot: ${x.journal.note.trim()}`)
  lines.push('', `Nến ${x.timeframe}:`, candleTable(x.candles, p, x.tfSec))
  return lines.filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').slice(0, 39_000)
}
