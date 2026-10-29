<script setup lang="ts">
import { onMounted } from 'vue'
import BrowserFileImport from '../components/BrowserFileImport.vue'
import Mt5ReportsPanel from '../components/Mt5ReportsPanel.vue'
import { useCandlesStore } from '../stores/candles'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
const candles = useCandlesStore()
onMounted(() => candles.state === 'idle' && void candles.list())
</script>

<template>
  <main class="page">
    <h1>Báo cáo MT5</h1>

    <Mt5ReportsPanel />

    <!-- Bản deploy: nạp file nến ngay trên trình duyệt (bản chạy npm run dev đọc app/candles/) -->
    <section v-if="candles.source === 'browser'" class="card block">
      <h2>File nến</h2>
      <p class="muted small">
        Dùng cho Chart giá, Đánh giá lệnh và nhãn tự động. Xuất bằng script <code>app/mql5/ExportCandlesCsv.mq5</code> trong MT5
        (hoặc View → Symbols → Bars → Export). Tên file dạng <code>XAUUSDc_M5.csv</code> (mã_khung). Chỉ lưu trong trình duyệt này.
      </p>
      <BrowserFileImport accept=".csv" label="Chọn file nến (.csv)" :files="candles.files"
        :on-import="candles.importFiles" :on-remove="candles.removeFile" />
    </section>

    <section class="card block">
      <h2>Cài đặt</h2>
      <h3>Tiền tệ hiển thị</h3>
      <div class="seg" role="radiogroup" aria-label="Tiền tệ hiển thị">
        <button v-for="c in (['USD', 'USC'] as const)" :key="c" type="button" role="radio"
          :aria-checked="settings.displayCurrency === c" :class="{ on: settings.displayCurrency === c }"
          @click="settings.displayCurrency = c">{{ c }}</button>
      </div>
      <p class="muted small">1 USD = 100 USC. Áp dụng cho mọi số tiền trên trang Tổng quan.</p>
      <h3>Múi giờ cho lịch PnL</h3>
      <label class="check"><input v-model="settings.timeZone" type="radio" value="utc" /> Giờ server MT5 (UTC+0)</label>
      <label class="check"><input v-model="settings.timeZone" type="radio" value="local" /> Giờ máy của bạn</label>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1240px; margin: 0 auto; padding: 24px 24px 48px; }
h1 { font-size: 26px; font-weight: 600; margin: 0 0 8px; }
h2 { font-size: 17px; margin: 0; }
h3 { font-size: 14px; margin: 14px 0 8px; }
.block { padding: 20px 24px; margin-top: 16px; }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; background: var(--surface); padding: 8px 18px; color: var(--muted); font-weight: 500; }
.seg button + button { border-left: 1px solid var(--border); }
.seg button.on { background: var(--accent); color: #fff; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
label.check { display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 4px 0; }
@media (max-width: 520px) { h1 { font-size: 24px; } .block { padding: 16px; } }
</style>
