# Exness Dashboard (Vue 3)

Dashboard tổng quan cho các tài khoản MT5 của Exness, đọc dữ liệu từ **báo cáo lịch sử HTML** xuất từ
MetaTrader 5. App chỉ có frontend, cộng một endpoint nhỏ trong Vite dev server để đọc file.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
```

App chỉ đọc được báo cáo khi chạy `npm run dev`.

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
mql5/ExportCandlesCsv.mq5     Script MT5 xuất nến M1/M5/M15 ra CSV
dashboard-password-guard.ts   Dev server: mật khẩu (Basic Auth) khi public qua tunnel
src/api/mt5-report-parser.ts  Đọc báo cáo HTML (UTF-16) của MT5
src/api/mt5-entry-comment-parser.ts  Đọc ATR / ER5 từ comment lệnh
src/api/mt5-candles-csv-parser.ts    Đọc nến CSV (script hoặc Export Bars)
src/stores/reports.ts         Tải báo cáo, gộp theo tài khoản
src/stores/settings.ts        Tuỳ chọn múi giờ (localStorage)
src/utils/stats.ts            Tổng hợp số liệu, PnL theo ngày
src/utils/trading-extremes-stats.ts  Ngày lãi/lỗ lớn nhất, chuỗi thua dài nhất
src/views/                    DashboardView (Tổng quan), ReportsView (Báo cáo MT5)
src/components/               SummaryPanel, PnlCalendar, ClosedDeals, DateRangePicker, Mt5ReportsPanel,
                              PnlBreakdownCharts + PnlBarChart (tab Biểu đồ),
                              TradePriceChart + TradeChartTradeList (tab Chart giá, lightweight-charts)
```
