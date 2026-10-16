import { fromCloses, swingLabels, zigzagCandles, type GlossarySection, type Sketch } from './glossary-sketch-builders'

/** Sketch zigzag có nối swing + nhãn */
function structure(pivots: number[], texts: string[], caption: string, extra: Partial<Sketch> = {}): Sketch {
  const { candles, swings } = zigzagCandles(pivots, 3)
  return { caption, candles, zigzag: swings, labels: swingLabels(swings, candles, texts), ...extra }
}

const fractal = (() => {
  const closes = [10, 10.8, 11.6, 12.6, 11.8, 11, 10.2, 9.4, 10.2, 11]
  const candles = fromCloses(closes, 0.35)
  candles[3][1] = 13.4 // đỉnh rõ
  candles[7][2] = 8.7 // đáy rõ
  return {
    caption: 'Fractal 2 nến: đỉnh cao hơn 2 nến mỗi bên',
    candles,
    labels: [{ i: 3, at: 'high' as const, text: 'Swing high' }, { i: 7, at: 'low' as const, text: 'Swing low' }],
    bands: [{ from: 1, to: 5, text: '2 trái · 2 phải' }],
  }
})()

const breakout = (() => {
  const { candles, swings } = zigzagCandles([10, 15, 12, 15.5], 3)
  const extra = fromCloses([16.4, 17.2], 0.4, 15.5)
  const all = [...candles, ...extra]
  return {
    caption: 'Nến đóng trên đỉnh swing gần nhất → "phá đỉnh"',
    candles: all,
    zigzag: swings.slice(0, 3),
    lines: [{ y: swings[1][1], from: 3, text: 'Đỉnh swing' }],
    labels: [{ i: 10, at: 'high' as const, text: 'Phá đỉnh' }],
    markers: [{ i: 11, y: all[11][2], kind: 'buy' as const, text: 'Buy' }],
  }
})()

const rangePos = (() => {
  const closes = [12, 13.5, 12.8, 14.6, 15.8, 14.4, 13.2, 12.4, 13.6, 15, 16.2, 17.4, 16.8, 18, 18.8]
  const candles = fromCloses(closes, 0.5)
  const hi = Math.max(...candles.map((c) => c[1]))
  const lo = Math.min(...candles.map((c) => c[2]))
  const a = lo + (hi - lo) / 3
  const b = lo + ((hi - lo) * 2) / 3
  return {
    caption: 'Buy ở 92% range → "vùng cao"',
    candles,
    priceBands: [{ y1: b, y2: hi, text: 'Vùng cao' }, { y1: lo, y2: a, text: 'Vùng thấp' }],
    lines: [{ y: hi, text: 'High range', solid: true }, { y: lo, text: 'Low range', solid: true }, { y: (a + b) / 2, text: 'Giữa' }],
    markers: [{ i: 14, y: candles[14][2], kind: 'buy' as const, text: 'Buy' }],
  }
})()

const resistance = (() => {
  const { candles, swings } = zigzagCandles([12, 18, 13, 17], 3)
  const top = swings[1][1]
  const entryY = candles[9][3]
  return {
    caption: 'Buy cách đỉnh swing phía trên 0.4 ATR → "sát cản"',
    candles,
    zigzag: swings,
    lines: [{ y: top, from: 3, text: 'Cản' }],
    measures: [{ i: 9, y1: entryY, y2: top, text: '0.4 ATR' }],
    markers: [{ i: 9, y: candles[9][2], kind: 'buy' as const, text: 'Buy' }],
  }
})()

export const STRUCTURE_SECTION: GlossarySection = {
  id: 'structure',
  title: 'Cấu trúc thị trường',
  terms: [
    {
      id: 'swing', title: 'Swing high / Swing low', aka: 'Đỉnh / đáy swing, fractal',
      body: [
        '<b>Swing high</b> là nến có High cao hơn High của <i>k</i> nến bên trái và <i>k</i> nến bên phải; <b>swing low</b> tương tự với Low.',
        '<i>k</i> là "độ mạnh swing" (mặc định 3). Swing chỉ được xác nhận khi đã đóng đủ <i>k</i> nến bên phải, nên luôn <b>trễ k nến</b> — đúng như bot thấy lúc vào lệnh.',
      ],
      sketches: [fractal],
      usedIn: 'Đánh giá lệnh (độ mạnh swing), Chart giá (Cấu trúc HH/HL/LH/LL)',
    },
    {
      id: 'uptrend', title: 'Xu hướng tăng: HH + HL', aka: 'Higher High, Higher Low',
      body: [
        '<b>HH</b> (Higher High): đỉnh swing sau cao hơn đỉnh trước. <b>HL</b> (Higher Low): đáy swing sau cao hơn đáy trước.',
        'Hai đỉnh gần nhất là HH <u>và</u> hai đáy gần nhất là HL ⇒ <b>xu hướng tăng</b>.',
      ],
      sketches: [structure([10, 16, 13, 19, 16, 22, 19.5], ['', 'H', 'L', 'HH', 'HL', 'HH', 'HL'], 'Đỉnh và đáy cùng nâng dần')],
    },
    {
      id: 'downtrend', title: 'Xu hướng giảm: LH + LL', aka: 'Lower High, Lower Low',
      body: [
        '<b>LH</b> (Lower High): đỉnh sau thấp hơn đỉnh trước. <b>LL</b> (Lower Low): đáy sau thấp hơn đáy trước.',
        'Hai đỉnh gần nhất là LH <u>và</u> hai đáy gần nhất là LL ⇒ <b>xu hướng giảm</b>.',
      ],
      sketches: [structure([22, 16, 19, 13, 16, 10, 12.5], ['', 'L', 'H', 'LL', 'LH', 'LL', 'LH'], 'Đỉnh và đáy cùng hạ dần')],
    },
    {
      id: 'sideway', title: 'Sideway', aka: 'Đi ngang, range',
      body: [
        'Mọi trường hợp còn lại: đỉnh và đáy <b>không cùng hướng</b>, hoặc chưa đủ 2 đỉnh + 2 đáy trong vùng nhìn lại (120 nến).',
        'Gồm 3 dạng hay gặp: đi ngang trong biên (đỉnh/đáy xấp xỉ nhau), <b>mở rộng</b> (HH nhưng LL) và <b>co hẹp / tam giác</b> (LH nhưng HL).',
        'Lưu ý: đây là sideway theo <i>cấu trúc đỉnh/đáy</i>, không đo độ rộng biên độ.',
      ],
      sketches: [
        structure([13, 19, 12.8, 19.2, 13.1, 18.9, 13], ['', 'H', 'L', 'H', 'L', 'H', 'L'], 'Đi ngang trong biên', {
          priceBands: [{ y1: 12.2, y2: 19.9, text: 'Biên' }],
        }),
        structure([16, 18, 14, 20, 12, 22, 11], ['', 'H', 'L', 'HH', 'LL', 'HH', 'LL'], 'Mở rộng: HH + LL'),
        structure([10, 22, 12, 20, 14, 18, 15.5], ['', 'H', 'L', 'LH', 'HL', 'LH', 'HL'], 'Co hẹp: LH + HL'),
      ],
    },
    {
      id: 'alignment', title: 'Thuận / ngược xu hướng',
      body: [
        '<b>Thuận</b>: Buy trong xu hướng tăng, Sell trong xu hướng giảm. <b>Ngược</b>: Buy trong xu hướng giảm, Sell trong xu hướng tăng. Xu hướng là sideway ⇒ "trong sideway".',
        'Nhãn tự động <b>Ngược xu hướng</b> dùng cả khung vào lệnh và khung H1.',
      ],
      sketches: [(() => {
        const s = structure([22, 16, 19, 13, 16, 10, 12.5], ['', 'L', 'H', 'LL', 'LH', 'LL', ''], 'Buy trong xu hướng giảm = ngược xu hướng')
        return { ...s, markers: [{ i: 18, y: s.candles[18][2], kind: 'buy' as const, text: 'Buy (ngược)' }] }
      })()],
    },
    {
      id: 'breakout', title: 'Phá cấu trúc', aka: 'Phá đỉnh / thủng đáy, breakout',
      body: [
        'Giá <b>đóng</b> của nến cuối trước khi vào lệnh vượt lên trên đỉnh swing gần nhất = <b>phá đỉnh</b>; đóng dưới đáy swing gần nhất = <b>thủng đáy</b>; còn lại = còn trong đỉnh/đáy swing.',
      ],
      sketches: [breakout],
    },
    {
      id: 'range-position', title: 'Vị trí vào trong range',
      body: [
        'Lấy High cao nhất và Low thấp nhất của N nến gần nhất (mặc định 20), tính <code>(giá vào − Low) / (High − Low)</code>: 0 = đáy, 1 = đỉnh.',
        'Chia 3: dưới 1/3 = <b>vùng thấp</b>, 1/3–2/3 = <b>giữa range</b>, trên 2/3 = <b>vùng cao</b>.',
      ],
      sketches: [rangePos],
    },
    {
      id: 'level', title: 'Cản phía trước',
      body: [
        'Buy: đỉnh swing gần nhất <i>nằm trên</i> giá vào. Sell: đáy swing gần nhất <i>nằm dưới</i> giá vào. Khoảng cách tính theo ATR.',
        'Nhóm: <b>sát cản</b> (&lt; 0.5 ATR), cản gần (0.5–1.5 ATR), có khoảng trống (≥ 1.5 ATR), hoặc không có cản gần.',
      ],
      sketches: [resistance],
    },
  ],
}
