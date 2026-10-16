import { piecewise, sma, zigzagCandles, type GlossaryTerm, type Sketch } from './glossary-sketch-builders'

/**
 * Thuật ngữ RSI (tiếp): MDRP (điểm động lượng chênh lệch đảo chiều), mục tiêu giá, đường xu hướng MDRP,
 * thoái lui cơ bản, khung thời gian, số chính, trung bình động trên RSI. Nguồn: ebook John Hayden.
 */

/** Giá zigzag (steps 3) + RSI nội suy qua các điểm swing */
function build(pivots: number[], rsiAt: number[]) {
  const { candles, swings } = zigzagCandles(pivots, 3)
  const ys = piecewise(rsiAt.map((v, k) => [k * 3, v] as [number, number]), candles.length)
  return { candles, swings, ys }
}

// MDRP UP: Tham chiếu (đáy RSI cũ) → A (đóng cao nhất) → B: giá đáy cao hơn, RSI đáy thấp hơn
const mdrpUp = (() => {
  const { candles, swings, ys } = build([13, 11, 16, 13.2, 18.6], [58, 44, 78, 36, 76])
  const ref = candles[3][3]
  const a = candles[6][3]
  const b = candles[9][3]
  const target = a + (b - ref)
  return {
    caption: `Giá: đáy B cao hơn tham chiếu · RSI: đáy B thấp hơn → MDRP UP. Mục tiêu = A + (B − tham chiếu) = ${target.toFixed(1)}`,
    candles, zigzag: swings,
    labels: [{ i: 3, at: 'low' as const, text: 'Tham chiếu' }, { i: 6, at: 'high' as const, text: 'A' }, { i: 9, at: 'low' as const, text: 'B' }],
    segments: [{ pts: [[3, candles[3][2]], [9, candles[9][2]]] as [number, number][] }],
    lines: [{ y: target, from: 6, text: 'Mục tiêu' }, { y: candles[9][2] - 0.3, from: 8, to: 12, text: 'SL' }],
    markers: [{ i: 10, y: candles[10][2], kind: 'buy' as const, text: 'Mua' }],
    rsi: { ys, levels: [{ v: 80 }, { v: 40 }], segments: [{ pts: [[3, 44], [9, 36]] as [number, number][], text: 'thấp hơn' }] },
  } satisfies Sketch
})()

// MDRP DOWN: Tham chiếu (đỉnh RSI cũ) → C (đóng thấp nhất) → B: giá đỉnh thấp hơn, RSI đỉnh cao hơn
const mdrpDown = (() => {
  const { candles, swings, ys } = build([17, 19, 14, 16.8, 11.4], [45, 56, 22, 64, 24])
  const ref = candles[3][3]
  const c = candles[6][3]
  const b = candles[9][3]
  const target = c - (ref - b)
  return {
    caption: `Giá: đỉnh B thấp hơn tham chiếu · RSI: đỉnh B cao hơn → MDRP DOWN. Mục tiêu = C − (tham chiếu − B) = ${target.toFixed(1)}`,
    candles, zigzag: swings,
    labels: [{ i: 3, at: 'high' as const, text: 'Tham chiếu' }, { i: 6, at: 'low' as const, text: 'C' }, { i: 9, at: 'high' as const, text: 'B' }],
    segments: [{ pts: [[3, candles[3][1]], [9, candles[9][1]]] as [number, number][] }],
    lines: [{ y: target, from: 6, text: 'Mục tiêu' }, { y: candles[9][1] + 0.3, from: 8, to: 12, text: 'SL' }],
    markers: [{ i: 10, y: candles[10][1], kind: 'sell' as const, text: 'Bán' }],
    rsi: { ys, levels: [{ v: 60 }, { v: 20 }], segments: [{ pts: [[3, 56], [9, 64]] as [number, number][], text: 'cao hơn' }] },
  } satisfies Sketch
})()

// Đường xu hướng MDRP: nối giá đóng tham chiếu → giá đóng B, kéo dài; đường song song qua A = vùng chốt lời
const mdrpLine = (() => {
  const { candles, swings, ys } = build([13, 11, 16, 13.2, 17.4, 15.8, 19.6], [58, 44, 78, 36, 74, 52, 79])
  const slope = (candles[9][3] - candles[3][3]) / 6
  const at = (i: number, base: number, from: number) => base + slope * (i - from)
  const end = candles.length - 1
  return {
    caption: 'Đường xu hướng từ MDRP UP; giá đóng dưới đường = mục tiêu khó đạt',
    candles, zigzag: swings,
    segments: [
      { pts: [[3, candles[3][3]], [end, at(end, candles[3][3], 3)]] as [number, number][], text: 'Đường dưới' },
      { pts: [[6, candles[6][3]], [end, at(end, candles[6][3], 6)]] as [number, number][], text: 'Song song' },
    ],
    rsi: { ys, levels: [{ v: 80 }, { v: 40 }] },
  } satisfies Sketch
})()

// Thoái lui cơ bản: A → B, hồi về C ở 38.2%, mục tiêu = C + (B − A)
const retrace = (() => {
  const { candles, swings } = zigzagCandles([10, 18, 14.94, 23], 4)
  const lv = (r: number) => 18 - 8 * r
  return {
    caption: 'Hồi 38.2% → xu hướng mạnh, mục tiêu = C + (B − A)',
    candles, zigzag: swings,
    labels: [{ i: 0, at: 'low' as const, text: 'A' }, { i: 4, at: 'high' as const, text: 'B' }, { i: 8, at: 'low' as const, text: 'C' }],
    lines: [
      { y: lv(0.382), from: 4, text: '38.2%' }, { y: lv(0.5), from: 4, text: '50%' }, { y: lv(0.618), from: 4, text: '61.8%' },
      { y: 14.94 + 8, from: 8, text: 'Mục tiêu' },
    ],
  } satisfies Sketch
})()

// SMA9 & đường 45 trên RSI (minh hoạ bằng chu kỳ ngắn hơn cho vừa hình)
const maOnRsi = (() => {
  const { candles, swings, ys } = build([16, 13, 15, 11.5, 14, 12.5, 16.5, 15, 19.5, 17.5, 21], [50, 30, 48, 26, 52, 42, 70, 55, 76, 58, 78])
  return {
    caption: 'Đường nhanh cắt lên đường chậm trên RSI → xu hướng chuyển tăng',
    candles, zigzag: swings,
    rsi: {
      ys, levels: [{ v: 60 }, { v: 40 }],
      paths: [{ ys: sma(ys, 3), text: 'SMA9', tone: 'fast' as const }, { ys: sma(ys, 12), text: 'WMA45', tone: 'slow' as const }],
    },
  } satisfies Sketch
})()

const RETRACE_TABLE = `<table class="mini"><thead><tr><th>Sức mạnh xu hướng</th><th>Hồi tối đa</th><th>Mục tiêu (tăng)</th><th>Vượt đỉnh B?</th></tr></thead><tbody>
<tr><td>Rất mạnh</td><td>14.6–23.6%</td><td>C + (B − A)</td><td>Dễ</td></tr>
<tr><td>Mạnh</td><td>38.2%</td><td>C + (B − A)</td><td>Dễ</td></tr>
<tr><td>Mạnh vừa / trung bình</td><td>38.2–50%</td><td>C + 80% (B − A)</td><td>Nên dễ</td></tr>
<tr><td>Yếu vừa / yếu</td><td>50–61.8%</td><td>C + 80% (B − A)</td><td>Có thể</td></tr>
<tr><td>Rất yếu</td><td>76.4–85.4%</td><td>C + 80% (B − A)</td><td>Có thể không</td></tr>
</tbody></table>`

export const RSI_SIGNAL_TERMS: GlossaryTerm[] = [
  {
    id: 'mdrp-up', title: 'MDRP UP', aka: 'Điểm động lượng chênh lệch đảo chiều đi lên — "positive reversal" của Andrew Cardwell',
    body: [
      'Chỉ xảy ra trong <b>xu hướng tăng</b>: nhịp hồi làm RSI rơi <b>thấp hơn đáy RSI trước</b> (điểm tham chiếu) trong khi <b>giá vẫn cao hơn</b> giá tại điểm tham chiếu. RSI hồi "quá đà" vì khung ngắn hơn bán quá tay → phe mua sắp quay lại.',
      '"<b>Dự kiến</b>" khi RSI vừa thủng đáy cũ; "<b>bị khóa</b>" khi RSI móc lên lại. Giá tại điểm MDRP bị khóa là <b>số chính quan trọng nhất</b> để đặt dừng lỗ.',
      '<b>Mục tiêu</b> = giá đóng cao nhất giữa 2 đáy (A) + (giá đóng tại B − giá đóng tại tham chiếu). Giá phải đóng tới mục tiêu thì xu hướng mới còn nguyên; không đạt = xu hướng có thể đã hết.',
      '<b>Độ mạnh</b> theo số nến giữa 2 đáy RSI: 2–4 mạnh nhất, 5–15 trung bình, &gt; 16 yếu. Trên 5 nến thì nên kèm giá hồi &lt; 38.2%. Mạnh nhất khi 2 khung cùng có MDRP cùng chiều (ví dụ 5 phút và 30 phút).',
    ],
    sketches: [mdrpUp],
  },
  {
    id: 'mdrp-down', title: 'MDRP DOWN', aka: 'Điểm động lượng chênh lệch đảo chiều đi xuống — "negative reversal"',
    body: [
      'Ngược với MDRP UP, chỉ xảy ra trong <b>xu hướng giảm</b>: nhịp hồi lên làm RSI vượt <b>cao hơn đỉnh RSI trước</b> trong khi <b>giá vẫn thấp hơn</b> giá tại đỉnh tham chiếu. Bị khóa khi RSI móc xuống tạo đỉnh.',
      '<b>Mục tiêu</b> = giá đóng thấp nhất giữa 2 đỉnh (C) − (giá đóng tại tham chiếu − giá đóng tại B).',
      'Khung trong ngày ngắn: vào bằng <b>lệnh thị trường</b> (giá hay nhảy khỏi lệnh giới hạn); khung 30 phút / ngày: dùng lệnh giới hạn.',
    ],
    sketches: [mdrpDown],
  },
  {
    id: 'mdrp-trendline', title: 'Đường xu hướng MDRP',
    body: [
      'Nối <b>giá đóng</b> tại điểm tham chiếu với giá đóng tại MDRP bị khóa, kéo dài sang phải; vẽ đường song song qua giá đóng cao nhất giữa 2 điểm. Đây là đường xu hướng "có ý nghĩa thống kê" thay cho đường vẽ tay chủ quan.',
      'Chỉ xét <b>giá đóng</b>: nến đóng dưới đường xu hướng tăng = dấu hiệu sớm mục tiêu sẽ <b>không</b> đạt → thoát hoặc siết dừng lỗ. Giá chạm đường song song trên = chỗ chốt phần còn lại. Khung càng lớn, việc đóng phá đường càng có ý nghĩa.',
    ],
    sketches: [mdrpLine],
  },
  {
    id: 'basic-retracement', title: 'Lý thuyết thoái lui cơ bản', aka: 'Fibonacci 14.6 / 23.6 / 38.2 / 50 / 61.8 / 76.4 / 85.4%',
    body: [
      'Sau một nhịp đủ dài, phe đang thắng mệt và giá hồi lại một phần. <b>Độ sâu nhịp hồi cho biết sức mạnh xu hướng</b>: hồi nông (&lt; 38.2%) = khung dài hơn đồng ý → dễ vượt đỉnh cũ; hồi sâu (50–61.8%) = yếu đi; 61.8–85.4% = khung dài hơn đang "phai nhòa" (đánh ngược) → có thể đảo chiều.',
      RETRACE_TABLE,
      'Chỉ dùng khi thị trường <b>có xu hướng</b> (không dùng khi đi ngang) và nhịp đã đi đủ xa. Ước lượng "đủ xa" bằng biên độ trung bình 10 nến của khung lớn gấp ~13 lần (ví dụ 5 phút → 65 phút; 30 phút → ngày). Nhịp 5 phút đi được ~40% biên độ ngày trung bình → trader 5 phút đã mệt; nhịp 30 phút gần 100% → trader 30 phút đã cạn.',
    ],
    sketches: [retrace],
  },
  {
    id: 'rsi-retracement', title: 'Thoái lui của RSI so với giá', aka: 'Quy tắc 5',
    body: [
      'RSI nhạy nhất ở 40–60 nên thường hồi <b>sâu hơn giá</b>: giá hồi 33% thì RSI hay hồi 50–60%. Không lấy mục tiêu từ thoái lui RSI được (RSI tối đa 100, như logarit).',
      'Kết hợp: giá hồi không quá 85.4% + RSI hồi ~125% (vượt đáy/đỉnh RSI cũ) = <b>MDRP</b>; giá vượt ~125% nhịp trước + RSI chỉ 61.8–85.4% = <b>phân kỳ</b>. Muốn thấy <b>giá hồi nông đi cùng MDRP</b> — hai tín hiệu xu hướng gốc sẽ tiếp diễn; MDRP đi cùng hồi sâu thì thận trọng.',
    ],
  },
  {
    id: 'dominant-timeframe', title: 'Khung thời gian chi phối', aka: '"Lực là bạn của bạn hơn cả xu hướng"',
    body: [
      'Mỗi mức giá là thoả thuận giữa người ở các khung khác nhau; vốn càng lớn càng nhìn khung dài và phải mua vào điểm yếu, bán vào điểm mạnh — tức "phai nhòa" nhịp của khung ngắn. Cần biết <b>khung nào đang chi phối</b> và giao dịch cùng nó.',
      'Dấu hiệu khung lớn hơn "nhảy vào": tín hiệu kỳ vọng cao bị phủ nhận ngay (phân kỳ tăng mà giá đóng dưới giá phân kỳ…), mục tiêu MDRP không đạt, xuất hiện nhiều phân kỳ, nhịp hồi sâu. Khi đó thoát / siết dừng lỗ, mở chart khung lớn hơn để tìm lý do (thường là MDRP hoặc phân kỳ dài hạn ở khung đó), chờ khung của mình chiếm lại quyền rồi vào lại.',
      'Giá đi lên như "cầu thang" đều đặn thường là dấu hiệu một khung đang chi phối. Dùng RSI khung nhỏ hơn để tìm điểm vào trong xu hướng của khung lớn (ví dụ xu hướng 15 phút, vào lệnh trên 1 phút).',
    ],
  },
  {
    id: 'key-numbers', title: 'Số chính (hỗ trợ / kháng cự hợp lệ)',
    body: [
      'Theo thứ tự quan trọng: (1) giá tại MDRP, (2) mục tiêu của MDRP, (3) giá nơi nhịp thoái lui cơ bản đảo chiều, (4) giá nơi phân kỳ xuất hiện (vai phải). Bị phá thì xu hướng đã đổi hoặc yếu tới mức không nên giữ lệnh.',
      'RSI tính trên giá đóng nên dừng lỗ đặt sát được: cách số chính 2–3 tick (giao dịch trong ngày). Hỗ trợ bị phá thành kháng cự và ngược lại — trên cả giá lẫn RSI.',
    ],
  },
  {
    id: 'rsi-ma', title: 'SMA9 và đường 45 trên RSI & giá',
    body: [
      'Tính SMA 9 và trung bình 45 (sách ghi WMA 45 ở Phụ lục B, EMA 45 ở bảng tổng kết) trên <b>cả RSI và giá</b>: cả hai SMA9 trên đường 45 = <b>tăng</b>; cả hai dưới = <b>giảm</b>; trên giá dương mà trên RSI âm = <b>ngang đi lên</b>; trên giá âm mà RSI dương = <b>ngang đi xuống</b>.',
      'RSI dao động mạnh hơn giá nên đường trên RSI cắt <b>sớm hơn</b>; tác giả coi trọng đường trên giá hơn. Đường 45 hay đóng vai hỗ trợ/kháng cự cho nhịp hồi trên cả giá và RSI. Chạy mạnh nhất khi cả hai đường cùng hướng.',
    ],
    sketches: [maOnRsi],
    usedIn: 'Bộ lọc MF_02 / MF_07: RSI(9) so với SMA45 của RSI (khác sách: sách dùng RSI 14, so SMA9 với đường 45)',
  },
  {
    id: 'rsi-variants', title: 'Biến thể RSI', aka: 'RMI, RSI Morris, RSI độ lệch chuẩn',
    body: [
      '<b>RMI</b> (Altman): so với giá n nến trước thay vì nến liền trước → mượt hơn nhưng trễ; tác giả chỉ gợi ý dùng làm bộ lọc MDRP (hằng số mượt 3 loại bỏ các tín hiệu nhiễu khoảng 2). <b>RSI Morris</b>: dùng SMA thay EMA → răng cưa, nhiều tín hiệu ẩn hơn. <b>RSI trên độ lệch chuẩn</b> 10 phiên: &gt; 70 = sức mạnh bên trong đã quá tải, phải về dưới 40 để "sạc pin".',
      'Hệ thống trong sách chỉ dùng RSI Wilder chuẩn (14).',
    ],
  },
]
