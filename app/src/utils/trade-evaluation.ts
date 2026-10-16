import type { Candle } from '../api/mt5-candles-csv-parser'
import type { Mt5Position } from '../api/mt5-report-parser'
import {
  atrAt, candlePattern, emaSeries, lastClosedIndex, swingPoints, trendFromSwings,
  type CandlePattern, type Trend,
} from './price-action-features'
import { evaluateContext, PREV_DAY_LABEL, type ContextEvaluation } from './trade-context-features'

/** Tham số đánh giá (chỉnh được trên giao diện) */
export interface EvaluationOptions {
  /** Độ mạnh swing: số nến mỗi bên của fractal */
  swingStrength: number
  /** Số nến nhìn lại để tìm swing */
  lookback: number
  /** Số nến dùng để đo vị trí trong range */
  rangeBars: number
  /** Ngưỡng "sát cản" theo ATR */
  nearLevelAtr: number
}

export const DEFAULT_EVALUATION_OPTIONS: EvaluationOptions = { swingStrength: 3, lookback: 120, rangeBars: 20, nearLevelAtr: 0.5 }

export interface TradeEvaluation {
  position: Mt5Position
  win: boolean
  /** false khi không đủ nến trước thời điểm vào lệnh */
  ok: boolean
  trend?: Trend
  alignment?: 'with' | 'against' | 'range'
  breakout?: 'above-high' | 'below-low' | 'inside'
  /** Vị trí giá vào trong range rangeBars nến: 0 = đáy, 1 = đỉnh */
  rangePos?: number
  /** Khoảng cách tới cản phía trước (Buy: đỉnh swing trên; Sell: đáy swing dưới), theo ATR; undefined = không có cản */
  levelDistAtr?: number
  pattern?: CandlePattern
  patternAgree?: 'confirm' | 'against' | 'neutral'
  ema?: 'above-up' | 'above-down' | 'below-up' | 'below-down'
  /** ATR hiện tại / ATR trung bình 50 nến */
  volRatio?: number
  /** Bối cảnh rộng: khung H1/H4, ngày hôm trước, số tròn, phiên */
  context?: ContextEvaluation
  /** Mô tả ngắn bằng tiếng Việt */
  summary: string
}

const BULL: CandlePattern[] = ['bull-engulfing', 'bull-pin', 'bull']
const BEAR: CandlePattern[] = ['bear-engulfing', 'bear-pin', 'bear']

const emaCache = new WeakMap<Candle[], number[]>()
const ema20 = (c: Candle[]) => {
  let e = emaCache.get(c)
  if (!e) emaCache.set(c, (e = emaSeries(c, 20)))
  return e
}

export const TREND_LABEL: Record<Trend, string> = { up: 'Xu hướng tăng', down: 'Xu hướng giảm', range: 'Sideway' }
export const PATTERN_LABEL: Record<CandlePattern, string> = {
  'bull-engulfing': 'Engulfing tăng', 'bear-engulfing': 'Engulfing giảm', 'bull-pin': 'Pin bar tăng',
  'bear-pin': 'Pin bar giảm', doji: 'Doji', inside: 'Inside bar', bull: 'Nến tăng', bear: 'Nến giảm',
}

/** Đánh giá bối cảnh thị trường tại thời điểm vào một lệnh */
export function evaluateTrade(p: Mt5Position, c: Candle[], tfSec: number, o: EvaluationOptions): TradeEvaluation {
  const win = p.netProfit >= 0
  const entrySec = Date.parse(p.openTime) / 1000
  const idx = lastClosedIndex(c, entrySec, tfSec)
  if (idx < Math.max(60, o.rangeBars + 2)) {
    return { position: p, win, ok: false, summary: 'Không đủ nến trước thời điểm vào lệnh' }
  }
  const isBuy = p.type === 'buy'
  const atr = atrAt(c, idx) ?? 0
  const entry = p.openPrice

  // Cấu trúc: swing trong lookback nến
  const swings = swingPoints(c, o.swingStrength, idx - o.lookback, idx)
  const { trend, lastHigh, lastLow } = trendFromSwings(swings)
  const alignment = trend === 'range' ? 'range' : (trend === 'up') === isBuy ? 'with' : 'against'
  const close = c[idx].close
  const breakout = lastHigh && close > lastHigh.price ? 'above-high' : lastLow && close < lastLow.price ? 'below-low' : 'inside'

  // Vị trí trong range
  let hi = -Infinity
  let lo = Infinity
  for (let i = idx - o.rangeBars + 1; i <= idx; i++) {
    hi = Math.max(hi, c[i].high)
    lo = Math.min(lo, c[i].low)
  }
  const rangePos = hi > lo ? Math.min(1, Math.max(0, (entry - lo) / (hi - lo))) : 0.5

  // Cản phía trước: Buy → đỉnh swing gần nhất trên giá vào; Sell → đáy swing gần nhất dưới giá vào
  const ahead = swings
    .filter((s) => (isBuy ? s.kind === 'high' && s.price > entry : s.kind === 'low' && s.price < entry))
    .map((s) => Math.abs(s.price - entry))
  const levelDistAtr = ahead.length && atr > 0 ? Math.min(...ahead) / atr : undefined

  // Nến đóng cuối cùng trước khi vào lệnh
  const pattern = candlePattern(c, idx)
  const patternAgree = (isBuy ? BULL : BEAR).includes(pattern) ? 'confirm' : (isBuy ? BEAR : BULL).includes(pattern) ? 'against' : 'neutral'

  // EMA20: vị trí và độ dốc 5 nến
  const e = ema20(c)
  const ema = `${close >= e[idx] ? 'above' : 'below'}-${e[idx] >= e[idx - 5] ? 'up' : 'down'}` as TradeEvaluation['ema']

  // Biến động: ATR hiện tại so với trung bình ATR 50 nến trước
  let atrSum = 0
  let n = 0
  for (let i = idx - 50; i < idx; i += 5) {
    const a = atrAt(c, i)
    if (a) {
      atrSum += a
      n++
    }
  }
  const volRatio = n && atrSum ? atr / (atrSum / n) : undefined

  const parts = [
    `${isBuy ? 'Buy' : 'Sell'} ${alignment === 'with' ? 'thuận' : alignment === 'against' ? 'ngược' : 'trong'} ${TREND_LABEL[trend].toLowerCase()}`,
    breakout === 'above-high' ? 'giá đã phá đỉnh swing' : breakout === 'below-low' ? 'giá đã thủng đáy swing' : '',
    `vào ở ${Math.round(rangePos * 100)}% range ${o.rangeBars} nến`,
    levelDistAtr === undefined ? 'không có cản gần' : `cách ${isBuy ? 'kháng cự' : 'hỗ trợ'} ${levelDistAtr.toFixed(1)} ATR`,
    `nến trước: ${PATTERN_LABEL[pattern].toLowerCase()}${patternAgree === 'against' ? ' (ngược chiều)' : patternAgree === 'confirm' ? ' (xác nhận)' : ''}`,
  ].filter(Boolean)

  const context = evaluateContext(p, c, tfSec, o.swingStrength)
  if (context.h1) parts.push(`H1 ${TREND_LABEL[context.h1].toLowerCase()}`)
  if (context.prevDay) parts.push(PREV_DAY_LABEL[context.prevDay].toLowerCase())

  return {
    position: p, win, ok: true, trend, alignment, breakout, rangePos, levelDistAtr, pattern, patternAgree, ema, volRatio, context,
    summary: parts.join(', '),
  }
}
