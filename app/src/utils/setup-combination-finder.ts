import type { EvaluationOptions, TradeEvaluation } from './trade-evaluation'
import type { EvaluationFeature } from './trade-evaluation-features'

/**
 * Tìm tổ hợp 2–3 điều kiện lúc vào lệnh có kết quả tốt nhất / tệ nhất.
 * Chống "tối ưu quá khớp": tìm trên giai đoạn đầu (train, theo thời gian), rồi báo kết quả của chính tổ hợp đó
 * trên giai đoạn sau (kiểm tra) — giai đoạn này không dùng để chọn.
 */
export interface Stat { count: number; wins: number; pnl: number }

export interface ComboResult {
  key: string
  conditions: { feature: string; label: string }[]
  train: Stat
  test: Stat
}

export interface ComboSearch {
  best: ComboResult[]
  worst: ComboResult[]
  baseline: { train: Stat; test: Stat }
  /** Thời điểm chia train / kiểm tra (ISO giờ vào lệnh của lệnh đầu tiên thuộc giai đoạn kiểm tra) */
  splitTime?: string
}

export interface ComboOptions {
  minCount: number
  /** Tỷ lệ lệnh (theo thời gian) dùng để tìm tổ hợp */
  trainRatio: number
  topN: number
}

/** Nhóm "thiếu dữ liệu" không phải điều kiện có ý nghĩa */
const UNINFORMATIVE = /^(Không đủ nến|Không rõ)/

const empty = (): Stat => ({ count: 0, wins: 0, pnl: 0 })
const add = (s: Stat, e: TradeEvaluation) => {
  s.count++
  if (e.win) s.wins++
  s.pnl += e.position.netProfit
}

/** Mọi bộ chỉ số yếu tố kích thước 2 và 3 */
function indexTuples(n: number): number[][] {
  const out: number[][] = []
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      out.push([a, b])
      for (let c = b + 1; c < n; c++) out.push([a, b, c])
    }
  return out
}

export function findSetupCombinations(
  evals: TradeEvaluation[],
  features: EvaluationFeature[],
  o: EvaluationOptions,
  opts: ComboOptions,
): ComboSearch {
  const ok = evals.filter((e) => e.ok).sort((a, b) => a.position.openTime.localeCompare(b.position.openTime))
  const split = Math.floor(ok.length * opts.trainRatio)
  const baseline = { train: empty(), test: empty() }
  const tuples = indexTuples(features.length)
  const map = new Map<string, ComboResult>()

  ok.forEach((e, i) => {
    const phase = i < split ? 'train' : 'test'
    add(baseline[phase], e)
    const labels = features.map((f) => f.categoryOf(e, o))
    for (const t of tuples) {
      if (t.some((k) => UNINFORMATIVE.test(labels[k]))) continue
      const key = t.map((k) => `${k}:${labels[k]}`).join('|')
      let r = map.get(key)
      if (!r) {
        r = { key, conditions: t.map((k) => ({ feature: features[k].title, label: labels[k] })), train: empty(), test: empty() }
        map.set(key, r)
      }
      add(r[phase], e)
    }
  })

  const candidates = [...map.values()].filter((r) => r.train.count >= opts.minCount)
  /** Bỏ tổ hợp chỉ là "bản mở rộng" của tổ hợp đơn giản hơn đã chọn — ưu tiên điều kiện ít hơn */
  const pickTop = (sorted: ComboResult[]) => {
    const picked: ComboResult[] = []
    for (const r of sorted) {
      const keys = new Set(r.key.split('|'))
      if (picked.some((p) => p.key.split('|').every((k) => keys.has(k)))) continue
      picked.push(r)
      if (picked.length >= opts.topN) break
    }
    return picked
  }
  return {
    best: pickTop([...candidates].sort((a, b) => b.train.pnl - a.train.pnl).filter((r) => r.train.pnl > 0)),
    worst: pickTop([...candidates].sort((a, b) => a.train.pnl - b.train.pnl).filter((r) => r.train.pnl < 0)),
    baseline,
    splitTime: ok[split]?.position.openTime,
  }
}
