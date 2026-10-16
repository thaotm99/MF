import { fromCloses, swingLabels, zigzagCandles, type GlossarySection, type Ohlc, type Sketch } from './glossary-sketch-builders'

const hi = (c: Ohlc[]) => Math.max(...c.map((x) => x[1]))
const lo = (c: Ohlc[]) => Math.min(...c.map((x) => x[2]))

// ----- Khung lớn: H1 tăng, M15 đang hồi giảm -----
const htf = (() => {
  const h1 = zigzagCandles([10, 16, 13, 19, 16, 22, 19], 3)
  const m15 = zigzagCandles([22, 20.6, 21.4, 19.8, 20.6, 19], 3, 0.15)
  const s1: Sketch = {
    caption: 'H1: HH + HL → xu hướng tăng',
    candles: h1.candles, zigzag: h1.swings,
    labels: swingLabels(h1.swings, h1.candles, ['', 'H', 'L', 'HH', 'HL', 'HH', '']),
    bands: [{ from: 15, to: 18, text: 'Đoạn M15 bên cạnh' }],
  }
  const s2: Sketch = {
    caption: 'M15 cùng lúc: LH + LL (nhịp hồi) → Sell thuận M15 nhưng ngược H1',
    candles: m15.candles, zigzag: m15.swings,
    labels: swingLabels(m15.swings, m15.candles, ['', 'L', 'H', 'LL', 'LH', 'LL']),
    markers: [{ i: 15, y: m15.candles[15][1], kind: 'sell', text: 'Sell' }],
  }
  return [s1, s2]
})()

// ----- Đỉnh / đáy ngày hôm trước -----
const pd = (() => {
  const day1 = fromCloses([12, 13, 14.5, 13.8, 15, 16, 15.2, 14, 13.4, 14.2, 15.4, 14.8], 0.4)
  const day2 = fromCloses([15, 15.6, 16.2, 16.8, 17.6], 0.4, 14.8)
  const candles = [...day1, ...day2]
  return {
    caption: 'Buy trên đỉnh ngày hôm trước (PDH)',
    candles,
    dividers: [{ i: 12, text: 'Ngày mới' }],
    lines: [{ y: hi(day1), from: 12, text: 'PDH' }, { y: lo(day1), from: 12, text: 'PDL' }],
    markers: [{ i: 16, y: candles[16][2], kind: 'buy' as const, text: 'Buy' }],
  }
})()

// ----- Số tròn -----
const round = (() => {
  const candles = fromCloses([4152, 4154.2, 4153.1, 4155.8, 4157.6, 4156.4, 4158.6, 4159.4, 4158.8, 4159.5], 0.6)
  return {
    caption: 'Sell ngay dưới 4160: cách số tròn 0.2 ATR',
    candles,
    lines: [{ y: 4160, text: '4160', solid: true }, { y: 4150, text: '4150', solid: true }],
    markers: [{ i: 9, y: candles[9][1], kind: 'sell' as const, text: 'Sell' }],
  }
})()

// ----- MAE / MFE -----
const maeMfe = (() => {
  const candles = fromCloses([12, 12.4, 12, 11.4, 11.1, 11.8, 12.8, 13.6, 14.6, 15.1, 14.4, 14.1], 0.3)
  const entry = 12.4
  const minLow = Math.min(...candles.slice(1, 12).map((c) => c[2]))
  const maxHigh = Math.max(...candles.slice(1, 12).map((c) => c[1]))
  return {
    caption: 'Buy: đi ngược tối đa (MAE) và đi thuận tối đa (MFE)',
    candles,
    bands: [{ from: 1, to: 11, text: 'Thời gian giữ lệnh' }],
    lines: [{ y: entry, from: 1, text: 'Giá vào' }],
    measures: [{ i: 4, y1: entry, y2: minLow, text: 'MAE' }, { i: 9, y1: entry, y2: maxHigh, text: 'MFE' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 11, y: 14.1, kind: 'exit' as const, text: 'Ra' }],
  }
})()

// ----- Trước khi đóng: đà giá & lợi nhuận trả lại -----
const beforeClose = (() => {
  const candles = fromCloses([12, 12.8, 13.6, 14.6, 15.6, 16.4, 16.0, 15.4, 14.8, 14.6, 14.2], 0.3)
  const best = Math.max(...candles.slice(6).map((c) => c[1]))
  return {
    caption: '5 nến cuối: quay đầu, trả lại 1.6 ATR',
    candles,
    bands: [{ from: 6, to: 10, text: '5 nến trước khi đóng' }],
    lines: [{ y: best, from: 6, text: 'Giá tốt nhất' }],
    measures: [{ i: 10, y1: best, y2: 14.2, text: 'Trả lại' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 10, y: 14.2, kind: 'exit' as const, text: 'Ra' }],
  }
})()

const earlyEntry = (() => {
  const candles = fromCloses([13, 12.6, 12, 11.2, 10.8, 11.4, 12.4, 13.4, 14.2, 14.8], 0.3)
  return {
    caption: 'Ngược ≥ 1 ATR trước, rồi mới thuận ≥ 1 ATR',
    candles,
    lines: [{ y: 12.6, from: 1, text: 'Giá vào' }],
    measures: [{ i: 4, y1: 12.6, y2: candles[4][2], text: '1. ngược' }, { i: 8, y1: 12.6, y2: candles[8][1], text: '2. thuận' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 9, y: 14.8, kind: 'exit' as const, text: 'Ra' }],
  }
})()

const earlyExit = (() => {
  const candles = fromCloses([11, 11.6, 12.4, 13, 13.6, 14.6, 15.4, 16.2, 16.8, 17.4], 0.3)
  return {
    caption: 'Thoát sớm: đóng xong giá còn chạy ≥ 1 ATR',
    candles,
    bands: [{ from: 5, to: 9, text: '5 nến sau khi đóng' }],
    lines: [{ y: 13.6, from: 4, text: 'Giá đóng' }],
    measures: [{ i: 8, y1: 13.6, y2: candles[8][1], text: '≥ 1 ATR' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 4, y: 13.6, kind: 'exit' as const, text: 'Ra' }],
  }
})()

const lateExit = (() => {
  const candles = fromCloses([11, 11.8, 12.8, 14, 15, 15.6, 15, 14.2, 13.6, 13.4], 0.3)
  const best = candles[5][1]
  return {
    caption: 'Thoát muộn: lệnh thắng nhưng nhả ≥ 1 ATR từ đỉnh',
    candles,
    lines: [{ y: best, from: 5, text: 'MFE' }],
    measures: [{ i: 9, y1: best, y2: 13.4, text: 'Trả lại' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 9, y: 13.4, kind: 'exit' as const, text: 'Ra (lãi)' }],
  }
})()

const loserWasGreen = (() => {
  const candles = fromCloses([12, 12.4, 13.2, 13.8, 13.4, 12.6, 11.8, 11.2, 10.6], 0.3)
  return {
    caption: 'Từng lãi 1.2 ATR rồi về SL',
    candles,
    lines: [{ y: 12.4, from: 1, text: 'Giá vào' }, { y: 10.6, from: 1, text: 'SL' }],
    measures: [{ i: 3, y1: 12.4, y2: candles[3][1], text: 'MFE 1.2 ATR' }],
    markers: [{ i: 1, y: candles[1][2], kind: 'buy' as const, text: 'Buy' }, { i: 8, y: 10.6, kind: 'exit' as const, text: 'Ra (lỗ)' }],
  }
})()

const chase = (() => {
  const { candles, swings } = zigzagCandles([11, 14, 12.4, 14.2], 3)
  const extra = fromCloses([15.4, 16.6, 17.6], 0.4, 14.2)
  const all = [...candles, ...extra]
  return {
    caption: 'Buy sau khi phá đỉnh, ở vùng cao của range',
    candles: all,
    zigzag: swings.slice(0, 3),
    lines: [{ y: swings[1][1], from: 3, text: 'Đỉnh swing' }],
    priceBands: [{ y1: lo(all) + ((hi(all) - lo(all)) * 2) / 3, y2: hi(all), text: 'Vùng cao' }],
    markers: [{ i: 12, y: all[12][2], kind: 'buy' as const, text: 'Buy' }],
  }
})()

export const CONTEXT_SECTION: GlossarySection = {
  id: 'context',
  title: 'Bối cảnh lúc vào lệnh',
  terms: [
    {
      id: 'htf', title: 'Khung lớn H1 / H4',
      body: [
        'Gộp nến khung đánh giá (ví dụ M15) thành H1 / H4 rồi xác định cấu trúc HH/HL / LH/LL như trên. Khung nhỏ có thể đang hồi ngược trong khi khung lớn vẫn giữ xu hướng.',
        'So với chiều lệnh: <b>thuận H1</b> / <b>ngược H1</b> / H1 sideway. Thiếu ≥ 30 nến khung lớn = "không đủ nến".',
      ],
      sketches: htf,
    },
    {
      id: 'pdhl', title: 'PDH / PDL', aka: 'Đỉnh / đáy ngày hôm trước',
      body: [
        '<b>PDH</b> (Previous Day High) và <b>PDL</b> (Previous Day Low) của ngày D1 đã đóng gần nhất — mốc giá nhiều người theo dõi.',
        'Nhóm: trên PDH / sát PDH (&lt; 0.5 ATR) / trong range ngày trước / sát PDL / dưới PDL.',
      ],
      sketches: [pd],
    },
    {
      id: 'round', title: 'Số tròn', aka: 'Round number',
      body: [
        'Mức giá chẵn (vàng: 4150, 4160…) thường có nhiều lệnh chờ → hay phản ứng. Đo khoảng cách từ giá vào tới số tròn gần nhất theo ATR.',
        'Bước số tròn: giá ≥ 1000 → 10; ≥ 100 → 1; ≥ 10 → 0.1; còn lại 0.001.',
      ],
      sketches: [round],
    },
    {
      id: 'session', title: 'Phiên giao dịch',
      body: [
        'Theo giờ server UTC+0: <b>Á</b> 0–7h, <b>Âu</b> 7–12h, <b>Âu–Mỹ</b> chồng nhau 12–16h (thanh khoản và biến động cao nhất), <b>Mỹ</b> 16–21h, <b>cuối ngày</b> 21–24h.',
      ],
    },
  ],
}

export const TRADE_SECTION: GlossarySection = {
  id: 'trade',
  title: 'Trong lệnh & thoát lệnh',
  terms: [
    {
      id: 'mae-mfe', title: 'MAE / MFE',
      aka: 'Maximum Adverse / Favorable Excursion',
      body: [
        '<b>MAE</b>: giá đi <i>ngược</i> chiều lệnh xa nhất so với giá vào trong lúc giữ lệnh. <b>MFE</b>: giá đi <i>thuận</i> xa nhất. Cả hai tính theo ATR lúc vào lệnh.',
        'MAE của lệnh thắng gợi ý mức SL (SL hẹp hơn p90 sẽ cắt lệnh thắng); MFE của lệnh thua cho biết dời SL về hoà vốn có cứu được không.',
      ],
      sketches: [maeMfe],
    },
    {
      id: 'before-close', title: 'Đà giá & lợi nhuận trả lại', aka: 'Phần "Trước khi đóng lệnh"',
      body: [
        '<b>Đà giá</b>: giá đi bao nhiêu theo chiều lệnh trong N nến (mặc định 5) đã đóng ngay trước giờ đóng: ≥ +0.5 ATR = chạy thuận, ≤ −0.5 ATR = quay đầu, còn lại đi ngang.',
        '<b>Trả lại</b>: giá tốt nhất trong N nến đó so với giá đóng lệnh, theo ATR. Lưu ý: lệnh giữ ngắn hơn N nến thì cửa sổ gồm cả nến trước lúc vào.',
      ],
      sketches: [beforeClose],
    },
    {
      id: 'chase', title: 'Đuổi giá', aka: 'Nhãn tự động',
      body: ['Buy ngay sau khi phá đỉnh swing và đang ở vùng cao (&gt; 2/3) của range; Sell ngay sau khi thủng đáy và ở vùng thấp (&lt; 1/3) — dễ mua đỉnh / bán đáy.'],
      sketches: [chase],
    },
    {
      id: 'early-entry', title: 'Vào sớm', aka: 'Nhãn tự động',
      body: ['Sau khi vào, giá đi ngược ≥ 1 ATR <b>trước</b>, rồi mới chạy thuận ≥ 1 ATR — chờ thêm sẽ có giá vào tốt hơn, SL hẹp hơn.'],
      sketches: [earlyEntry],
    },
    {
      id: 'early-exit', title: 'Thoát sớm', aka: 'Nhãn tự động',
      body: ['Lệnh thắng nhưng trong 5 nến <b>sau khi đóng</b>, giá còn chạy tiếp ≥ 1 ATR theo chiều lệnh. Dùng nến sau giờ đóng nên chỉ để đánh giá lại TP/trailing, không phải điều kiện bot biết trước.'],
      sketches: [earlyExit],
    },
    {
      id: 'late-exit', title: 'Thoát muộn', aka: 'Nhãn tự động',
      body: ['Lệnh thắng nhưng đóng cách điểm tốt nhất trong lúc giữ lệnh ≥ 1 ATR (MFE − kết quả) — trailing / TP nhả nhiều lợi nhuận.'],
      sketches: [lateExit],
    },
    {
      id: 'loser-green', title: 'Thua dù từng có lãi', aka: 'Nhãn tự động',
      body: ['Lệnh thua nhưng trong lúc giữ lệnh từng có MFE ≥ 1 ATR — dời SL về hoà vốn sau khi lãi X ATR có thể đã cứu được.'],
      sketches: [loserWasGreen],
    },
  ],
}

export const STATS_SECTION: GlossarySection = {
  id: 'stats',
  title: 'Thống kê',
  terms: [
    { id: 'win', title: 'Lệnh thắng / tỉ lệ thắng', body: ['Lệnh thắng = lợi nhuận ròng (profit + commission + swap) <b>≥ 0</b>, giống "Profit Trades" của MT5. Tỉ lệ thắng = lệnh thắng / tổng lệnh.'] },
    { id: 'pf', title: 'Profit Factor', body: ['Tổng lãi của lệnh thắng / |tổng lỗ của lệnh thua|. &gt; 1 là có lãi; 1.5+ là tốt.'] },
    { id: 'expectancy', title: 'Kỳ vọng / lệnh', body: ['Lợi nhuận ròng trung bình mỗi lệnh = tổng lãi/lỗ / số lệnh. Âm nghĩa là càng giao dịch càng lỗ.'] },
    { id: 'dd', title: 'Max drawdown', body: ['Sụt giảm lớn nhất của balance so với đỉnh trước đó. Nạp / rút tiền dịch đỉnh theo, không tính là sụt giảm — khớp "Balance Drawdown Maximal" của MT5.'] },
    { id: 'streak', title: 'Chuỗi thua liên tiếp', body: ['Số lệnh lỗ (profit &lt; 0) liên tiếp dài nhất theo giờ đóng.'] },
    {
      id: 'train-test', title: 'Tìm / kiểm tra (train / test)', aka: 'Tổ hợp setup',
      body: [
        'Lệnh xếp theo thời gian: <b>70% đầu</b> để tìm tổ hợp điều kiện tốt/xấu, <b>30% sau</b> chỉ để kiểm tra lại. Tổ hợp "Lặp lại ✓" mới đáng đưa vào EA — tránh <i>tối ưu quá khớp</i> (overfitting): tìm ra quy luật chỉ đúng với dữ liệu cũ.',
      ],
    },
    { id: 'sample', title: 'Mẫu nhỏ', body: ['Nhóm dưới 5 lệnh hiện mờ: quá ít để kết luận. Nên chỉ tin nhóm có vài chục lệnh trở lên.'] },
  ],
}
