import { PREV_DAY_LABEL, SESSION_LABEL } from './trade-context-features'
import { PATTERN_LABEL, TREND_LABEL, type EvaluationOptions, type TradeEvaluation } from './trade-evaluation'

/**
 * Các yếu tố lúc vào lệnh dùng để thống kê thắng/thua (và để ghép tổ hợp setup).
 * Mỗi yếu tố chia lệnh thành các nhóm có nhãn tiếng Việt.
 */

export interface EvaluationFeature {
  id: string
  title: string
  /** Nhóm của lệnh theo yếu tố này */
  categoryOf: (e: TradeEvaluation, o: EvaluationOptions) => string
}

export const EVALUATION_FEATURES: EvaluationFeature[] = [
  { id: 'trend', title: 'Cấu trúc thị trường', categoryOf: (e) => TREND_LABEL[e.trend!] },
  {
    id: 'alignment', title: 'Thuận / ngược xu hướng',
    categoryOf: (e) => (e.alignment === 'with' ? 'Thuận xu hướng' : e.alignment === 'against' ? 'Ngược xu hướng' : 'Trong sideway'),
  },
  {
    id: 'breakout', title: 'Phá cấu trúc',
    categoryOf: (e) => {
      const isBuy = e.position.type === 'buy'
      if (e.breakout === 'above-high') return isBuy ? 'Buy sau khi phá đỉnh' : 'Sell sau khi phá đỉnh'
      if (e.breakout === 'below-low') return isBuy ? 'Buy sau khi thủng đáy' : 'Sell sau khi thủng đáy'
      return 'Giá còn trong đỉnh/đáy swing'
    },
  },
  {
    id: 'location', title: 'Vị trí vào trong range',
    categoryOf: (e) => {
      const pos = e.rangePos!
      const zone = pos < 1 / 3 ? 'vùng thấp' : pos > 2 / 3 ? 'vùng cao' : 'giữa range'
      return `${e.position.type === 'buy' ? 'Buy' : 'Sell'} ở ${zone}`
    },
  },
  {
    id: 'level', title: 'Khoảng cách tới cản phía trước',
    categoryOf: (e, o) => {
      if (e.levelDistAtr === undefined) return 'Không có cản gần'
      if (e.levelDistAtr < o.nearLevelAtr) return `Sát cản (< ${o.nearLevelAtr} ATR)`
      if (e.levelDistAtr < 1.5) return `Cản gần (${o.nearLevelAtr}–1.5 ATR)`
      return 'Có khoảng trống (≥ 1.5 ATR)'
    },
  },
  {
    id: 'pattern', title: 'Nến trước khi vào',
    categoryOf: (e) => `${PATTERN_LABEL[e.pattern!]}${e.patternAgree === 'confirm' ? ' · xác nhận' : e.patternAgree === 'against' ? ' · ngược chiều' : ''}`,
  },
  {
    id: 'ema', title: 'EMA20',
    categoryOf: (e) => ({
      'above-up': 'Trên EMA20, EMA dốc lên', 'above-down': 'Trên EMA20, EMA dốc xuống',
      'below-up': 'Dưới EMA20, EMA dốc lên', 'below-down': 'Dưới EMA20, EMA dốc xuống',
    })[e.ema!],
  },
  {
    id: 'vol', title: 'Biến động (ATR so với trung bình)',
    categoryOf: (e) => (e.volRatio === undefined ? 'Không rõ' : e.volRatio > 1.25 ? 'Biến động tăng (> 1.25×)' : e.volRatio < 0.8 ? 'Biến động thấp (< 0.8×)' : 'Bình thường'),
  },
  ...(['h1', 'h4'] as const).map((tf): EvaluationFeature => ({
    id: tf,
    title: `Khung ${tf.toUpperCase()}`,
    categoryOf: (e) => {
      const t = e.context?.[tf]
      if (!t) return 'Không đủ nến'
      if (t === 'range') return `${tf.toUpperCase()} sideway`
      const withTrend = (t === 'up') === (e.position.type === 'buy')
      return `${withTrend ? 'Thuận' : 'Ngược'} ${tf.toUpperCase()} (${TREND_LABEL[t].toLowerCase()})`
    },
  })),
  {
    id: 'prevday', title: 'So với ngày hôm trước',
    categoryOf: (e) => {
      const d = e.context?.prevDay
      return d ? `${e.position.type === 'buy' ? 'Buy' : 'Sell'} ${PREV_DAY_LABEL[d].toLowerCase()}` : 'Không đủ nến'
    },
  },
  {
    id: 'round', title: 'Số tròn',
    categoryOf: (e) => {
      const d = e.context?.roundDistAtr
      if (d === undefined) return 'Không rõ'
      return d < 0.3 ? `Sát số tròn (< 0.3 ATR, bước ${e.context!.roundStep})` : 'Xa số tròn'
    },
  },
  { id: 'session', title: 'Phiên giao dịch', categoryOf: (e) => SESSION_LABEL[e.context!.session] },
]

export interface CategoryStat {
  label: string
  count: number
  wins: number
  pnl: number
}

/** Thống kê thắng/thua theo từng nhóm của một yếu tố, sắp theo lãi/lỗ giảm dần */
export function groupByFeature(evals: TradeEvaluation[], f: EvaluationFeature, o: EvaluationOptions): CategoryStat[] {
  const map = new Map<string, CategoryStat>()
  for (const e of evals) {
    if (!e.ok) continue
    const label = f.categoryOf(e, o)
    const s = map.get(label) ?? { label, count: 0, wins: 0, pnl: 0 }
    s.count++
    if (e.win) s.wins++
    s.pnl += e.position.netProfit
    map.set(label, s)
  }
  return [...map.values()].sort((a, b) => b.pnl - a.pnl)
}
