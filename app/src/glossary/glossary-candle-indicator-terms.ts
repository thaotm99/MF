import { ema, fromCloses, type GlossarySection, type Ohlc, type Sketch } from './glossary-sketch-builders'

/** Vài nến dẫn + mẫu nến cuối, gắn nhãn nến cuối */
function pattern(lead: number[], tail: Ohlc[], label: string, caption: string): Sketch {
  const candles = [...fromCloses(lead, 0.3), ...tail]
  const i = candles.length - 1
  return { caption, candles, labels: [{ i, at: 'high', text: label }], bands: [{ from: i - (tail.length > 1 ? 1 : 0), to: i }] }
}

const emaSketch = (() => {
  const closes = [10, 10.6, 10.2, 11, 11.8, 11.4, 12.4, 13.2, 12.8, 13.8, 14.6, 14.1, 15, 15.8, 15.2, 16.2]
  return {
    caption: 'Giá trên EMA, EMA dốc lên',
    candles: fromCloses(closes, 0.4),
    path: { ys: ema(closes, 6), text: 'EMA20' },
  }
})()

const atrSketch = (() => {
  const closes = [12, 12.4, 12.1, 12.6, 12.3, 12.8, 12.5, 13, 12.7, 13.2, 12.9, 13.3, 13.0, 13.5]
  const candles = fromCloses(closes, 0.5)
  return {
    caption: 'ATR14 = trung bình biên độ (True Range) 14 nến',
    candles,
    bands: [{ from: 0, to: 13, text: '14 nến' }],
    measures: [{ i: 13, y1: candles[13][2], y2: candles[13][1], text: 'TR' }],
  }
})()

const volSketch = (() => {
  const closes = [12, 12.3, 12.1, 12.4, 12.2, 12.5, 12.3, 12.6, 14, 12.4, 15.2, 13.2, 16.4]
  const candles = fromCloses(closes, 0.25)
  for (const i of [8, 9, 10, 11, 12]) { candles[i][1] += 0.8; candles[i][2] -= 0.8 }
  return { caption: 'Nến biên độ lớn bất thường → ATR > 1.25× trung bình', candles, bands: [{ from: 8, to: 12, text: 'Biến động cao' }] }
})()

const erSketches: Sketch[] = [
  { caption: 'ER cao (≈ 1): 5 nến đi một chiều', candles: fromCloses([10, 11, 12, 13, 14, 15], 0.3), bands: [{ from: 1, to: 5, text: 'ER ≈ 1' }] },
  { caption: 'ER thấp (≈ 0.1): giật lên xuống, đi được rất ít', candles: fromCloses([12, 13.4, 11.8, 13.2, 12, 12.4], 0.3), bands: [{ from: 1, to: 5, text: 'ER ≈ 0.1' }] },
]

export const CANDLE_SECTION: GlossarySection = {
  id: 'candles',
  title: 'Mẫu nến',
  terms: [
    {
      id: 'engulfing', title: 'Engulfing (nến nhấn chìm)',
      body: [
        'Nến ngược màu nến trước, <b>thân lớn hơn và bao trọn thân</b> nến trước. Engulfing tăng sau một nhịp giảm là tín hiệu đảo chiều lên (và ngược lại).',
        'Ở Đánh giá lệnh: engulfing cùng chiều lệnh = "xác nhận"; ngược chiều = "ngược chiều". Ở phần Trước khi đóng: engulfing ngược chiều lệnh = nến đảo chiều.',
      ],
      sketches: [
        pattern([13, 12.4, 11.8, 11.2], [[11.2, 11.4, 10.4, 10.6], [10.4, 12.2, 10.2, 12]], 'Engulfing tăng', 'Nến tăng bao trọn thân nến giảm trước'),
        pattern([10, 10.6, 11.2, 11.8], [[11.8, 12.6, 11.6, 12.4], [12.6, 12.8, 10.9, 11.1]], 'Engulfing giảm', 'Nến giảm bao trọn thân nến tăng trước'),
      ],
    },
    {
      id: 'pinbar', title: 'Pin bar', aka: 'Nến rút chân, hammer / shooting star',
      body: [
        'Bóng dưới (pin tăng) hoặc bóng trên (pin giảm) <b>≥ 2× thân</b> và <b>≥ 60%</b> chiều dài cả nến: giá bị từ chối mạnh ở vùng đó.',
      ],
      sketches: [
        pattern([13, 12.4, 11.8, 11.2], [[11.1, 11.5, 9.0, 11.4]], 'Pin tăng', 'Bóng dưới dài: giá bị đẩy lên lại'),
        pattern([10, 10.6, 11.2, 11.8], [[11.9, 14.1, 11.6, 11.7]], 'Pin giảm', 'Bóng trên dài: giá bị đẩy xuống lại'),
      ],
    },
    {
      id: 'doji', title: 'Doji',
      body: ['Thân nến <b>≤ 10%</b> chiều dài nến: mở và đóng gần như bằng nhau — thị trường lưỡng lự.'],
      sketches: [pattern([10, 10.6, 11.2, 11.8], [[11.8, 12.8, 10.8, 11.85]], 'Doji', 'Thân rất nhỏ, hai bóng')],
    },
    {
      id: 'inside', title: 'Inside bar',
      body: ['High thấp hơn và Low cao hơn nến trước: nến nằm gọn trong nến trước — tích luỹ, thường chờ phá ra một phía.'],
      sketches: [pattern([10, 10.8, 11.6], [[11.6, 13.6, 11.2, 13.2], [13.1, 13.2, 12.2, 12.5]], 'Inside', 'Nến sau nằm gọn trong nến trước')],
    },
  ],
}

export const INDICATOR_SECTION: GlossarySection = {
  id: 'indicators',
  title: 'Chỉ báo',
  terms: [
    {
      id: 'atr', title: 'ATR (Average True Range)', aka: 'A trong comment lệnh',
      body: [
        '<b>True Range</b> của một nến = lớn nhất của: High − Low, |High − Close trước|, |Low − Close trước|. <b>ATR14</b> = trung bình TR của 14 nến.',
        'Dashboard dùng ATR làm "thước đo" chung: khoảng cách tới cản, MAE/MFE, lợi nhuận trả lại… đều tính theo ATR để so được các thời điểm biên độ khác nhau.',
        'Comment lệnh của EA ghi ATR lúc vào lệnh (<code>A:</code>), dùng cho Biểu đồ và bản đồ nhiệt.',
      ],
      sketches: [atrSketch],
    },
    {
      id: 'ema', title: 'EMA20',
      body: [
        'Đường trung bình động hàm mũ 20 nến (nến gần có trọng số lớn hơn). Chia 4 nhóm: giá <b>trên / dưới</b> EMA × EMA <b>dốc lên / xuống</b> (so với EMA 5 nến trước).',
      ],
      sketches: [emaSketch],
    },
    {
      id: 'volatility', title: 'Biến động', aka: 'ATR so với trung bình',
      body: [
        'ATR hiện tại chia cho ATR trung bình 50 nến trước. <b>&gt; 1.25×</b> = biến động tăng (nhãn tự động "Biến động cao"), <b>&lt; 0.8×</b> = biến động thấp, còn lại bình thường.',
      ],
      sketches: [volSketch],
    },
    {
      id: 'er', title: 'ER5 (Efficiency Ratio)', aka: 'er5 / er trong comment lệnh',
      body: [
        'Độ "hiệu quả" của giá trong 5 nến M5: <code>|giá đóng cuối − giá đóng đầu| / tổng |thay đổi từng nến|</code>. Gần 1 = đi một chiều (trend), gần 0 = giật qua lại (nhiễu).',
        'EA ghi ER5 lúc vào lệnh trong comment (<code>er5:</code>); dashboard đọc lại để chia nhóm ở Biểu đồ và bản đồ nhiệt.',
      ],
      sketches: erSketches,
    },
  ],
}
