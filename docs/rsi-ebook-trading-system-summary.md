# Tổng kết ebook "RSI: Hướng Dẫn Đầy Đủ" (John Hayden)

Nguồn: `docs/RSI TOÀN TẬP EBOOK.pdf` (bản dịch Crypto Infinity 2018, gốc 2004, 119 trang).
Phần hình minh hoạ từng thuật ngữ: dashboard → **Tham khảo → Thuật ngữ → RSI** (`/glossary#rsi`).

## Ý tưởng cốt lõi

- Giá chỉ là con số 2 bên đồng ý; thị trường = trận chiến giữa trader ở **khung thời gian khác nhau**
  (vốn lớn → khung dài → mua vào điểm yếu / bán vào điểm mạnh, "phai nhòa" nhịp của khung ngắn).
- Phải biết khung nào đang **chi phối** và giao dịch cùng nó. RSI cho biết: xu hướng, khung chi phối,
  khi khung dài hơn chen vào, điểm vào/ra, mục tiêu giá.
- Phần lớn cách dùng RSI "thông thường" bị tác giả coi là sai (70/30, mua khi phân kỳ tăng, swing thất bại, cắt 50).

## Công thức & tính chất

- `RS = TB tăng / TB giảm` (N nến, giá đóng), `RSI = 100 − 100/(1+RS)`, từ nến N+1 làm mượt kiểu Wilder.
- Logarit: 1:1 = 50, 2:1 = 66.7, 3:1 = 75, 4:1 = 80, 20:1 = 95.2 → **nhạy nhất ở 40–60**, 80/20 là "trần toán học".
- Cần ≥ 10× (tốt hơn 20×) N dữ liệu để ổn định. Tác giả dùng **RSI 14** mọi khung; muốn góc nhìn khác thì đổi khung chart.

## Hệ thống giao dịch (các bước)

1. **3 khung chi phối**: lớn – trung – ngắn (trong ngày: D1 – 30m – 5m; vị thế: tháng – tuần – ngày).
2. **Xác định xu hướng** bằng bảng bên dưới (vùng RSI, loại phân kỳ, MDRP, MA trên RSI).
3. **Chờ nhịp hồi ngược xu hướng**, đo độ sâu bằng Fibonacci: < 38.2% mạnh · 38.2–50% vừa · 50–61.8% yếu · 61.8–85.4% có thể đảo chiều.
   Chỉ áp dụng khi có xu hướng và nhịp đã đủ dài (so với biên độ TB 10 nến của khung lớn gấp ~13 lần; 5m đi ~40% biên độ ngày = trader 5m đã mệt).
4. **Vào lệnh theo xu hướng khi có MDRP** (UP trong xu hướng tăng, DOWN trong xu hướng giảm), ưu tiên trùng nhịp hồi nông–trung bình.
   Khung ngắn trong ngày: lệnh thị trường; khung 30m/ngày: lệnh giới hạn.
5. **Dừng lỗ** cách "số chính" 2–3 tick; chỉ vào khi R:R ≥ 1:3.
6. **Chốt lời** tại mục tiêu MDRP; nhiều hợp đồng → chốt 50%, phần còn lại trailing dưới swing low vừa xác nhận
   (sau khi có nến đóng trên high nến trước; chờ nhịp hồi nhỏ đầu tiên rồi mới bắt đầu trailing);
   thoát hết khi chạm đường song song trên của đường xu hướng MDRP hoặc phá swing low.
7. **Phân kỳ đơn giản ngược chiều lệnh** → chốt một phần, không đảo lệnh.
   Mục tiêu không đạt / đa phân kỳ dài hạn / hồi sâu → khung dài hơn đang đánh ngược → thoát hoặc siết dừng lỗ.

## Bảng xác định xu hướng (trang 98–99)

| Xu hướng TĂNG khi | Xu hướng GIẢM khi |
|---|---|
| RSI trong 80/40 | RSI trong 60/20 |
| Phân kỳ **giảm** đơn giản | Phân kỳ **tăng** đơn giản |
| Phân kỳ tăng ẩn | Phân kỳ giảm ẩn |
| MDRP UP | MDRP DOWN |
| Đạt mục tiêu đi lên | Đạt mục tiêu đi xuống |
| SMA9 > đường 45 trên RSI | SMA9 < đường 45 trên RSI |
| Nhịp hồi không giảm quá 50% nhịp tăng trước | Nhịp hồi không tăng quá 50% nhịp giảm trước |

| Xu hướng tăng NGUY HIỂM khi | Xu hướng giảm NGUY HIỂM khi |
|---|---|
| Khung dài bán vào nhịp tăng | Khung dài mua vào nhịp giảm |
| Đa phân kỳ giảm dài hạn; không đạt mục tiêu đi lên | Đa phân kỳ tăng dài hạn; không đạt mục tiêu đi xuống |
| SMA9 < đường 45 trên RSI | SMA9 > đường 45 trên RSI |
| Phân kỳ giảm ẩn hoặc phân kỳ tăng đơn giản | Phân kỳ tăng ẩn hoặc phân kỳ giảm đơn giản |
| Hồi sâu ngược xu hướng | Hồi sâu ngược xu hướng |

Checklist 7 câu: vùng RSI? đã đổi vùng? tôn trọng S/R cũ? phá và đảo vai trò S/R? phá đường xu hướng giá/RSI? loại phân kỳ? MA nói gì?

## Thuật ngữ

| Thuật ngữ | Ý nghĩa theo sách |
|---|---|
| Vùng 80/40, 60/20 | Tăng: hỗ trợ RSI 40 (tối đa 33.3), kháng cự 80. Giảm: kháng cự 60 (tối đa 66.7), hỗ trợ 20 |
| Đổi vùng | Giảm→tăng: RSI vượt 60 lên ≥ 70 rồi giữ 40. Tăng→giảm: gặp kháng cự 60 rồi thủng 40 |
| Phân kỳ đơn giản | Giá HH + RSI LH (giảm) / giá LL + RSI HL (tăng). **Phân kỳ giảm chỉ có trong xu hướng tăng** → sắp có nhịp hồi để mua lại, không phải đảo chiều |
| Độ mạnh phân kỳ | Số nến giữa 2 đỉnh/đáy RSI: 2–3 mạnh nhất, < 4 hồi ngay, càng dài càng yếu |
| Dự kiến / bị khóa | Dự kiến: RSI chưa quay đầu (còn có thể vượt). Bị khóa: RSI đã móc ngược → xác nhận |
| Đa phân kỳ dài hạn | ≥ 3 phân kỳ liên tiếp cùng chiều → tăng khả năng xu hướng kết thúc (xác nhận bằng Stochastic chậm 9) |
| Phân kỳ ẩn | Phân kỳ ở vùng 40–60 sau khi RSI đã hồi (không ở cực trị) — mạnh nhất, giá đi đúng tên gọi |
| MDRP UP | (Positive reversal – Cardwell) Trong xu hướng tăng: RSI thủng đáy RSI tham chiếu nhưng giá vẫn cao hơn giá tại tham chiếu |
| MDRP DOWN | Trong xu hướng giảm: RSI vượt đỉnh RSI tham chiếu nhưng giá vẫn thấp hơn |
| Mục tiêu MDRP | UP: đóng cao nhất giữa 2 đáy + (giá B − giá tham chiếu). DOWN: đóng thấp nhất giữa 2 đỉnh − (giá tham chiếu − giá B). Không đạt = xu hướng có thể hết |
| Độ mạnh MDRP | 2–4 nến mạnh · 5–15 trung bình · > 16 yếu; > 5 nến nên kèm giá hồi < 38.2%; mạnh nhất khi 2 khung cùng MDRP |
| Đường xu hướng MDRP | Nối giá đóng tham chiếu → giá đóng MDRP, kéo dài; song song qua đóng cao nhất = vùng chốt. Đóng phá đường = mục tiêu khó đạt |
| Thoái lui cơ bản | Fibonacci 14.6/23.6/38.2/50/61.8/76.4/85.4%; mục tiêu = C + (B − A) (xu hướng mạnh) hoặc C + 80%(B − A) |
| Thoái lui RSI vs giá (Quy tắc 5) | Giá hồi 33% ↔ RSI hồi 50–60%. Giá ≤ 85.4% + RSI ~125% = MDRP; giá ~125% + RSI 61.8–85.4% = phân kỳ |
| Số chính | (1) giá MDRP (2) mục tiêu MDRP (3) giá đảo chiều thoái lui (4) giá phân kỳ (vai phải) → đặt dừng lỗ |
| MA trên RSI & giá | SMA9 vs đường 45 (sách: WMA45 ở phụ lục, EMA45 ở bảng tổng kết) trên cả giá và RSI → tăng / giảm / ngang đi lên / ngang đi xuống |
| Biến thể | RMI (mượt, trễ; làm bộ lọc MDRP), RSI Morris (SMA, răng cưa), RSI trên độ lệch chuẩn (> 70 quá tải, < 40 để "sạc pin") |

## Liên hệ với các EA MF

- MF_02 / MF_07 lọc vào lệnh bằng `RSI(9) > SMA45(RSI)` (Buy) / `<` (Sell); MF_03 thoát theo RSI(M5) cắt SMA45.
  Sách: RSI **14**, so **SMA9 với đường 45** trên RSI (và trên giá), không so trực tiếp RSI với đường 45.
- Những phần sách có thể đưa vào bot / dashboard: vùng 80/40 – 60/20 làm bộ lọc xu hướng, MDRP + mục tiêu làm điểm vào/TP,
  phân kỳ ngược chiều để chốt một phần, độ sâu nhịp hồi (Fibonacci) làm điều kiện.

## Câu hỏi còn mở

- Không tìm thấy session trước đã trao đổi về ebook (chỉ có các session trong danh sách hiện tại) → tổng kết này đọc trực tiếp từ PDF.
- Sách mâu thuẫn đường 45 là WMA hay EMA; định nghĩa "phân kỳ ẩn" khác với tài liệu phổ biến.
