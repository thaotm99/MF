# Exness Dashboard (Vue 3)

Dashboard tổng quan cho các tài khoản MT5 của Exness, đọc dữ liệu từ **báo cáo lịch sử HTML** xuất từ
MetaTrader 5. App chỉ có frontend, cộng một endpoint nhỏ trong Vite dev server để đọc file.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
```

App chỉ đọc được báo cáo khi chạy `npm run dev`.

## Các trang (sidebar)

| Trang | Đường dẫn | Nội dung |
|---|---|---|
| Tổng quan | `/` | Số liệu tổng của kỳ, ngày lãi/lỗ lớn nhất, chuỗi thua, lịch PnL hàng ngày |
| Chart giá | `/chart` | Nến + điểm vào/ra lệnh, cấu trúc HH/HL/LH/LL (`/chart?trade=<id>&tf=M15` zoom tới lệnh) |
| Đánh giá lệnh | `/evaluation` | Bối cảnh price action từng lệnh + thắng/thua theo yếu tố |
| Biểu đồ | `/breakdown` | Lãi/lỗ theo giờ, chiều, khối lượng, mã, ATR, ER5 + bản đồ nhiệt |
| Lệnh đã đóng | `/trades` | Danh sách deal đóng |
| So sánh tài khoản | `/compare` | Bảng chỉ số mọi tài khoản |
| Báo cáo MT5 | `/reports` | File báo cáo, tiền tệ hiển thị, múi giờ |

Bộ lọc **tài khoản** và **thời gian** dùng chung cho mọi trang và được giữ khi chuyển trang. Mỗi lần chuyển trang,
app đọc lại thư mục `reports/`.

## Public ra internet (Cloudflare Tunnel)

1. Cài một lần: `brew install cloudflared`
2. Đặt mật khẩu trong `app/.env` (copy từ `.env.example`; file `.env` không commit):
   ```
   DASHBOARD_PASSWORD=mat-khau-dai-kho-doan
   ```
3. Chạy hai cửa sổ terminal:
   ```bash
   npm run dev      # cửa sổ 1
   npm run tunnel   # cửa sổ 2 → in ra https://xxx.trycloudflare.com
   ```
4. Mở link, trình duyệt hỏi đăng nhập: user `admin` (đổi bằng `DASHBOARD_USER`), mật khẩu ở bước 2.

- Có mật khẩu: mọi trang, file và báo cáo đều phải đăng nhập (kể cả trên máy mình). Sai mật khẩu bị trễ 1 giây.
- **Chưa đặt mật khẩu: truy cập qua tunnel bị từ chối (403)**, chỉ dùng được trực tiếp trên máy.
- Link `trycloudflare.com` đổi mỗi lần chạy `npm run tunnel`. Muốn link cố định cần tài khoản Cloudflare
  + named tunnel; thêm tên miền đó vào `DASHBOARD_ALLOWED_HOSTS`.
- Máy phải bật và đang chạy cả `npm run dev` lẫn `npm run tunnel`.
- Sửa `.env` thì chạy lại `npm run dev`.

## Thêm dữ liệu

1. Trong MT5 (giao diện **tiếng Anh**): **Toolbox → History** → chuột phải → **Report → HTML**.
2. Lưu file vào `app/reports/`. Thư mục này nằm trong `.gitignore`, **không commit** báo cáo.
3. Mở trang **Báo cáo MT5 → Tải lại báo cáo**. Khi chuyển sang trang Tổng quan, app cũng tự đọc lại.

- Mỗi file là một tài khoản (số tài khoản lấy từ dòng `Account:`, tên hiển thị lấy từ `Name:`).
- Nhiều file cùng một tài khoản được gộp; deal trùng ticket chỉ tính một lần, nên có thể xuất theo từng kỳ.
- Muốn cập nhật số liệu thì xuất file mới (ghi đè hoặc thêm file).

## Chart giá (điểm vào/ra lệnh)

Tab **Chart giá** vẽ nến từ file CSV trong `app/candles/` (gitignored) và đánh dấu vị thế đóng trong kỳ đã chọn:
mũi tên = vào lệnh (▲ Buy, ▼ Sell), chấm tròn = ra lệnh; cả hai tô xanh nếu lệnh lãi, đỏ nếu lỗ. Bấm một lệnh trong danh sách
để zoom tới lệnh và kẻ đường giá vào/ra; rê chuột lên marker để xem chi tiết.

Lấy nến từ MT5 — một trong hai cách:

1. **Script** `app/mql5/ExportCandlesCsv.mq5`: copy vào `MQL5/Scripts/` (File → Open Data Folder), Compile trong
   MetaEditor, kéo vào chart. Mặc định xuất M1 30 ngày, M5 90 ngày, M15 180 ngày của mã đang mở ra
   `MQL5/Files/candles/<MÃ>_<KHUNG>.csv`.
2. **Xuất tay**: View → Symbols → tab Bars → chọn mã, khung, khoảng ngày → Request → Export Bars.

Copy file `.csv` vào `app/candles/` rồi bấm **Tải lại nến**. Tên file phải dạng `<MÃ>_<KHUNG>...csv`
(ví dụ `XAUUSDc_M5.csv`; tên mặc định của Export Bars cũng được).

- Nên đặt **Tools → Options → Charts → Max bars in chart = Unlimited**, nếu không MT5 giới hạn số nến.
- Lượng lịch sử M1 có được tuỳ server Exness.
- Giờ trên chart là giờ server MT5 (UTC+0), cùng hệ với báo cáo.
- Mã được so khớp cả khi khác hậu tố (`XAUUSDc` ↔ `XAUUSD`).

## Đánh giá lệnh (price action)

Tab **Đánh giá lệnh** đọc nến (file trong `app/candles/`, mặc định khung M15) **đã đóng trước giờ vào lệnh** — không dùng
nến tương lai — để mô tả bối cảnh thị trường lúc vào từng lệnh, rồi thống kê thắng/thua theo từng yếu tố:

| Yếu tố | Rule |
|---|---|
| Cấu trúc | Swing fractal (độ mạnh k nến mỗi bên, mặc định 3) trong 120 nến: HH+HL = tăng, LH+LL = giảm, còn lại = sideway |
| Thuận / ngược | Buy trong xu hướng tăng / Sell trong xu hướng giảm = thuận; ngược lại = ngược |
| Phá cấu trúc | Giá đóng nến trước khi vào đã vượt đỉnh swing gần nhất (phá đỉnh) / thủng đáy swing gần nhất |
| Vị trí trong range | Giá vào ở vùng thấp (< 1/3) / giữa / cao (> 2/3) của range N nến (mặc định 20) |
| Cản phía trước | Buy: đỉnh swing gần nhất phía trên; Sell: đáy swing gần nhất phía dưới; khoảng cách theo ATR14 |
| Nến trước khi vào | Engulfing, pin bar, doji, inside bar, nến tăng/giảm; xác nhận hay ngược chiều lệnh |
| EMA20 | Giá trên/dưới EMA20, EMA dốc lên/xuống (so với 5 nến trước) |
| Biến động | ATR14 hiện tại so với trung bình 50 nến: tăng (> 1.25×) / thấp (< 0.8×) / bình thường |
| Khung H1 / H4 | Gộp nến khung đánh giá thành H1/H4 (mốc UTC), cấu trúc swing như trên; thuận / ngược / sideway so với chiều lệnh |
| So với ngày hôm trước | Giá vào trên PDH / sát PDH (< 0.5 ATR) / trong range / sát PDL / dưới PDL (ngày D1 đã đóng gần nhất, gộp từ nến) |
| Số tròn | Khoảng cách tới số tròn gần nhất theo ATR (bước: giá ≥ 1000 → 10; ≥ 100 → 1; ≥ 10 → 0.1; còn lại 0.001) |
| Phiên | Theo giờ server UTC+0: Á 0–7h, Âu 7–12h, Âu–Mỹ 12–16h, Mỹ 16–21h, cuối ngày 21–24h |

**Tổ hợp setup** — ghép 2–3 yếu tố lúc vào lệnh, tìm tổ hợp lãi nhất / lỗ nhất:

- Chia lệnh theo thời gian: 70% đầu để **tìm**, 30% sau để **kiểm tra** (không dùng để chọn) → hạn chế tối ưu quá khớp.
- Chỉ xét tổ hợp đủ số lệnh tối thiểu (mặc định 15) ở phần tìm; bỏ nhóm "Không đủ nến / Không rõ";
  bỏ tổ hợp chỉ là bản mở rộng của tổ hợp đơn giản hơn đã chọn.
- "Lặp lại ✓" = ở phần kiểm tra tổ hợp vẫn lãi (setup tốt) / vẫn lỗ (setup xấu) với ≥ 5 lệnh — chỉ nên đưa những tổ hợp này vào EA.

**Trước khi đóng lệnh** — N nến (mặc định 5, khung mặc định M5) đã đóng ngay trước giờ đóng lệnh:

| Chỉ số | Rule |
|---|---|
| Đà giá | Giá đi theo chiều lệnh ≥ +0.5 ATR = chạy thuận; ≤ −0.5 ATR = quay đầu; còn lại = đi ngang |
| Số nến thuận | Số nến chạy theo chiều lệnh (Buy: nến tăng) trong N nến |
| Lợi nhuận trả lại | Giá tốt nhất trong N nến so với giá đóng (Buy: đỉnh cao nhất − giá đóng), theo ATR |
| Nến cuối | Pin bar / engulfing ngược chiều lệnh ngay trước khi đóng = đảo chiều |

**Biên độ trong lệnh (MAE / MFE)** — nến khung đóng lệnh chồng lên [giờ vào, giờ ra], theo ATR14 lúc vào:

| Chỉ số | Cách tính |
|---|---|
| MAE | Giá đi ngược chiều lệnh xa nhất so với giá vào (Buy: giá vào − đáy thấp nhất) |
| MFE | Giá đi thuận chiều lệnh xa nhất so với giá vào (Buy: đỉnh cao nhất − giá vào) |
| MAE lệnh thắng p50/p75/p90 | Gợi ý SL: SL hẹp hơn p90 sẽ cắt mất lệnh thắng |
| Lệnh thua từng có lãi | % lệnh thua có MFE ≥ 0.5 / 1 / 1.5 ATR — ứng viên dời SL về hoà vốn |
| Lệnh thắng chốt được | Trung vị (kết quả theo giá / MFE) của lệnh thắng — thấp nghĩa là TP/trailing nhả nhiều |

- Nến đầu/cuối có thể gồm một phần trước khi vào / sau khi ra → dùng M1/M5 cho chính xác. Biểu đồ phân tán cắt ở phân vị 98%.

- "Trả lại" có ý nghĩa nhất với **lệnh thắng** (lọc Thắng trong danh sách): cho biết trailing/TP nhả bao nhiêu.
- Khi zoom tới một lệnh trên Chart giá, 5 nến trước giờ đóng được tô đậm.

- Danh sách từng lệnh có mô tả bối cảnh lúc vào + trước khi đóng, và nút **Xem trên chart** (mở Chart giá, zoom tới lệnh).
- Tab Chart giá có tuỳ chọn **Cấu trúc (HH/HL/LH/LL)** để hiện các điểm swing.
- Swing cần k nến bên phải mới được xác nhận → cấu trúc **trễ k nến** so với lúc đỉnh/đáy hình thành
  (đúng như bot thấy lúc vào lệnh). Giảm độ mạnh swing để bớt trễ.
- Nhóm dưới 5 lệnh hiện mờ — mẫu quá nhỏ để kết luận.

## Nhật ký lệnh (nhãn & ghi chú)

- Gắn nhãn (Đúng setup, Sai cấu trúc, Vào sớm/muộn, Thoát sớm/muộn, Tin tức, Khác, hoặc nhãn riêng) và ghi chú cho từng lệnh:
  cột **Nhãn** trong danh sách ở trang Đánh giá lệnh, hoặc ô **Nhãn & ghi chú** khi chọn một lệnh trên Chart giá.
- Lưu tự động vào `app/journal/trade-journal.json` (theo ticket vị thế MT5, nằm trong `.gitignore`), chỉ khi chạy `npm run dev` trên máy.
- Trang Đánh giá lệnh có bảng **Theo nhãn của bạn** (thắng/thua theo nhãn) và bộ lọc theo nhãn trong danh sách.
  Lệnh có nhiều nhãn được tính vào mỗi nhãn.

## Cách tính

| Chỉ số                 | Cách tính                                                                    |
|------------------------|------------------------------------------------------------------------------|
| Lợi nhuận ròng         | Lãi + lỗ của các deal `out` + Commission/Fee/Swap (phí không hiển thị riêng) |
| Lệnh đã đóng           | Số deal `out`. Có lãi: profit ≥ 0, giống "Profit Trades" của MT5             |
| Tỷ lệ chiến thắng      | Lệnh có lãi / lệnh đã đóng trong kỳ đã chọn                                  |
| Lợi nhuận hôm nay      | Lãi/lỗ ròng của lệnh đóng hôm nay (theo múi giờ đã chọn), không phụ thuộc kỳ |
| Ngày lãi / lỗ lớn nhất | Ngày có lãi/lỗ ròng cao nhất trên lịch PnL trong kỳ (theo múi giờ đã chọn)   |
| Thua liên tiếp nhiều nhất | Chuỗi lệnh lỗ (profit < 0) dài nhất trong kỳ, theo giờ đóng; như "Maximum consecutive losses" của MT5 |
| Khối lượng giao dịch   | Σ lot × contract size × giá của deal `in` và `out`, quy về tiền tệ tài khoản  |
| Equity                 | `Equity:` trong phần tổng kết của báo cáo mới nhất                            |
| Lịch PnL hàng ngày     | Nhóm deal theo ngày (giờ server MT5 UTC+0 hoặc giờ máy)                      |
| Tab Biểu đồ            | Lãi/lỗ ròng (Profit + Commission + Swap) của vị thế đóng trong kỳ, từ bảng **Positions**, theo giờ vào lệnh / Buy-Sell / khối lượng / mã / ATR / ER5 |
| Bản đồ nhiệt           | Tab Biểu đồ: Giờ × ATR / Giờ × ER5 / ATR × ER5; ô = lãi/lỗ ròng (hoặc tỷ lệ thắng) và số lệnh, ô < 3 lệnh làm mờ |
| So sánh tài khoản      | Tab riêng: lợi nhuận ròng, lệnh, tỷ lệ thắng, Profit Factor, lãi/lỗ TB, kỳ vọng/lệnh, chuỗi thua, max drawdown, equity; bấm tiêu đề để sắp xếp |
| Max drawdown           | Sụt giảm lớn nhất của balance so với đỉnh trong kỳ; nạp/rút dịch đỉnh theo (không tính là sụt giảm) — khớp "Balance Drawdown Maximal" của MT5 |
| ATR, ER5 lúc vào lệnh  | Đọc từ comment lệnh của EA: `A:` (cũ `ATR :`), `er5:` (cũ `er:`, ER trên M5). ATR chia bước 0.5 (gộp ≥ 5), ER5 bước 0.1. Lệnh không có giá trị hoặc comment bị MT5 cắt (31 ký tự) thì bỏ qua |

- **Tiền tệ hiển thị:** nút **USD | USC** ở trang **Báo cáo MT5 → Cài đặt**, mặc định USD, được nhớ trong trình duyệt.
  1 USD = 100 USC; áp dụng cho mọi số tiền, nên gộp tài khoản USD với tài khoản cent vẫn cộng đúng.
  Tài khoản dùng loại tiền khác giữ nguyên và có cảnh báo.
- Deal `balance`, `credit`, `correction` (nạp/rút) không tính vào lãi/lỗ.
- **Khối lượng giao dịch chỉ là ước lượng**, vì báo cáo không có contract size: vàng 100 oz, bạc 5 000 oz,
  cặp tiền 100 000. Mã khác không quy đổi được. Tài khoản cent (USC) = USD × 100.
- Đã đối chiếu với phần "Results" của báo cáo thật: Total Net Profit, Gross Profit/Loss, Total Trades,
  Profit/Loss Trades đều khớp.

## Cấu trúc

```
local-folder-dev-endpoint.ts  Dev server: liệt kê / đọc file trong reports/ và candles/ (chỉ localhost)
trade-journal-dev-endpoint.ts Dev server: đọc / ghi journal/trade-journal.json (chỉ localhost)
mql5/ExportCandlesCsv.mq5     Script MT5 xuất nến M1/M5/M15 ra CSV
dashboard-password-guard.ts   Dev server: mật khẩu (Basic Auth) khi public qua tunnel
src/api/mt5-report-parser.ts  Đọc báo cáo HTML (UTF-16) của MT5
src/api/mt5-entry-comment-parser.ts  Đọc ATR / ER5 từ comment lệnh
src/api/mt5-candles-csv-parser.ts    Đọc nến CSV (script hoặc Export Bars)
src/stores/reports.ts         Tải báo cáo, gộp theo tài khoản
src/stores/settings.ts        Tuỳ chọn múi giờ (localStorage)
src/stores/trade-journal.ts   Nhãn / ghi chú từng lệnh (lưu qua dev server)
src/utils/stats.ts            Tổng hợp số liệu, PnL theo ngày
src/utils/trading-extremes-stats.ts  Ngày lãi/lỗ lớn nhất, chuỗi thua dài nhất
src/utils/account-comparison-stats.ts  Chỉ số so sánh tài khoản, max drawdown
src/utils/position-dimension-bins.ts  Chia nhóm giờ / ATR / ER5 (biểu đồ cột + bản đồ nhiệt)
src/utils/price-action-features.ts   ATR, EMA, swing fractal, cấu trúc, mẫu nến (không nhìn trước)
src/utils/trade-evaluation.ts        Đánh giá bối cảnh từng lệnh
src/utils/trade-evaluation-features.ts  Danh sách yếu tố + thống kê thắng/thua theo nhóm
src/utils/candle-resample.ts         Gộp nến sang H1 / H4 / D1
src/utils/trade-context-features.ts  Khung lớn, ngày hôm trước, số tròn, phiên
src/utils/setup-combination-finder.ts  Tổ hợp 2–3 điều kiện tốt/xấu nhất, chia tìm / kiểm tra
src/utils/trade-excursion.ts         MAE / MFE từng lệnh + tóm tắt
src/utils/trade-journal-stats.ts     Thống kê theo nhãn nhật ký
src/utils/trade-exit-evaluation.ts   Phân tích N nến trước khi đóng lệnh
src/views/                    Mỗi trang một view (Overview, PriceChart, Evaluation, Breakdown, Trades, Compare, Reports)
src/stores/filters.ts         Bộ lọc dùng chung (tài khoản, kỳ, tháng trên lịch)
src/composables/use-dashboard-data.ts  Dữ liệu đã lọc + quy đổi tiền tệ, dùng chung cho mọi trang
src/components/AnalysisPage.vue  Khung trang: tiêu đề + thanh lọc
src/components/               SummaryPanel, PnlCalendar, ClosedDeals, DateRangePicker, Mt5ReportsPanel,
                              PnlBreakdownCharts + PnlBarChart (tab Biểu đồ),
                              TradePriceChart + TradeChartTradeList (tab Chart giá, lightweight-charts),
                              TradeEvaluationTab + SetupCombinationSection + ExcursionSection + TradeEvaluationList (Đánh giá lệnh),
                              TradeJournalEditor (nhãn & ghi chú)
```
