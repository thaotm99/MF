<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Mt5Position } from '../api/mt5-report-parser'
import { useTradeJournalStore } from '../stores/trade-journal'
import type { AutoTag } from '../utils/trade-auto-tags'

/** Gắn nhãn + ghi chú cho một lệnh (lưu vào app/journal/trade-journal.json) */
const props = defineProps<{ position: Mt5Position; compact?: boolean; autoTags?: AutoTag[] }>()
const journal = useTradeJournalStore()
onMounted(() => void journal.ensureLoaded())

const entry = computed(() => journal.entries[props.position.id])
const newTag = ref('')
function addTag() {
  const t = newTag.value.trim().slice(0, 40)
  if (t && !entry.value?.tags.includes(t)) journal.toggleTag(props.position.id, t)
  newTag.value = ''
}
const savingText = computed(() =>
  ({ idle: '', saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Lưu thất bại' })[journal.saving],
)
</script>

<template>
  <div class="journal" :class="{ compact }">
    <ul v-if="autoTags" class="auto" aria-label="Nhãn tự động">
      <li v-if="!autoTags.length" class="muted">Nhãn tự động: không có (hoặc thiếu nến)</li>
      <li v-for="t in autoTags" :key="t.id"><span class="chip-auto">{{ t.label }}</span> <span class="why">{{ t.reason }}</span></li>
    </ul>
    <p v-if="journal.state === 'unavailable'" class="muted">Nhật ký chỉ lưu được khi chạy <code>npm run dev</code> trên máy này.</p>
    <template v-else>
      <div class="tags" role="group" aria-label="Nhãn lệnh">
        <button v-for="t in journal.allTags" :key="t" type="button" class="tag" :class="{ on: entry?.tags.includes(t) }"
          :aria-pressed="!!entry?.tags.includes(t)" @click="journal.toggleTag(position.id, t)">{{ t }}</button>
        <input v-model="newTag" class="new-tag" maxlength="40" placeholder="+ nhãn mới" aria-label="Thêm nhãn mới" @keydown.enter.prevent="addTag" />
      </div>
      <textarea :value="entry?.note ?? ''" rows="2" maxlength="4000" placeholder="Ghi chú cho lệnh này…" aria-label="Ghi chú lệnh"
        @input="journal.set(position.id, { note: ($event.target as HTMLTextAreaElement).value })" />
      <span class="status" :class="{ neg: journal.saving === 'error' }">{{ savingText }}</span>
    </template>
  </div>
</template>

<style scoped>
.journal { display: flex; flex-direction: column; gap: 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag { border: 1px solid var(--border); background: var(--surface); color: var(--muted); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.tag.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.new-tag { border: 1px dashed var(--border); border-radius: 999px; padding: 3px 10px; font-size: 12px; width: 110px; background: var(--surface); color: var(--text); }
textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; font-size: 13px; resize: vertical; background: var(--surface); color: var(--text); }
.compact textarea { font-size: 12px; }
.status { font-size: 11px; color: var(--faint); min-height: 14px; }
.muted { color: var(--muted); font-size: 12px; margin: 0; }
.auto { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; }
.chip-auto { border: 1px dashed var(--muted); border-radius: 4px; padding: 1px 6px; font-size: 11px; }
.why { color: var(--muted); }
</style>
