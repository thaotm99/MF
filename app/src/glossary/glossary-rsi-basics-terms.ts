import {
  fromCloses, piecewise, rsiWilder, zigzagCandles,
  type GlossaryTerm, type Sketch, type SketchRsi,
} from './glossary-sketch-builders'

/**
 * Thuật ngữ RSI theo ebook "RSI: Hướng Dẫn Đầy Đủ" (John Hayden, bản dịch Crypto Infinity, docs/RSI TOÀN TẬP EBOOK.pdf):
 * tổng quan hệ thống, công thức, vùng RSI theo xu hướng, phân kỳ.
 * RSI trong hình là giá trị vẽ tay theo đúng hình dạng mô tả trong sách (trừ hình so sánh chu kỳ là RSI tính thật).
 */

/** Giá zigzag + RSI nội suy qua các điểm swing (cùng chỉ số nến) */
function priceRsi(pivots: number[], rsiAt: number[], caption: string, rsi: Partial<SketchRsi> = {}, extra: Partial<Sketch> = {}, steps = 3): Sketch {
  const { candles, swings } = zigzagCandles(pivots, steps)
  const ys = piecewise(rsiAt.map((v, k) => [k * steps, v] as [number, number]), candles.length)
  return { caption, candles, zigzag: swings, rsi: { ys, ...rsi }, ...extra }
}

const RATIO_TABLE = `<table class="mini"><thead><tr><th>Tăng TB : Giảm TB</th><th>1:4</th><th>1:2</th><th>1:1</th><th>2:1</th><th>3:1</th><th>4:1</th><th>20:1</th></tr></thead>
<tbody><tr><th>RSI</th><td>20</td><td>33.3</td><td>50</td><td>66.7</td><td>75</td><td>80</td><td>95.2</td></tr></tbody></table>`

/** RSI(3) và RSI(9) tính thật trên cùng chuỗi giá (bỏ 40 nến khởi động) */
const periodCompare = (() => {
  const all = Array.from({ length: 64 }, (_, i) => 100 + 4 * Math.sin(i / 3.2) + 1.5 * Math.sin(i / 1.3) + i * 0.05)
  const show = 24
  const r3 = rsiWilder(all, 3).slice(-show)
  const r9 = rsiWilder(all, 9).slice(-show)
  return {
    caption: 'Cùng chuỗi giá (RSI tính thật): RSI(3) dao động mạnh hơn nhiều RSI(9)',
    candles: fromCloses(all.slice(-show), 0.5, all[all.length - show - 1]),
    rsi: { ys: r9, mainText: 'RSI(9)', paths: [{ ys: r3, text: 'RSI(3)', tone: 'fast' as const }], levels: [{ v: 70 }, { v: 30 }] },
  }
})()

const SYSTEM_STEPS = `<ol class="steps">
<li><b>Chọn 3 khung chi phối</b>: lớn – trung – ngắn (giao dịch trong ngày: D1 – 30 phút – 5 phút; giữ vị thế: tháng – tuần – ngày). Giao dịch theo khung đang có lực mạnh nhất.</li>
<li><b>Xác định xu hướng bằng RSI</b> (bảng bên dưới): vùng 80/40 hay 60/20, loại phân kỳ đang xuất hiện, SMA9 so với đường 45 trên RSI và trên giá.</li>
<li><b>Chờ nhịp hồi ngược xu hướng</b>, đo độ sâu bằng thoái lui Fibonacci: &lt; 38.2% = xu hướng mạnh, 50–61.8% = yếu dần, &gt; 61.8% = có thể đảo chiều.</li>
<li><b>Vào lệnh theo xu hướng khi có MDRP</b> (MDRP UP trong xu hướng tăng / MDRP DOWN trong xu hướng giảm), tốt nhất trùng nhịp hồi nông–trung bình. Khung ngắn trong ngày dùng lệnh thị trường; khung 30 phút / ngày dùng lệnh giới hạn.</li>
<li><b>Dừng lỗ</b> cách "số chính" (giá tại MDRP, mục tiêu MDRP, giá đảo chiều thoái lui, giá phân kỳ) 2–3 tick. Chỉ vào khi lợi nhuận / rủi ro ≥ 3:1.</li>
<li><b>Chốt lời</b>: mục tiêu MDRP. Nhiều hợp đồng: chốt 50% ở mục tiêu, phần còn lại kéo dừng lỗ xuống dưới đáy swing vừa xác nhận (sau khi có nến đóng trên đỉnh nến trước); thoát hết khi giá chạm đường song song trên của đường xu hướng MDRP hoặc phá đáy swing.</li>
<li><b>Phân kỳ đơn giản ngược chiều lệnh</b> → chốt một phần, <u>không</u> đảo lệnh. Mục tiêu MDRP không đạt, đa phân kỳ dài hạn, hồi sâu → khung lớn hơn đang "phai nhòa" xu hướng: thoát hoặc siết dừng lỗ.</li>
</ol>`

const TREND_TABLES = `<div class="two-tables">
<table class="mini"><thead><tr><th>Xu hướng TĂNG khi</th><th>Xu hướng GIẢM khi</th></tr></thead><tbody>
<tr><td>RSI dao động trong 80/40</td><td>RSI dao động trong 60/20</td></tr>
<tr><td>Phân kỳ <b>giảm</b> đơn giản</td><td>Phân kỳ <b>tăng</b> đơn giản</td></tr>
<tr><td>Phân kỳ tăng ẩn</td><td>Phân kỳ giảm ẩn</td></tr>
<tr><td>MDRP UP</td><td>MDRP DOWN</td></tr>
<tr><td>Đạt mục tiêu đi lên</td><td>Đạt mục tiêu đi xuống</td></tr>
<tr><td>SMA9 &gt; đường 45 trên RSI</td><td>SMA9 &lt; đường 45 trên RSI</td></tr>
<tr><td>Nhịp hồi không giảm quá 50% nhịp tăng trước</td><td>Nhịp hồi không tăng quá 50% nhịp giảm trước</td></tr>
</tbody></table>
<table class="mini"><thead><tr><th>Xu hướng tăng NGUY HIỂM khi</th><th>Xu hướng giảm NGUY HIỂM khi</th></tr></thead><tbody>
<tr><td>Khung dài hơn bán vào nhịp tăng</td><td>Khung dài hơn mua vào nhịp giảm</td></tr>
<tr><td>Đa phân kỳ giảm dài hạn; không đạt mục tiêu đi lên</td><td>Đa phân kỳ tăng dài hạn; không đạt mục tiêu đi xuống</td></tr>
<tr><td>SMA9 &lt; đường 45 trên RSI</td><td>SMA9 &gt; đường 45 trên RSI</td></tr>
<tr><td>Phân kỳ giảm ẩn hoặc phân kỳ tăng đơn giản</td><td>Phân kỳ tăng ẩn hoặc phân kỳ giảm đơn giản</td></tr>
<tr><td>Hồi sâu ngược xu hướng</td><td>Hồi sâu ngược xu hướng</td></tr>
</tbody></table></div>`

export const RSI_BASIC_TERMS: GlossaryTerm[] = [
  {
    id: 'rsi-system', title: 'Hệ thống giao dịch RSI (John Hayden)', aka: 'Tóm tắt ebook "RSI: Hướng Dẫn Đầy Đủ"', wide: true,
    body: [
      'Ý chính của sách: giá là trận chiến giữa các nhà giao dịch ở <b>khung thời gian khác nhau</b> (vốn lớn → khung dài). RSI cho biết khung nào đang chi phối, xu hướng hiện tại, điểm vào/ra và mục tiêu giá. Nhiều cách dùng RSI "thông thường" (70/30, mua khi phân kỳ tăng…) bị tác giả coi là <b>sai</b>.',
      SYSTEM_STEPS,
      TREND_TABLES,
      '7 câu tự hỏi khi xác định xu hướng: (1) RSI đang ở vùng nào? (2) Vùng đã đổi chưa? (3) Thị trường có tôn trọng hỗ trợ/kháng cự cũ? (4) Có phá và đảo vai trò hỗ trợ ↔ kháng cự? (5) Đã phá đường xu hướng quan trọng trên giá hoặc RSI? (6) Đang có loại phân kỳ nào? (7) Đường trung bình động đang nói gì?',
    ],
  },
  {
    id: 'rsi', title: 'RSI (Relative Strength Index)', aka: 'Chỉ số sức mạnh tương đối, Welles Wilder 1978',
    body: [
      '<code>RS = trung bình tăng / trung bình giảm</code> của N nến (giá đóng cửa), <code>RSI = 100 − 100 / (1 + RS)</code>. Từ nến thứ N+1 dùng trung bình luỹ thừa: <code>TB mới = (TB cũ × (N−1) + thay đổi nến này) / N</code>.',
      'RSI hoạt động như hàm <b>logarit</b>: tăng/giảm nhanh nhất khi tỉ lệ đi từ 1:1 sang 2:1 (hoặc 1:2) — tức RSI <b>nhạy nhất trong vùng 40–60</b>, càng ra xa càng khó nhích. Muốn RSI 80 cần trung bình tăng gấp 4 lần trung bình giảm — hiếm khi xảy ra.',
      RATIO_TABLE,
      'Cần ≥ 10 lần (tốt hơn 20 lần) chu kỳ N dữ liệu để RSI ổn định. N nhỏ → biên độ lớn; N lớn → ít dao động. Tác giả dùng <b>RSI 14</b> cho mọi khung (muốn góc nhìn khung khác thì đổi khung chart, không đổi N); có người dùng 9 cho khung trong ngày, 25 cho vàng / bạc / dầu.',
    ],
    sketches: [periodCompare],
  },
  {
    id: 'rsi-conventional', title: 'Cách dùng RSI "thông thường" — và vì sao sai', aka: '9 niềm tin phổ biến',
    body: [
      '<b>70/30 (hoặc 80/20) là đỉnh/đáy</b>; <b>phân kỳ</b> báo đảo chiều; <b>swing thất bại</b> xác nhận đảo chiều; <b>cắt 50</b> = đổi chu kỳ; RSI vẽ được tam giác, cờ, đường xu hướng; các biến thể RMI (Altman, làm mượt), RSI Morris (dùng SMA), đổi chu kỳ, đổi nguồn dữ liệu (RSI trên độ lệch chuẩn…).',
      'Theo tác giả: giao dịch theo 70/30 "chỉ dẫn đến thua lỗ"; mua khi thấy phân kỳ tăng hay chờ swing thất bại = "lời nhỏ, lỗ lớn"; cắt 50 chỉ cho biết tỉ lệ tăng/giảm vừa đảo, không phải tín hiệu chính. Đúng duy nhất: hình mẫu trên RSI (tam giác…) có giá trị như trên giá, nhưng hay phá giả trước khi chạy thật.',
      'Ngược lại, RSI <b>có thể</b> cho biết xu hướng, đảo chiều và mục tiêu giá — chính là phần còn lại của hệ thống.',
    ],
  },
  {
    id: 'rsi-range', title: 'Vùng RSI theo xu hướng: 80/40 và 60/20', aka: 'Quy tắc 1 (đã sửa)',
    body: [
      '<b>Xu hướng tăng</b>: RSI có hỗ trợ ở <b>40</b> (tối đa 33.3) và kháng cự ở <b>80</b>. <b>Xu hướng giảm</b>: kháng cự ở <b>60</b> (tối đa 66.7), hỗ trợ ở <b>20</b>. Nhìn RSI đang chạy trong dải nào là biết ngay xu hướng, không cần xem giá.',
      'Trong dải 80/40 RSI tạo đỉnh cao dần, đáy cao dần (và ngược lại với 60/20). Các mức này chỉ đúng khi đa số đang nhìn cùng khung; khung khác chen vào có thể làm thủng 40 / vượt 60 một chút mà xu hướng vẫn còn.',
    ],
    sketches: [
      priceRsi([10, 15, 12.5, 18, 15.5, 21, 18.5], [45, 78, 47, 82, 50, 80, 52], 'Xu hướng tăng: RSI chạy trong 40–80', {
        levels: [{ v: 80 }, { v: 40 }], zone: { from: 40, to: 80 },
      }),
      priceRsi([21, 16, 18.5, 13, 15.5, 10, 12.5], [55, 22, 57, 18, 55, 20, 52], 'Xu hướng giảm: RSI chạy trong 20–60', {
        levels: [{ v: 60 }, { v: 20 }], zone: { from: 20, to: 60 },
      }),
    ],
  },
  {
    id: 'rsi-range-shift', title: 'Đổi dải RSI = đổi xu hướng',
    body: [
      'Dấu hiệu chính giảm → tăng: RSI đang tôn trọng kháng cự 60 bỗng vượt lên <b>≥ 70</b>, rồi nhịp giảm sau đó giữ được <b>40</b>. Ngược lại, tăng → giảm: RSI gặp kháng cự ở 60 rồi thủng 40 (hoặc thủng 40 luôn mà chưa chạm 60).',
      'Mức RSI cũ đổi vai trò như hỗ trợ/kháng cự trên giá: trong thị trường tăng mạnh, 60 thành hỗ trợ; trong thị trường giảm mạnh, 40 thành kháng cự.',
    ],
    sketches: [
      priceRsi([20, 15, 17, 12, 16.5, 14, 19, 16.5, 21], [52, 25, 56, 22, 74, 44, 80, 47, 82], 'RSI vượt 60 lên 74, nhịp hồi giữ 40 → xu hướng chuyển tăng', {
        levels: [{ v: 80 }, { v: 60 }, { v: 40 }, { v: 20 }],
        labels: [{ i: 12, text: '> 70' }, { i: 15, text: 'giữ 40', at: 'low' }],
      }),
    ],
  },
  {
    id: 'rsi-divergence', title: 'Phân kỳ đơn giản — "nghịch lý" của Hayden', aka: 'Simple divergence',
    body: [
      '<b>Phân kỳ giảm</b>: giá tạo đỉnh cao hơn nhưng RSI tạo đỉnh thấp hơn. <b>Phân kỳ tăng</b>: giá tạo đáy thấp hơn nhưng RSI tạo đáy cao hơn.',
      'Theo sách: phân kỳ giảm <b>chỉ xuất hiện trong xu hướng tăng</b> (phân kỳ tăng trong xu hướng giảm). Nó báo phe đang thắng đã đuối và sắp có <i>nhịp hồi</i> ("đường vòng") — không phải đảo chiều. Cách dùng: chốt một phần lệnh đang theo xu hướng, rồi <b>tìm chỗ vào lại theo xu hướng</b> sau nhịp hồi; đừng đảo lệnh.',
      'Giá tại điểm phân kỳ thường thành hỗ trợ/kháng cự tạm thời; khi bị phá thì dùng làm chỗ đặt dừng lỗ. Ngoại lệ: <b>đa phân kỳ dài hạn</b> (≥ 3) và <b>phân kỳ ẩn</b>.',
    ],
    sketches: [
      (() => {
        const s = priceRsi([10, 15, 13, 17, 14.5, 17.8, 15.6, 20.5], [45, 75, 50, 82, 55, 70, 48, 78], 'Phân kỳ giảm trong xu hướng tăng → hồi rồi tăng tiếp', {
          levels: [{ v: 80 }, { v: 40 }], segments: [{ pts: [[9, 82], [15, 70]] }],
        })
        return { ...s, segments: [{ pts: [[9, s.candles[9][1]], [15, s.candles[15][1]]], text: 'PK giảm' }], markers: [{ i: 18, y: s.candles[18][2], kind: 'buy' as const, text: 'Mua lại' }] }
      })(),
      (() => {
        const s = priceRsi([21, 16, 18, 14, 16.5, 13.2, 15.5, 10.5], [55, 25, 50, 18, 45, 30, 55, 20], 'Phân kỳ tăng trong xu hướng giảm → hồi lên để bán', {
          levels: [{ v: 60 }, { v: 20 }], segments: [{ pts: [[9, 18], [15, 30]] }],
        })
        return { ...s, segments: [{ pts: [[9, s.candles[9][2]], [15, s.candles[15][2]]], text: 'PK tăng' }], markers: [{ i: 18, y: s.candles[18][1], kind: 'sell' as const, text: 'Bán' }] }
      })(),
    ],
  },
  {
    id: 'rsi-divergence-strength', title: 'Độ mạnh phân kỳ, phân kỳ "dự kiến" / "bị khóa"',
    body: [
      '<b>Độ mạnh</b> = số nến giữa 2 đỉnh (hoặc 2 đáy) RSI tạo phân kỳ, gọi là "phân kỳ khoảng N". 2–3 nến mạnh nhất (&lt; 4: nhịp hồi xảy ra ngay); càng dài càng yếu.',
      '<b>Dự kiến</b>: giá đã vượt đỉnh cũ mà RSI còn thấp hơn — nhưng RSI vẫn có thể vượt nếu giá chạy tiếp. <b>Bị khóa</b>: giá quay đầu, RSI móc xuống dưới đỉnh cũ → phân kỳ được xác nhận (phải chờ thêm ít nhất 1 nến).',
    ],
  },
  {
    id: 'rsi-multi-divergence', title: 'Đa phân kỳ dài hạn',
    body: [
      'Ba (hoặc hơn) phân kỳ liên tiếp cùng chiều: giá liên tục tạo đỉnh cao hơn trong khi RSI liên tục tạo đỉnh thấp hơn (hoặc ngược lại ở đáy). Khác với phân kỳ đơn giản, đa phân kỳ dài hạn làm <b>tăng khả năng xu hướng đã kết thúc</b>.',
      'Tác giả xác nhận bằng RSI 9 + Stochastic chậm 9 cùng có đa phân kỳ: khi đó không chỉ thoát lệnh mà còn đảo lệnh với khối lượng nhỏ hơn bình thường, đặt cách đỉnh/đáy thứ hai 1–2 tick.',
    ],
    sketches: [(() => {
      const s = priceRsi([18, 15, 17, 13.5, 15.5, 12.5, 14.5, 12, 16.5], [45, 22, 48, 26, 50, 30, 52, 34, 62], '3 đáy giá thấp dần, 3 đáy RSI cao dần → khả năng đảo chiều tăng', {
        levels: [{ v: 60 }, { v: 20 }], segments: [{ pts: [[3, 22], [9, 26], [15, 30], [21, 34]] }],
      })
      return { ...s, segments: [{ pts: [3, 9, 15, 21].map((i) => [i, s.candles[i][2]] as [number, number]) }] }
    })()],
  },
  {
    id: 'rsi-hidden-divergence', title: 'Phân kỳ ẩn', aka: 'Hidden divergence (theo cách gọi của sách)',
    body: [
      'Phân kỳ <b>không nằm ở đỉnh/đáy cực</b> của RSI mà xuất hiện sau khi RSI đã hồi về vùng giữa, thường <b>40–60</b>; người chưa được dạy khó nhận ra. Sách xếp đây là <b>phân kỳ mạnh nhất</b> và thị trường "làm đúng như tên gọi": phân kỳ tăng ẩn → giá sắp tăng mạnh (kể cả khi đang trong thị trường giảm, báo hiệu đảo chiều); phân kỳ giảm ẩn → sắp giảm mạnh.',
      'Lưu ý: nhiều tài liệu khác gọi "phân kỳ ẩn" cho mẫu giá đáy cao hơn + RSI đáy thấp hơn — trong sách này mẫu đó chính là <b>MDRP</b>.',
    ],
    sketches: [(() => {
      const s = priceRsi([16, 13, 15, 12.4, 14.4, 12, 17, 15.5, 20], [42, 24, 55, 44, 58, 48, 75, 58, 80], 'Đáy giá thấp hơn, đáy RSI cao hơn ở vùng 40–60 → bật tăng mạnh', {
        levels: [{ v: 60 }, { v: 40 }], zone: { from: 40, to: 60 }, segments: [{ pts: [[9, 44], [15, 48]], text: 'ẩn' }],
      })
      return { ...s, segments: [{ pts: [[9, s.candles[9][2]], [15, s.candles[15][2]]] }] }
    })()],
  },
]

