# Exness Dashboard (Vue 3)

Dashboard tổng quan cho các tài khoản MT5 của Exness, đọc dữ liệu từ **báo cáo lịch sử HTML** xuất từ
MetaTrader 5. App chỉ có frontend, cộng một endpoint nhỏ trong Vite dev server để đọc file.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
```

App chỉ đọc được báo cáo khi chạy `npm run dev`.

## Thêm dữ liệu

1. Trong MT5 (giao diện **tiếng Anh**): **Toolbox → History** → chuột phải → **Report → HTML**.
2. Lưu file vào `app/reports/`. Thư mục này nằm trong `.gitignore`, **không commit** báo cáo.
3. Mở trang **Báo cáo MT5 → Tải lại báo cáo**. Khi chuyển sang trang Tổng quan, app cũng tự đọc lại.

- Mỗi file là một tài khoản (số tài khoản lấy từ dòng `Account:`, tên hiển thị lấy từ `Name:`).
- Nhiều file cùng một tài khoản được gộp; deal trùng ticket chỉ tính một lần, nên có thể xuất theo từng kỳ.
- Muốn cập nhật số liệu thì xuất file mới (ghi đè hoặc thêm file).

## Cách tính

| Chỉ số                 | Cách tính                                                                    |
|------------------------|------------------------------------------------------------------------------|
| Lợi nhuận ròng         | Lãi + lỗ của các deal `out` + phí giao dịch                                  |
| Lệnh đã đóng           | Số deal `out`. Có lãi: profit ≥ 0, giống "Profit Trades" của MT5             |
| Phí giao dịch          | Commission + Fee + Swap                                                      |
| Khối lượng giao dịch   | Σ lot × contract size × giá của deal `in` và `out`, quy về tiền tệ tài khoản  |
| Equity / P/L chưa TH   | `Equity:` / `Floating P/L:` trong phần tổng kết của báo cáo mới nhất          |
| Lịch PnL hàng ngày     | Nhóm deal theo ngày (giờ server MT5 UTC+0 hoặc giờ máy)                      |
| Tab Biểu đồ            | Lãi/lỗ ròng (Profit + Commission + Swap) của vị thế đóng trong kỳ, từ bảng **Positions**, theo giờ vào lệnh / Buy-Sell / khối lượng / mã |

- **Tiền tệ hiển thị:** nút **USD | USC** trên trang Tổng quan, mặc định USD, được nhớ trong trình duyệt.
  1 USD = 100 USC; áp dụng cho mọi số tiền, nên gộp tài khoản USD với tài khoản cent vẫn cộng đúng.
  Tài khoản dùng loại tiền khác giữ nguyên và có cảnh báo.
- Deal `balance`, `credit`, `correction` (nạp/rút) không tính vào lãi/lỗ.
- **Khối lượng giao dịch chỉ là ước lượng**, vì báo cáo không có contract size: vàng 100 oz, bạc 5 000 oz,
  cặp tiền 100 000. Mã khác không quy đổi được. Tài khoản cent (USC) = USD × 100.
- Đã đối chiếu với phần "Results" của báo cáo thật: Total Net Profit, Gross Profit/Loss, Total Trades,
  Profit/Loss Trades đều khớp.

## Cấu trúc

```
mt5-reports-dev-endpoint.ts   Dev server: liệt kê / đọc file trong reports/ (chỉ localhost)
src/api/mt5-report-parser.ts  Đọc báo cáo HTML (UTF-16) của MT5
src/stores/reports.ts         Tải báo cáo, gộp theo tài khoản
src/stores/settings.ts        Tuỳ chọn múi giờ (localStorage)
src/utils/stats.ts            Tổng hợp số liệu, PnL theo ngày
src/views/                    DashboardView (Tổng quan), ReportsView (Báo cáo MT5)
src/components/               SummaryPanel, PnlCalendar, ClosedDeals, DateRangePicker, Mt5ReportsPanel,
                              PnlBreakdownCharts + PnlBarChart (tab Biểu đồ)
```
