<script setup lang="ts">
import { computed, ref } from 'vue'
import { derivePublicKey } from '../api/signing'
import type { ApiKeyEntry } from '../api/types'
import { newId } from '../stores/settings'

const props = defineProps<{ initial?: ApiKeyEntry }>()
const emit = defineEmits<{ save: [key: ApiKeyEntry]; cancel: [] }>()

const form = ref<ApiKeyEntry>(
  props.initial ? { ...props.initial } : { id: newId(), name: '', apiKey: '', secretKey: '', host: 'https://api.exness.com' },
)
const error = ref('')

const publicKey = computed(() => {
  if (!form.value.secretKey.trim()) return ''
  try {
    return derivePublicKey(form.value.secretKey)
  } catch {
    return ''
  }
})

function submit() {
  const f = form.value
  if (!f.apiKey.trim()) return (error.value = 'Cần nhập API Key.')
  if (!f.host.trim()) return (error.value = 'Cần nhập host.')
  try {
    derivePublicKey(f.secretKey)
  } catch (e) {
    return (error.value = e instanceof Error ? e.message : String(e))
  }
  emit('save', {
    ...f,
    name: f.name.trim() || `Key ${f.apiKey.trim().slice(-6)}`,
    apiKey: f.apiKey.trim(),
    secretKey: f.secretKey.trim(),
    host: f.host.trim(),
  })
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <label>Tên key <input v-model="form.name" placeholder="Ví dụ: Key đọc dữ liệu" /></label>
    <label>API Key <input v-model="form.apiKey" placeholder="exnsk_..." autocomplete="off" /></label>
    <label>
      Secret Key (Ed25519)
      <textarea v-model="form.secretKey" rows="3" autocomplete="off" spellcheck="false"
        placeholder="PEM, hex hoặc base64 — lấy từ Key Management" />
      <small v-if="publicKey" class="muted">Public key suy ra: <code>{{ publicKey }}</code></small>
    </label>
    <label>Host (DNS widget) <input v-model="form.host" placeholder="https://api.exness.com" /></label>
    <p v-if="error" class="alert error">{{ error }}</p>
    <div class="actions">
      <button type="button" class="btn" @click="emit('cancel')">Huỷ</button>
      <button type="submit" class="btn btn-primary">Lưu key</button>
    </div>
  </form>
</template>

<style scoped>
.form { display: grid; gap: 10px; }
label { display: grid; gap: 4px; color: var(--muted); font-size: 13px; }
input, textarea { border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text); font-size: 14px; }
textarea { font-family: ui-monospace, monospace; resize: vertical; }
code { font-size: 12px; word-break: break-all; }
.muted { color: var(--muted); }
.actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
