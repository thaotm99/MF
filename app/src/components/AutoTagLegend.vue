<script setup lang="ts">
import { AUTO_TAG_RULES } from '../utils/trade-auto-tags'

/** Giải thích từng nhãn tự động (bấm để mở) */
defineProps<{ entryTimeframe?: string; exitTimeframe?: string }>()
</script>

<template>
  <details class="card legend">
    <summary>Nhãn tự động là gì?</summary>
    <p>
      Nhãn có viền nét đứt được máy tự gán từ nến <template v-if="entryTimeframe">(vào lệnh: {{ entryTimeframe }}, đóng lệnh: {{ exitTimeframe }})</template>
      — nhãn vào lệnh chỉ dùng nến đã đóng trước giờ vào; nhãn thoát lệnh dùng nến trong lúc giữ lệnh (riêng "Thoát sớm" xem thêm 5 nến sau khi đóng). Không lưu vào nhật ký, đổi khung / tham số thì
      tính lại. Rê chuột lên nhãn để xem lý do cụ thể của lệnh đó. Nhãn đặc màu là nhãn bạn tự gán.
    </p>
    <dl>
      <template v-for="r in AUTO_TAG_RULES" :key="r.id">
        <dt><span class="chip auto">{{ r.label }}</span></dt>
        <dd>{{ r.description }}</dd>
      </template>
    </dl>
    <p class="muted">"Tin tức", "Đúng setup", "Sai cấu trúc" cần bạn tự gán (máy chưa có lịch tin, và đây là đánh giá của bạn).</p>
  </details>
</template>

<style scoped>
.legend { border: 1px solid var(--border); padding: 0 14px; margin: 10px 0; font-size: 12px; }
summary { cursor: pointer; padding: 10px 0; font-weight: 600; font-size: 13px; }
p { margin: 0 0 8px; color: var(--muted); line-height: 1.5; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0 0 10px; align-items: baseline; }
dt { margin: 0; }
dd { margin: 0; line-height: 1.5; }
.chip.auto { border: 1px dashed var(--muted); border-radius: 4px; padding: 1px 6px; font-size: 11px; white-space: nowrap; }
.muted { color: var(--faint); }
@media (max-width: 600px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 6px; } }
</style>
