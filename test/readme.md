# Tricoral Multi-Strategy EA — MF_01 → MF_05

Tài liệu tổng hợp 5 biến thể chiến lược Tricoral Coral (M1/M5/M15) trong thư mục `test/`,
và bản gộp cả 5 chiến lược vào 1 EA duy nhất.

## 1. Danh sách file

| Mã | File chạy độc lập (standalone) | Vai trò trong file gộp |
|----|--------------------------------|-------------------------|
| MF_01 | `tricoral-multi-timeframe-ea-MF01.mq5` (giống hệt `mt5/releases/tricoral-multi-timeframe-ea-MF01.mq5`) | `g_strategies[0]`, magic `InpMF01_Magic` (mặc định `20250806`) |
| MF_02 | `tricoral-multi-timeframe-ea-MF02-27082026.mq5` | `g_strategies[1]`, magic `InpMF02_Magic` (mặc định `20250807`) |
| MF_03 | `tricoral-multi-timeframe-ea-MF03-290826.mq5` | `g_strategies[2]`, magic `InpMF03_Magic` (mặc định `20250808`) |
| MF_04 | `tricoral-multi-timeframe-ea-MF04-150926.mq5` | `g_strategies[3]`, magic `InpMF04_Magic` (mặc định `20250809`) |
| MF_05 | `tricoral-multi-timeframe-ea-MF05-170926.mq5` | `g_strategies[4]`, magic `InpMF05_Magic` (mặc định `20250810`) |

File gộp: `tricoral-multi-strategy-ea-MF-01-05.mq5` — chạy cả 5 chiến lược cùng lúc trên
cùng 1 symbol, mỗi chiến lược bật/tắt độc lập qua `InpMFxx_Enabled`, phân biệt lệnh bằng
magic riêng + comment lệnh gắn đúng mã chiến lược (`"MF_01"`, `"MF_02"`, …).

**⚠️ Lưu ý khi chạy các file standalone:** cả 5 file đều mặc định `InpMagicNumber = 20250806`
và cùng `BOT_COMMENT_PREFIX = "ATR : "` → nếu chạy 2+ file standalone cùng lúc trên cùng
account/symbol mà không đổi magic, chúng sẽ **không phân biệt được lệnh của nhau** (đều coi
lệnh của bot kia là lệnh của mình). Chỉ file gộp mới an toàn để chạy nhiều chiến lược song
song (mỗi chiến lược có magic + comment riêng).

## 2. Phần chung cho cả 5 chiến lược

Tất cả biến thể đều dùng chung các khối sau (khác nhau ở tham số, không khác nhau ở công thức):

- **Tín hiệu vào lệnh** (`ProcessSignal`/`ProcessStrategySignal`): đọc trend chỉ báo Coral
  trên 3 khung M1 (chính) / M5 / M15 (xác nhận). Vào lệnh BUY khi Coral M1 **vừa** chuyển
  sang uptrend (up hiện tại, không up ở nến trước) VÀ cả M5, M15 cũng đang uptrend đồng
  thuận. Tương tự cho SELL với downtrend.
- **Stop loss**: đặt theo điểm swing gần nhất (14 nến M1), nếu khoảng cách xa hơn
  `SlSpacingDistance` (mặc định 8) thì cap lại.
- **Take profit**: cố định cách entry `TakeProfitDistance` (mặc định 50) giá — BUY:
  entry + giá trị, SELL: entry − giá trị.
- **Lọc ATR**: bỏ qua tín hiệu nếu ATR(M1) < 2 (biên độ dao động không đủ để trade an toàn).
- **Volume**: cố định = min lot của symbol × hệ số nhân (`g_lotMultiplier` / `VolMultiplier`),
  **không** tăng dần theo chuỗi lệnh cùng hướng (tính năng này đã bị loại bỏ khỏi mọi bản).
- **Phân tách lệnh bot / lệnh thủ công**: qua magic number + comment lệnh bắt đầu bằng mã
  chiến lược (`IsBotPosition`). Chỉ đáng tin cậy trên tài khoản **HEDGING** — trên NETTING,
  MT5 gộp lệnh cùng symbol nên có thể vô tình đóng lệnh thủ công.
- **Giới hạn lãi/lỗ trong ngày** (`DailyLimitReached`): chặn mở lệnh mới khi P/L (đã chốt +
  đang mở) trong ngày server chạm `DailyMaxLoss`/`DailyMaxProfit`. Không đóng lệnh đang mở.
- **Giới hạn lãi theo khung giờ** (`TimeWindowLimitReached`): 1 ngày chia 3 khung giờ server
  (00h-6h / 6h-12h / 12h-24h), chặn mở lệnh mới trong khung nếu P/L khung đó > `TimeWindowMaxProfit`.
  Tự "reset" khi sang khung mới vì luôn tính lại theo khung hiện tại.
- **Thông báo Telegram**: mọi sự kiện quan trọng (mở lệnh OK/FAIL, trail SL, tín hiệu bị bỏ
  qua do ATR thấp, đóng lệnh, chạm giới hạn P/L) đều gửi qua `SendTelegram`.

**Chỗ 5 chiến lược khác nhau thật sự** chỉ nằm ở 2 điểm: **(a)** cách đóng lệnh khi Coral
đảo chiều, và **(b)** có/không trailing stop (và cách trail). MF_02 có thêm bộ lọc RSI.

## 3. Bảng so sánh

| Tiêu chí | MF_01 | MF_02 | MF_03 | MF_04 | MF_05 |
|---|---|---|---|---|---|
| Tín hiệu Coral 3TF (M1/M5/M15) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bộ lọc thêm | — | RSI(9) vs SMA45(RSI) | — | — | — |
| **Cách đóng lệnh khi đảo chiều** | Đóng **hết** ngay (không xét lãi/lỗ) | Đóng **hết** ngay (không xét lãi/lỗ) | Xét **từng lệnh**: chưa breakeven→theo M1, đã breakeven→theo M5 | Đóng **hết** ngay (không xét lãi/lỗ) | Xét **từng lệnh**: lãi→đóng ngay, lỗ→chỉ đóng nếu đã có chuỗi ≥N lệnh cùng hướng |
| **Trailing stop** | 2 giai đoạn (breakeven→trail) | 2 giai đoạn (breakeven→trail) | Chỉ breakeven (không trail tiếp) | **Không** (SL/TP cố định) | 2 giai đoạn (breakeven→trail) |
| TrailDistance | 10 | 10 | 10 | n/a | 10 |
| SlSpacingDistance | 8 | 8 | 8 | 8 | 8 |
| TakeProfitDistance | 50 | 50 | 50 | 50 | 50 |
| DailyMaxLoss / DailyMaxProfit | $40 / $100 | $40 / $100 | $40 / **$200** | $40 / $100 | $40 / $100 |
| TimeWindowMaxProfit | $30 | $30 | **$70** | $30 | $30 |
| Hàm đóng lệnh chính | `CloseAllPositions()` | `CloseAllPositions()` | `ExitPositionsOnReversal()` | `CloseAllPositions()` | `CloseReversedPositions()` |
| Magic mặc định (standalone) | 20250806 | 20250806 | 20250806 | 20250806 | 20250806 |
| Magic trong file gộp | 20250806 | 20250807 | 20250808 | 20250809 | 20250810 |

**Điểm giống nhau nổi bật:** MF_01 là "bản gốc" — MF_02 = MF_01 + RSI filter; MF_04 = MF_01
− trailing; MF_05 = MF_01 với logic đóng lệnh thông minh hơn (xét lãi/lỗ + streak). MF_03 là
biến thể khác biệt nhất: vừa đổi cách đóng lệnh (theo từng lệnh, không đóng hết) vừa đổi
trailing (dừng ở breakeven) vừa nới lỏng ngưỡng giới hạn lãi ($200/$70 thay vì $100/$30).

## 4. Giải thích chi tiết từng chiến lược

### MF_01 — Bản gốc (Coral 3TF thuần + trailing 2 giai đoạn)

File: `tricoral-multi-timeframe-ea-MF01.mq5`

- **Vào lệnh**: Coral M1 vừa đổi hướng + M5, M15 đồng thuận (xem mục 2).
- **Đảo chiều vị thế** (`ProcessSignal`): theo dõi `g_previousPosition` ("LONG"/"SHORT") —
  cập nhật mỗi tick từ lệnh đang mở. Khi Coral M1 đảo ngược hướng so với `g_previousPosition`,
  gọi `CloseAllPositions()` đóng **toàn bộ** lệnh của bot ngay lập tức, không xét lệnh đó
  đang lãi hay lỗ.
- **Trailing stop** (`TrailingStop`, 2 giai đoạn):
  - Giai đoạn 1 (breakeven): khi lãi ≥ `InpTrailDistance` (10), kéo SL về đúng giá entry.
  - Giai đoạn 2 (trail): khi SL đã ≥ entry, tiếp tục bám SL cách giá hiện tại
    `InpTrailDistance`, chỉ đổi theo hướng có lợi, luôn kiểm tra `StopsLevelOk` (stops level
    tối thiểu của broker) trước khi sửa SL.
- Đây là baseline mà MF_02/MF_04/MF_05 đều dựa trên và chỉnh sửa 1 phần.

### MF_02 — MF_01 + bộ lọc RSI(M1)

File: `tricoral-multi-timeframe-ea-MF02-27082026.mq5`

- Giống **hệt MF_01** về đóng lệnh (`CloseAllPositions()` không điều kiện) và trailing (2
  giai đoạn), khác duy nhất ở điều kiện vào lệnh.
- **Bộ lọc RSI** (`GetRsiSma`, copy logic từ `rsi_dynamic_noti.mq5`): tính RSI(M1,
  `InpRsiPeriod=9`) và 2 đường SMA của RSI — gọi là "ema9" (`InpMaFast`) và "ema45"
  (`InpMaSlow`) nhưng thực chất là SMA (trung bình cộng đơn giản), không phải EMA thật.
- Điều kiện vào lệnh = điều kiện Coral (mục 2) **AND** RSI: BUY cần thêm `rsi > SMA45(rsi)`,
  SELL cần thêm `rsi < SMA45(rsi)`.
- Mục đích: lọc bớt tín hiệu Coral "yếu" bằng cách yêu cầu RSI cũng đồng thuận hướng.

### MF_03 — Thoát lệnh riêng từng vị thế (M1 khi rủi ro / M5 khi đã hoà vốn)

File: `tricoral-multi-timeframe-ea-MF03-290826.mq5`

- Khác biệt nhất trong 5 chiến lược. **Không** dùng `CloseAllPositions()`/`previousPosition`
  trong luồng chính — hàm này vẫn tồn tại trong file nhưng chỉ là tiện ích đóng khẩn cấp dự
  phòng, không được gọi.
- **Thoát lệnh** (`ExitPositionsOnReversal`, gọi đầu mỗi `ProcessSignal`): xét **riêng từng
  lệnh** đang mở, khung thời gian dùng để nhận tín hiệu đảo chiều phụ thuộc lệnh đó đã
  breakeven hay chưa (`IsPositionAtBreakeven` — SL đã kéo về entry chưa):
  - **Chưa breakeven** (còn rủi ro): xét Coral **M1** — M1 đảo ngược hướng lệnh là đóng ngay
    → cắt lỗ sớm.
  - **Đã breakeven** (SL ở entry, rủi ro = 0): chuyển sang gồng lãi, bỏ qua tín hiệu M1, chỉ
    đóng khi Coral **M5** đảo ngược hướng. M5 chậm hơn M1 nên lệnh không bị nhiễu ngắn hạn đá
    ra sớm; xấu nhất nếu giá quay đầu thật thì SL ở entry ăn trước → hoà vốn.
- **Trailing** (`TrailingStop`, chỉ 1 giai đoạn breakeven): kéo SL về entry khi lãi đủ
  `InpTrailDistance` rồi **dừng lại**, không bám tiếp SL theo giá như MF_01 — vì việc "gồng
  lãi" sau breakeven đã chuyển hẳn sang nghe tín hiệu M5 ở `ExitPositionsOnReversal`.
- **Ngưỡng giới hạn P/L nới lỏng hơn** các bản khác: `DailyMaxProfit=$200` (thay vì $100),
  `TimeWindowMaxProfit=$70` (thay vì $30) — hợp lý vì chiến lược này để lệnh chạy lâu hơn
  (gồng lãi), cần ngưỡng chốt lời rộng hơn để không cắt ngang xu hướng đang lãi.

### MF_04 — MF_01 nhưng không trailing

File: `tricoral-multi-timeframe-ea-MF04-150926.mq5`

- Giống **hệt MF_01** về tín hiệu vào lệnh và cách đóng lệnh khi đảo chiều
  (`CloseAllPositions()` không điều kiện, dựa trên `g_previousPosition`).
- **Không có trailing stop**: toàn bộ hàm `TrailingStop`/`StopsLevelOk` và các input liên
  quan (`InpTrailDistance`, `InpTrailNotifyStep`, `InpTrailNotifyCooldown`) đã bị loại bỏ
  khỏi file. Lệnh giữ nguyên SL/TP cố định đặt lúc `OpenOrder()` cho tới khi khớp TP/SL hoặc
  bị đóng bởi `CloseAllPositions()` khi đảo chiều.
- Dùng để so sánh hiệu quả: MF_01 (có trailing) vs MF_04 (không trailing) trên cùng 1 bộ
  tín hiệu vào lệnh.

### MF_05 — MF_01 với logic đóng lệnh "bảo vệ" theo lãi/lỗ + chuỗi lệnh

File: `tricoral-multi-timeframe-ea-MF05-170926.mq5`

- Giống **hệt MF_01** về tín hiệu vào lệnh và trailing (2 giai đoạn). Khác duy nhất ở cách
  xử lý khi Coral M1 đảo chiều ngược `g_previousPosition`.
- **Đóng lệnh có điều kiện** (`CloseReversedPositions`, thay cho `CloseAllPositions()` của
  MF_01): khi phát hiện đảo chiều, xét **từng lệnh** đang mở ngược hướng trend mới:
  - **Lệnh đang lãi** (`POSITION_PROFIT >= 0`): đóng ngay, giống MF_01.
  - **Lệnh đang lỗ** (`POSITION_PROFIT < 0`): chỉ đóng nếu **N deal đóng gần nhất** (mặc định
    N=5, lọc theo magic + symbol, chỉ tính deal `DEAL_ENTRY_OUT`) đều **cùng hướng** với lệnh
    đang xét (`LastClosedDealsSameDirection`) — tức thị trường đã có 1 chuỗi ≥N lệnh cùng
    hướng trước đó rồi, tín hiệu đảo chiều đáng tin hơn.
  - Nếu lệnh đang lỗ nhưng **còn nằm trong N lệnh đầu** của 1 chuỗi mới (bị lệnh ngược hướng
    "cắt" chuỗi trước đó, nên chưa đủ N deal cùng hướng) → **giữ lệnh lại**, không đóng, vì
    tín hiệu đảo chiều lúc này có thể chỉ là nhiễu ngắn hạn.
  - Nếu chưa đủ N deal trong lịch sử (bot mới chạy) → mặc định giữ lệnh (coi như chưa đủ điều
    kiện đóng).
- Ý tưởng: MF_01 đóng hết lệnh ngay khi có tín hiệu ngược, kể cả khi đang lỗ ít và thị trường
  có thể chỉ đang giằng co (chưa đủ 1 chuỗi lệnh cùng hướng để xác nhận xu hướng đã đổi thật
  sự) — MF_05 "kiên nhẫn" hơn với lệnh lỗ trong giai đoạn đầu 1 chuỗi mới, chỉ cắt lỗ dứt
  khoát khi xu hướng cũ đã đủ dài (≥N lệnh) mới đảo chiều.
- Trong **file gộp**, N được đưa ra thành input `InpMF05_HoldStreakCount` (mặc định 5) thay
  vì hard-code; bản standalone dùng giá trị cố định `5`.

## 5. File gộp `tricoral-multi-strategy-ea-MF-01-05.mq5`

- Chạy cả 5 chiến lược trên, mỗi chiến lược 1 "config" (`struct StrategyConfig`) trong mảng
  `g_strategies[5]`, bật/tắt độc lập qua `InpMFxx_Enabled`, đọc chung 1 snapshot Coral mỗi
  tick (`BuildCoralSnapshot`) để tránh đọc buffer trùng lặp.
- Cách đóng lệnh khi đảo chiều được trừu tượng hoá qua `ENUM_EXIT_MODE`:
  - `EXIT_LEGACY_CLOSE_ALL` — MF_01 / MF_02 / MF_04.
  - `EXIT_PER_POSITION_M1_M5` — MF_03.
  - `EXIT_STREAK_GUARDED_CLOSE_ALL` — MF_05.
- Trailing được trừu tượng hoá qua `ENUM_TRAIL_MODE`:
  - `TRAIL_TWO_STAGE` — MF_01 / MF_02 / MF_05.
  - `TRAIL_BREAKEVEN_ONLY` — MF_03.
  - `TRAIL_NONE` — MF_04.
- Mỗi chiến lược có magic + comment lệnh riêng (`IsBotPosition(s)` check cả 2 lớp), giới hạn
  lãi/lỗ ngày + khung giờ tính riêng theo magic từng chiến lược — chạm ngưỡng chỉ chặn
  `OpenOrder` của chiến lược đó, không ảnh hưởng chiến lược khác.
