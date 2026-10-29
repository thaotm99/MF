<script setup lang="ts">
import { ref } from 'vue'

/**
 * Nút chọn / kéo-thả file để nạp vào trình duyệt (bản deploy không có dev server) + danh sách file đã nạp có nút xoá.
 * File chỉ lưu trong trình duyệt này (IndexedDB), không gửi lên server.
 */
const props = defineProps<{
  accept: string
  label: string
  files: { name: string; size: number }[]
  onImport: (files: File[]) => Promise<void>
  onRemove: (name: string) => Promise<void>
}>()

const busy = ref(false)
const error = ref('')
const over = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function take(list: FileList | null | undefined) {
  if (!list?.length) return
  busy.value = true
  error.value = ''
  try {
    await props.onImport([...list])
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  busy.value = false
  if (input.value) input.value.value = ''
}
async function remove(name: string) {
  if (!confirm(`Xoá ${name} khỏi trình duyệt này?`)) return
  await props.onRemove(name)
}
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
</script>

<template>
  <div class="import">
    <label class="drop" :class="{ over, busy }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="over = false; take($event.dataTransfer?.files)">
      <input ref="input" type="file" multiple :accept="accept" :disabled="busy" @change="take(($event.target as HTMLInputElement).files)" />
      <span class="btn">{{ busy ? 'Đang nạp…' : label }}</span>
      <span class="muted small">hoặc kéo-thả file vào đây · chỉ lưu trong trình duyệt này</span>
    </label>
    <p v-if="error" class="alert error">{{ error }}</p>
    <ul v-if="files.length" class="list">
      <li v-for="f in files" :key="f.name">
        <span class="name">{{ f.name }}</span><span class="muted small">{{ kb(f.size) }}</span>
        <button type="button" class="link" :aria-label="`Xoá ${f.name}`" @click="remove(f.name)">Xoá</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.import { margin-top: 10px; }
.drop { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border: 1.5px dashed var(--border); border-radius: 8px; padding: 12px 14px; cursor: pointer; }
.drop.over { border-color: var(--accent); background: #eef4ff; }
.drop.busy { opacity: .6; }
.drop input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.drop:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.list { list-style: none; margin: 8px 0 0; padding: 0; font-size: 13px; }
.list li { display: flex; gap: 10px; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border); }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { border: 0; background: none; color: var(--neg); font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
</style>
