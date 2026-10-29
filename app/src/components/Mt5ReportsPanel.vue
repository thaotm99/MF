<script setup lang="ts">
import { useReportsStore } from '../stores/reports'
import { int, money } from '../utils/format'
import BrowserFileImport from './BrowserFileImport.vue'

const reports = useReportsStore()

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'UTC' }) : '—')
/** Thời điểm xuất báo cáo mới nhất ("Date:" trong báo cáo, giờ server) → "16/10/2026 15:01" */
const fmtReportTime = (iso?: string) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : '—'
const tradeCount = (id: string) =>
  reports.byId(id)?.deals.filter((d) => d.deal.type === 'close').length ?? 0
</script>

<template>
  <section class="card block">
    <div class="block-head">
      <h2>Báo cáo MT5 <span class="count">{{ reports.accounts.length }}</span></h2>
      <button v-if="reports.source === 'server'" class="btn" :disabled="reports.state === 'loading'" @click="reports.load()">
        {{ reports.state === 'loading' ? 'Đang đọc…' : 'Tải lại báo cáo' }}
      </button>
    </div>

    <p v-if="reports.source === 'browser'" class="muted small">
      Trong MT5: <b>Toolbox → History</b> → chuột phải → <b>Report → HTML</b> (giao diện MT5 bằng tiếng Anh), rồi chọn file bên dưới.
      File chỉ lưu trong <b>trình duyệt này</b> (không gửi lên server); mở trên máy / trình duyệt khác thì nạp lại.
      Nhiều file cùng một tài khoản sẽ được gộp (deal trùng chỉ tính một lần); nạp file cùng tên sẽ thay file cũ.
    </p>
    <BrowserFileImport v-if="reports.source === 'browser'" accept=".html,.htm" label="Chọn file báo cáo (.html)"
      :files="reports.files" :on-import="reports.importFiles" :on-remove="reports.removeFile" />
    <p v-else class="muted small">
      Trong MT5: <b>Toolbox → History</b> → chuột phải → <b>Report → HTML</b> (giao diện MT5 bằng tiếng Anh),
      rồi lưu file vào thư mục <code>app/{{ reports.dir }}/</code> và bấm "Tải lại báo cáo". Nhiều file cùng một tài
      khoản sẽ được gộp (deal trùng chỉ tính một lần). Thư mục này nằm trong <code>.gitignore</code>.
    </p>

    <p v-if="reports.state === 'unavailable'" class="alert">
      Trình duyệt không cho lưu dữ liệu (IndexedDB bị tắt, ví dụ chế độ ẩn danh) — không nạp được báo cáo.
    </p>

    <div v-if="reports.accounts.length" class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tài khoản</th>
            <th>Server</th>
            <th>Số liệu đến (giờ server)</th>
            <th>Lịch sử</th>
            <th class="r">Lệnh đã đóng</th>
            <th class="r">Equity</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in reports.accounts" :key="a.id">
            <td><b>{{ a.label }}</b><div class="muted small">#{{ a.login }}</div></td>
            <td>{{ a.server ?? '—' }}</td>
            <td>{{ fmtReportTime(a.latest.reportTime) }}</td>
            <td>{{ fmtDate(a.firstDealTime) }} – {{ fmtDate(a.lastDealTime) }}</td>
            <td class="r">{{ int(tradeCount(a.id)) }}</td>
            <td class="r">{{ a.latest.equity !== undefined ? `${money(a.latest.equity)} ${a.currency}` : '—' }}</td>
            <td class="files">{{ a.files.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-for="f in reports.files.filter((x) => x.error)" :key="f.name" class="alert error">
      <b>{{ f.name }}:</b> {{ f.error }}
    </p>
    <p v-if="reports.state === 'ok' && !reports.files.length && reports.source === 'server'" class="empty">
      Chưa có file trong <code>app/{{ reports.dir }}/</code>.
    </p>
  </section>
</template>

<style scoped>
.block { padding: 20px 24px; margin-top: 16px; }
.block-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
h2 { font-size: 17px; margin: 0; }
.count { background: #eceef0; color: var(--muted); font-size: 12px; border-radius: 999px; padding: 1px 8px; margin-left: 4px; vertical-align: middle; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
code { font-size: 12px; }
.table-wrap { overflow-x: auto; margin-top: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px; border-bottom: 1px solid var(--border); }
td { padding: 10px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.r { text-align: right; }
td.files { white-space: normal; color: var(--muted); font-size: 12px; max-width: 260px; }
.empty { color: var(--muted); text-align: center; padding: 16px 0; margin: 0; }
@media (max-width: 520px) { .block { padding: 16px; } }
</style>
