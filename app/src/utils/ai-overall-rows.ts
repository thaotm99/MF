import type { Mt5Position } from '../api/mt5-report-parser'
import type { JournalEntry } from '../stores/trade-journal'
import type { AutoTag } from './trade-auto-tags'
import type { TradeEvaluation } from './trade-evaluation'
import type { Excursion } from './trade-excursion'
import type { ExitEvaluation } from './trade-exit-evaluation'

/**
 * Bảng lệnh (TSV) cho phân tích AI tổng thể: mỗi dòng 1 lệnh với dữ liệu lệnh + bối cảnh đánh giá + nhãn.
 * Chỉ dữ liệu thực tế từng lệnh, không có thống kê tối ưu.
 */
export interface OverallRowInput {
  p: Mt5Position
  ev?: TradeEvaluation
  exit?: ExitEvaluation
  exc?: Excursion
  autoTags?: AutoTag[]
  journal?: JournalEntry
}

const COLUMNS = [
  'ticket', 'vao_utc', 'ra_utc', 'giu_phut', 'chieu', 'lot', 'gia_vao', 'gia_ra', 'lai_lo', 'comment', 'atr_cmt', 'er5_cmt',
  'cau_truc', 'thuan_nguoc', 'pha_cau_truc', 'vi_tri_range_pct', 'can_atr', 'nen_truoc', 'xac_nhan_nen', 'ema20', 'atr_ratio',
  'h1', 'h4', 'ngay_truoc', 'so_tron_atr', 'phien', 'da_truoc_dong', 'tra_lai_atr', 'nen_dao_chieu', 'mae_atr', 'mfe_atr', 'ket_qua_atr',
  'nhan_tu_dong', 'nhan_cua_ban', 'ghi_chu',
]

/** Chú thích cột (đưa vào phần thông tin chung) */
export const OVERALL_COLUMN_LEGEND = `Cột: ticket; vao_utc/ra_utc giờ server UTC+0; giu_phut thời gian giữ lệnh; lai_lo lãi/lỗ ròng (tiền tệ hiển thị);
comment = comment EA ghi lúc vào; atr_cmt/er5_cmt đọc từ comment.
Bối cảnh lúc vào (chỉ nến đã đóng trước giờ vào): cau_truc up/down/range (swing HH-HL / LH-LL); thuan_nguoc with/against/range so với chiều lệnh;
pha_cau_truc above-high/below-low/inside; vi_tri_range_pct 0=đáy 100=đỉnh range 20 nến; can_atr khoảng cách tới cản phía trước (trống = không có cản);
nen_truoc mẫu nến trước khi vào, xac_nhan_nen confirm/against/neutral; ema20 above/below-up/down; atr_ratio ATR/ATR TB 50 nến;
h1/h4 xu hướng khung lớn; ngay_truoc vị trí so với PDH/PDL; so_tron_atr khoảng cách tới số tròn; phien asia/london/overlap/newyork/late.
Trước khi đóng (5 nến): da_truoc_dong with/against/flat; tra_lai_atr giá tốt nhất 5 nến so với giá đóng; nen_dao_chieu 1 nếu nến cuối đảo chiều.
Trong lệnh: mae_atr / mfe_atr / ket_qua_atr theo ATR lúc vào. Ô trống = thiếu nến.`

const clean = (v: unknown) => (v === undefined || v === null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').trim())
const f2 = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? '' : v.toFixed(2))
const t = (iso: string) => iso.replace('T', ' ').slice(0, 16)

export function buildOverallRows(items: OverallRowInput[]): string {
  const lines = [COLUMNS.join('\t')]
  for (const { p, ev, exit, exc, autoTags, journal } of [...items].sort((a, b) => a.p.openTime.localeCompare(b.p.openTime))) {
    const e = ev?.ok ? ev : undefined
    const x = exit?.ok ? exit : undefined
    const m = exc?.ok ? exc : undefined
    const c = e?.context
    const row = [
      p.id, t(p.openTime), t(p.closeTime), Math.round((Date.parse(p.closeTime) - Date.parse(p.openTime)) / 60_000),
      p.type, p.volume, p.openPrice, p.closePrice, p.netProfit.toFixed(2), p.comment, p.atr, p.er5,
      e?.trend, e?.alignment, e?.breakout, e?.rangePos === undefined ? '' : Math.round(e.rangePos * 100), f2(e?.levelDistAtr),
      e?.pattern, e?.patternAgree, e?.ema, f2(e?.volRatio),
      c?.h1, c?.h4, c?.prevDay, f2(c?.roundDistAtr), c?.session,
      x?.momentum, f2(x?.givebackAtr), x ? (x.reversal ? 1 : 0) : '',
      f2(m?.maeAtr), f2(m?.mfeAtr), f2(m?.realizedAtr),
      (autoTags ?? []).map((a) => a.label).join(', '), (journal?.tags ?? []).join(', '), journal?.note,
    ]
    lines.push(row.map(clean).join('\t'))
  }
  return lines.join('\n')
}

/** Thông tin chung: chỉ tổng số thực tế của kỳ, không có thống kê theo nhóm */
export function buildOverallSummary(o: {
  accountLabel: string; login?: string; server?: string; currency: string; period: string; positions: Mt5Position[]
  entryTf?: string; exitTf?: string; candleCount: number
}): string {
  const wins = o.positions.filter((p) => p.netProfit >= 0).length
  const net = o.positions.reduce((s, p) => s + p.netProfit, 0)
  return [
    `Tài khoản: ${o.accountLabel}${o.login ? ` (#${o.login}${o.server ? `, ${o.server}` : ''})` : ''}`,
    `Kỳ: ${o.period} · Tiền tệ hiển thị: ${o.currency}`,
    `Số lệnh: ${o.positions.length} · lãi ${wins} · lỗ ${o.positions.length - wins} · lãi/lỗ ròng ${net.toFixed(2)} ${o.currency}`,
    o.entryTf ? `Nến dùng để đánh giá: vào lệnh ${o.entryTf}, trong lệnh / trước khi đóng ${o.exitTf} (${o.candleCount} lệnh có đủ nến).` : 'Không có file nến → các cột bối cảnh để trống.',
    '',
    OVERALL_COLUMN_LEGEND,
  ].join('\n')
}
