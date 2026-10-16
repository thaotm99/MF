import type { Mt5Position } from '../api/mt5-report-parser'
import type { EvaluationOptions, TradeEvaluation } from './trade-evaluation'
import type { ExitEvaluation } from './trade-exit-evaluation'
import { POST_CLOSE_BARS, type Excursion } from './trade-excursion'

/**
 * Nhãn tự động: suy ra từ đánh giá lúc vào lệnh, N nến trước khi đóng và MAE/MFE.
 * Không ghi vào nhật ký — tính lại mỗi lần (đổi khung / tham số thì nhãn đổi theo).
 */
export interface AutoTagInput {
  p: Mt5Position
  ev?: TradeEvaluation
  exit?: ExitEvaluation
  exc?: Excursion
  options: EvaluationOptions
}

export interface AutoTag {
  id: string
  label: string
  /** Lý do cụ thể của lệnh này, ví dụ "trả lại 1.4 ATR" */
  reason: string
}

export interface AutoTagRule {
  id: string
  label: string
  /** Mô tả rule cho người dùng */
  description: string
  /** Trả về lý do nếu lệnh khớp rule, ngược lại null */
  match: (x: AutoTagInput) => string | null
}

const f1 = (v: number) => v.toFixed(1)
const TREND_VI = { up: 'tăng', down: 'giảm' } as const

/** Ngưỡng dùng chung — sửa ở đây thì mô tả cũng đổi theo */
export const AUTO_TAG_THRESHOLDS = { excursionAtr: 1, givebackAtr: 1, highVolRatio: 1.25 }
const T = AUTO_TAG_THRESHOLDS

export const AUTO_TAG_RULES: AutoTagRule[] = [
  {
    id: 'counter-trend', label: 'Ngược xu hướng',
    description: 'Cấu trúc swing khung vào lệnh hoặc khung H1 đang ngược chiều lệnh (Buy khi xu hướng giảm / Sell khi xu hướng tăng).',
    match: ({ p, ev }) => {
      if (!ev?.ok) return null
      const against = p.type === 'buy' ? 'down' : 'up'
      const parts = [
        ev.trend === against ? `khung vào lệnh xu hướng ${TREND_VI[against]}` : '',
        ev.context?.h1 === against ? `H1 xu hướng ${TREND_VI[against]}` : '',
      ].filter(Boolean)
      return parts.length ? parts.join(', ') : null
    },
  },
  {
    id: 'near-level', label: 'Vào sát cản',
    description: 'Cản phía trước (Buy: đỉnh swing phía trên, Sell: đáy swing phía dưới) cách giá vào dưới ngưỡng "sát cản" (mặc định 0.5 ATR).',
    match: ({ ev, options }) =>
      ev?.ok && ev.levelDistAtr !== undefined && ev.levelDistAtr < options.nearLevelAtr ? `cản cách ${f1(ev.levelDistAtr)} ATR` : null,
  },
  {
    id: 'chase', label: 'Đuổi giá',
    description: 'Buy ngay sau khi giá phá đỉnh swing và đang ở vùng cao (> 2/3) của range; Sell ngay sau khi thủng đáy swing và ở vùng thấp (< 1/3).',
    match: ({ p, ev }) => {
      if (!ev?.ok || ev.rangePos === undefined) return null
      const pct = `${Math.round(ev.rangePos * 100)}% range`
      if (p.type === 'buy' && ev.breakout === 'above-high' && ev.rangePos > 2 / 3) return `phá đỉnh, vào ở ${pct}`
      if (p.type === 'sell' && ev.breakout === 'below-low' && ev.rangePos < 1 / 3) return `thủng đáy, vào ở ${pct}`
      return null
    },
  },
  {
    id: 'early', label: 'Vào sớm',
    description: `Sau khi vào, giá đi ngược ≥ ${T.excursionAtr} ATR trước rồi mới chạy thuận ≥ ${T.excursionAtr} ATR — chờ thêm sẽ có giá vào tốt hơn.`,
    match: ({ exc }) =>
      exc?.ok && exc.adverseFirst && exc.maeAtr >= T.excursionAtr && exc.mfeAtr >= T.excursionAtr
        ? `ngược ${f1(exc.maeAtr)} ATR rồi mới thuận ${f1(exc.mfeAtr)} ATR`
        : null,
  },
  {
    id: 'early-exit', label: 'Thoát sớm',
    description: `Lệnh thắng nhưng trong ${POST_CLOSE_BARS} nến sau khi đóng, giá còn chạy tiếp theo chiều lệnh ≥ ${T.excursionAtr} ATR so với giá đóng — chốt sớm bỏ lỡ lợi nhuận. (Dùng nến sau giờ đóng: chỉ để đánh giá, không phải điều kiện bot biết trước.)`,
    match: ({ p, exc }) =>
      p.netProfit >= 0 && exc?.ok && exc.postCloseAtr >= T.excursionAtr ? `sau khi đóng giá chạy tiếp ${f1(exc.postCloseAtr)} ATR` : null,
  },
  {
    id: 'late-exit', label: 'Thoát muộn',
    description: `Lệnh thắng nhưng đóng cách điểm tốt nhất trong lúc giữ lệnh ≥ ${T.givebackAtr} ATR (MFE − kết quả) — đã trả lại nhiều lợi nhuận. Lệnh thua từng có lãi xem nhãn "Thua dù từng có lãi".`,
    match: ({ p, exc }) => {
      if (p.netProfit < 0 || !exc?.ok || exc.mfeAtr <= 0) return null
      const giveback = exc.mfeAtr - exc.realizedAtr
      return giveback >= T.givebackAtr ? `từng lãi ${f1(exc.mfeAtr)} ATR, đóng ở ${f1(exc.realizedAtr)} ATR (trả lại ${f1(giveback)})` : null
    },
  },
  {
    id: 'loser-was-green', label: 'Thua dù từng có lãi',
    description: `Lệnh thua nhưng trong lúc giữ lệnh giá từng đi thuận ≥ ${T.excursionAtr} ATR (MFE) — dời SL về hoà vốn có thể đã cứu được.`,
    match: ({ p, exc }) => (p.netProfit < 0 && exc?.ok && exc.mfeAtr >= T.excursionAtr ? `từng lãi ${f1(exc.mfeAtr)} ATR` : null),
  },
  {
    id: 'high-vol', label: 'Biến động cao',
    description: `ATR14 lúc vào lệnh > ${T.highVolRatio}× ATR trung bình 50 nến trước.`,
    match: ({ ev }) => (ev?.ok && ev.volRatio !== undefined && ev.volRatio > T.highVolRatio ? `ATR ${ev.volRatio.toFixed(2)}× trung bình` : null),
  },
]

export function autoTagsFor(x: AutoTagInput): AutoTag[] {
  return AUTO_TAG_RULES.flatMap((r) => {
    const reason = r.match(x)
    return reason ? [{ id: r.id, label: r.label, reason }] : []
  })
}
