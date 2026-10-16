<script setup lang="ts">
import type { AutoTag } from '../utils/trade-auto-tags'

/** Nhãn của một lệnh: nhãn tự động (viền nét đứt, rê chuột xem lý do) + nhãn của bạn (đặc màu) */
defineProps<{ auto?: AutoTag[]; manual?: string[]; note?: boolean }>()
</script>

<template>
  <span class="chips">
    <span v-for="t in auto ?? []" :key="t.id" class="chip auto" :title="t.reason">{{ t.label }}</span>
    <span v-for="t in manual ?? []" :key="t" class="chip">{{ t }}</span>
    <span v-if="note" class="chip note" title="Có ghi chú">✎</span>
  </span>
</template>

<style scoped>
.chips { display: inline-flex; flex-wrap: wrap; gap: 3px; }
.chip { background: #eef2ff; color: var(--text); border-radius: 4px; padding: 1px 6px; font-size: 11px; white-space: nowrap; }
.chip.auto { background: none; border: 1px dashed var(--muted); color: var(--muted); }
.chip.note { background: #f1f3f5; }
</style>
