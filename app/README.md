# Exness Dashboard (Vue 3)

Dashboard tổng quan cho nhiều tài khoản Exness, gọi trực tiếp **Exness Trader API** từ trình duyệt
(chỉ có frontend). Tài liệu API: https://www.exness-api.com/trading/get-started

## Chạy

```bash
npm install
cp .env.example .env   # điền API_KEY, SECRET_KEY (tuỳ chọn API_HOST)
npm run dev            # http://localhost:5173
```

## Key trong `.env` (khuyên dùng)

```
API_KEY=exnsk-...
SECRET_KEY=<hex/base64/PEM Ed25519>
API_HOST=https://api.exness.com   # tuỳ chọn
```

- **Dev server (Node) đọc `.env` và tự ký request.** Secret Key không bao giờ được gửi xuống trình duyệt;
  trình duyệt chỉ thấy API key đã che (`/__exness-env/info`).
- Trên trang Quản lý tài khoản, key này hiện tên **"Key từ .env"** và là key mặc định cho tài khoản từ file.
- Chỉ cho phép request GET và chỉ nhận request từ localhost.
- Sửa `.env` xong thì chạy lại `npm run dev`.
- `.env` đã nằm trong `.gitignore`. **Không commit file này.**
- Cách này chỉ chạy được với `npm run dev`; bản build tĩnh (`npm run build`) không có key `.env`.

## Quản lý tài khoản (trang `/accounts`)

Exness không có API liệt kê tài khoản, nên danh sách tài khoản lấy từ hai nguồn:

1. **File `public/accounts.json`.** App đọc file này khi mở; bấm "Tải lại file" để đọc lại. Mẫu:
   ```json
   [
     { "account_id": 33333, "account_name": "MF_01" },
     { "account_id": 44444, "account_name": "MF_02", "key": "Key chung", "resolve_access_point": true }
   ]
   ```
   - Chấp nhận cả `acount_name`. Tên trường không có ngoặc kép cũng được.
   - `key` (không bắt buộc): tên một key trong mục API key. Bỏ trống thì dùng "Key dùng cho file".
   - `resolve_access_point` (mặc định `true`): gọi `GET /v1/trading/access-point` để tìm host riêng.
   - Tài khoản từ file chỉ sửa được trong file.
2. **Thêm tay trên trang.** Có thể nhập nhiều Account ID một lúc, cách nhau bằng dấu phẩy.

**API key** là danh sách riêng, và **một key có thể dùng chung cho nhiều tài khoản** nếu lúc tạo key trong
Key Management bạn đã chọn các tài khoản đó.

| Trường        | Nguồn                                                    |
|---------------|----------------------------------------------------------|
| API Key       | Public key, dạng `exnsk_...`                             |
| Secret Key    | Secret Ed25519 (nhận PEM PKCS#8, hex hoặc base64)        |
| Host          | DNS widget, mặc định `https://api.exness.com`            |

Nút "Kiểm tra" gọi `account` và `snapshot` để xác nhận key truy cập được tài khoản.

> ⚠️ Key được lưu trong `localStorage` và ký request ngay trên trình duyệt. Chỉ dùng trên máy cá nhân,
> nên tạo key chỉ có quyền đọc và giới hạn IP. File `accounts.json` chỉ chứa ID và tên, **không** chứa key.

## Tài khoản MT4/MT5: đọc báo cáo HTML

API Exness chỉ hỗ trợ tài khoản chạy trên **Exness Terminal / Exness Trade**. Với tài khoản MT5:

1. Trong MT5: **Toolbox → History** → chuột phải → **Report → HTML**. Nên để giao diện MT5 bằng **tiếng Anh**.
2. Lưu file vào `app/reports/`. Thư mục này nằm trong `.gitignore`.
3. Mở **Quản lý tài khoản → Báo cáo MT5 → Tải lại báo cáo**.

- Đọc phần đầu báo cáo (Account, Date), bảng **Deals** và phần tổng kết (Balance, Equity, Floating P/L).
- Nhiều file cùng một tài khoản được gộp, deal trùng ticket chỉ tính một lần.
- Tên hiển thị lấy từ `accounts.json` nếu trùng số tài khoản, ví dụ "MF_01 (MT5)". Khi đó dashboard dùng
  báo cáo thay cho API.
- Phí giao dịch = Commission + Fee + Swap.
- Khối lượng giao dịch là **ước lượng**, vì báo cáo không có contract size: vàng 100 oz, bạc 5 000 oz,
  cặp tiền 100 000. Các mã khác không quy đổi được.
- Số liệu chỉ mới đến lúc xuất báo cáo; xuất file mới để cập nhật.
- Chỉ đọc được khi chạy `npm run dev`.

## Chế độ kết nối

- **Qua proxy dev** (mặc định): Vite dev server chuyển tiếp request qua `/__exness/<host>/...`
  (xem `exness-dev-proxy.ts`). Với key nhập tay, chữ ký vẫn được tạo ở trình duyệt.
- **Gọi trực tiếp**: trình duyệt gọi thẳng tới host Exness. Hiện Exness **chặn CORS**, nên cách này báo lỗi
  "Không kết nối được API".
- Key từ `.env` luôn đi qua proxy dev.

## Dữ liệu và cách tính

| Chỉ số                | Cách tính                                                                           |
|-----------------------|-------------------------------------------------------------------------------------|
| Lợi nhuận ròng        | Lãi + lỗ của các deal `close` + phí giao dịch                                       |
| Phí giao dịch         | `commission` của deal `open`/`close` + deal `swap_fee`/`admin_fee`                  |
| Lệnh đã đóng          | Số deal `close` trong kỳ (có lãi: profit > 0, thua lỗ: profit < 0)                  |
| Khối lượng giao dịch  | Σ lot × `contract_size` × giá của deal mở và đóng, quy về tiền tệ tài khoản         |
| Equity / P/L chưa TH  | Lấy từ `GET /snapshot`: `equity`, `equity − balance`                                |
| Bộ lọc thời gian      | Chọn nhanh (Hôm nay, 7/30/90/365 ngày, Tháng này, Tháng trước) hoặc chọn ngày bắt đầu – kết thúc trên lịch |
| Lịch PnL hàng ngày    | Nhóm deal theo ngày (UTC+0 hoặc giờ máy, chọn trong phần cài đặt)                   |

Các endpoint đang dùng: `access-point` (tuỳ chọn), `configuration/.../account`, `.../limits`,
`.../instruments/{instrument}/conditions`, `trading/.../snapshot`, `history/.../deals`.

- Lịch sử deals được tự chia nhỏ theo `history_range_days` và đi hết các trang `cursor`.
- Tốc độ gọi được giãn theo `rate_limit` lấy từ endpoint `/limits`.
- Nếu `history_age_days` ngắn hơn kỳ đã chọn, dashboard sẽ hiện cảnh báo.

## Cấu trúc

```
src/api/signing.ts     Ký Ed25519 (EXN-DATA / EXN-SIGN)
src/api/client.ts      Client theo tài khoản: host, limits, phân trang
src/views/             DashboardView (Tổng quan), AccountsView (Quản lý tài khoản)
src/stores/            settings (key, tài khoản, file JSON; lưu localStorage) + dashboard (cache dữ liệu)
src/utils/stats.ts     Tổng hợp số liệu, PnL theo ngày
src/api/mt5-report-parser.ts  Đọc báo cáo HTML của MT5
src/components/        SummaryPanel, PnlCalendar, ClosedDeals, DateRangePicker, KeyForm, Mt5ReportsPanel
exness-dev-proxy.ts    Proxy + ký request bằng key .env (dev server)
mt5-reports-dev-endpoint.ts  Liệt kê / đọc file trong reports/ (dev server)
```
