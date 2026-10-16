/**
 * Kiểu dữ liệu + hàm dựng nến minh hoạ cho trang Thuật ngữ.
 * Nến là dữ liệu vẽ tay (không phải giá thật) — chỉ để minh hoạ khái niệm.
 */

/** [open, high, low, close] */
export type Ohlc = [number, number, number, number]

export interface SketchLabel { i: number; at: 'high' | 'low'; text: string; tone?: 'pos' | 'neg' }
export interface SketchLine { y: number; text?: string; from?: number; to?: number; solid?: boolean }
export interface SketchBand { from: number; to: number; text?: string }
export interface SketchPriceBand { y1: number; y2: number; text?: string }
export interface SketchMarker { i: number; y: number; kind: 'buy' | 'sell' | 'exit'; text?: string }
export interface SketchMeasure { i: number; y1: number; y2: number; text: string }

/** Khung RSI vẽ dưới chart giá (thang 0–100) */
export interface SketchRsi {
  /** Giá trị RSI theo từng nến; null = bỏ qua */
  ys: (number | null)[]
  /** Tên đường RSI chính trong chú thích (khi có thêm đường phụ) */
  mainText?: string
  /** Mức ngang, ví dụ 80 / 40 */
  levels?: { v: number; text?: string }[]
  /** Tô vùng giữa 2 mức, ví dụ 40–80 */
  zone?: { from: number; to: number }
  /** Nhãn tại điểm RSI */
  labels?: { i: number; text: string; at?: 'high' | 'low' }[]
  /** Đoạn nối (ví dụ đường phân kỳ) [chỉ số nến, giá trị RSI] */
  segments?: { pts: [number, number][]; text?: string }[]
  /** Đường phụ trên RSI (ví dụ SMA9 / WMA45) */
  paths?: { ys: (number | null)[]; text?: string; tone?: 'fast' | 'slow' }[]
}

export interface Sketch {
  caption?: string
  /** Đoạn nối trên chart giá (ví dụ đường phân kỳ, đường xu hướng) [chỉ số nến, giá] */
  segments?: { pts: [number, number][]; text?: string }[]
  rsi?: SketchRsi
  candles: Ohlc[]
  labels?: SketchLabel[]
  lines?: SketchLine[]
  bands?: SketchBand[]
  priceBands?: SketchPriceBand[]
  /** Đường (ví dụ EMA); null = bỏ qua điểm */
  path?: { ys: (number | null)[]; text?: string }
  /** Nối các điểm swing [chỉ số nến, giá] */
  zigzag?: [number, number][]
  markers?: SketchMarker[]
  /** Đoạn đo dọc (ví dụ MAE / MFE, khoảng cách tới cản) */
  measures?: SketchMeasure[]
  /** Vạch dọc phân chia (ví dụ qua ngày mới) */
  dividers?: { i: number; text?: string }[]
}

export interface GlossaryTerm {
  id: string
  title: string
  /** Tên khác / viết tắt */
  aka?: string
  /** Đoạn văn mô tả (cho phép <b>, <i>, <code>) */
  body: string[]
  sketches?: Sketch[]
  /** Dùng ở đâu trong dashboard */
  usedIn?: string
  /** Chiếm cả hàng (nội dung dài / bảng) */
  wide?: boolean
}

export interface GlossarySection { id: string; title: string; terms: GlossaryTerm[] }

/** Nến từ chuỗi giá đóng: open = close trước, bóng nến `wick` mỗi phía */
export function fromCloses(closes: number[], wick = 0.5, firstOpen?: number): Ohlc[] {
  return closes.map((c, k) => {
    const o = k === 0 ? (firstOpen ?? c - 0.6) : closes[k - 1]
    return [o, Math.max(o, c) + wick, Math.min(o, c) - wick, c]
  })
}

/** Giá đóng đi zigzag qua các điểm swing, mỗi chân `steps` nến; chỉ số nến của điểm swing thứ k = k * steps */
export function zigzagCloses(pivots: number[], steps = 3): number[] {
  const out = [pivots[0]]
  for (let k = 1; k < pivots.length; k++) {
    for (let s = 1; s <= steps; s++) out.push(pivots[k - 1] + ((pivots[k] - pivots[k - 1]) * s) / steps)
  }
  return out
}

/**
 * Nến zigzag: swing high có bóng trên dài hơn, swing low bóng dưới dài hơn để đỉnh/đáy rõ ràng.
 * Trả về nến + toạ độ điểm swing (để nối zigzag và gắn nhãn).
 */
export function zigzagCandles(pivots: number[], steps = 3, wick = 0.4): { candles: Ohlc[]; swings: [number, number][] } {
  const closes = zigzagCloses(pivots, steps)
  const candles = fromCloses(closes, wick)
  const swings: [number, number][] = pivots.map((p, k) => {
    const i = k * steps
    const up = k === 0 ? p < pivots[1] : p > pivots[k - 1]
    const c = candles[i]
    if (up) c[1] = p + wick * 2.2
    else c[2] = p - wick * 2.2
    return [i, up ? c[1] : c[2]]
  })
  return { candles, swings }
}

/** Gắn nhãn lần lượt cho các điểm swing (bỏ qua nhãn rỗng) */
export function swingLabels(swings: [number, number][], candles: Ohlc[], texts: string[]): SketchLabel[] {
  return swings.flatMap(([i, y], k) => {
    const text = texts[k]
    if (!text) return []
    const at = y >= candles[i][1] ? 'high' : 'low'
    return [{ i, at, text }]
  })
}

/** EMA chu kỳ n trên giá đóng (dùng cho hình minh hoạ) */
export function ema(closes: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const out: number[] = []
  closes.forEach((c, i) => out.push(i === 0 ? c : c * k + out[i - 1] * (1 - k)))
  return out
}

/** Nội suy tuyến tính qua các điểm [chỉ số nến, giá trị] → mảng `n` phần tử (dùng vẽ RSI minh hoạ) */
export function piecewise(points: [number, number][], n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const k = points.findIndex(([x]) => x >= i)
    if (k <= 0) out.push(points[Math.max(0, k)][1])
    else {
      const [x0, y0] = points[k - 1]
      const [x1, y1] = points[k]
      out.push(y0 + ((y1 - y0) * (i - x0)) / (x1 - x0))
    }
  }
  return out
}

/** RSI Wilder chu kỳ n trên giá đóng (giá trị đầu chưa ổn định → nên bỏ phần khởi động) */
export function rsiWilder(closes: number[], n: number): number[] {
  let up = 0
  let down = 0
  return closes.map((c, i) => {
    if (i === 0) return 50
    const d = c - closes[i - 1]
    const u = Math.max(0, d)
    const l = Math.max(0, -d)
    if (i <= n) {
      up += u / n
      down += l / n
    } else {
      up = (up * (n - 1) + u) / n
      down = (down * (n - 1) + l) / n
    }
    return down === 0 ? 100 : 100 - 100 / (1 + up / down)
  })
}

/** Trung bình động đơn giản chu kỳ n (null cho đến khi đủ n điểm) */
export function sma(values: number[], n: number): (number | null)[] {
  return values.map((_, i) => (i < n - 1 ? null : values.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n))
}
