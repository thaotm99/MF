<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { AccountClient } from '../api/client'
import type { AccountEntry, ApiKeyEntry } from '../api/types'
import KeyForm from '../components/KeyForm.vue'
import { ACCOUNTS_FILE, newId, useSettingsStore } from '../stores/settings'
import { money } from '../utils/format'

const settings = useSettingsStore()
const NEW_KEY = '__new__'

// ---------- Tài khoản ----------

interface AccountDraft {
  id: string | null // null = thêm mới
  label: string
  /** Khi thêm mới có thể nhập nhiều ID, cách nhau bởi dấu phẩy / khoảng trắng / xuống dòng */
  accountIds: string
  keyId: string
  resolveAccessPoint: boolean
}

const accountDraft = ref<AccountDraft | null>(null)
const accountError = ref('')
const notice = ref('')

function startAddAccount() {
  accountDraft.value = {
    id: null,
    label: '',
    accountIds: '',
    keyId: settings.allKeys[0]?.id ?? NEW_KEY,
    resolveAccessPoint: true,
  }
  accountError.value = ''
  notice.value = ''
}

function startEditAccount(a: AccountEntry) {
  accountDraft.value = { id: a.id, label: a.label, accountIds: a.accountId, keyId: a.keyId, resolveAccessPoint: a.resolveAccessPoint }
  accountError.value = ''
  notice.value = ''
}

const draftIds = computed(() =>
  [...new Set((accountDraft.value?.accountIds ?? '').split(/[\s,;]+/).filter(Boolean))],
)

function saveAccount() {
  const d = accountDraft.value
  if (!d) return
  const ids = draftIds.value
  if (!ids.length) return (accountError.value = 'Cần nhập Account ID.')
  const bad = ids.filter((x) => !/^\d{1,20}$/.test(x))
  if (bad.length) return (accountError.value = `Account ID phải là số: ${bad.join(', ')}`)
  if (d.keyId === NEW_KEY || !settings.allKeys.some((k) => k.id === d.keyId)) {
    return (accountError.value = 'Hãy chọn hoặc thêm API key.')
  }

  if (d.id) {
    if (ids.length > 1) return (accountError.value = 'Khi sửa chỉ nhập một Account ID.')
    const dup = settings.allAccounts.find((a) => a.accountId === ids[0] && a.id !== d.id)
    if (dup) return (accountError.value = `Tài khoản #${ids[0]} đã có trong danh sách.`)
    settings.upsertAccount({
      id: d.id,
      label: d.label.trim() || `#${ids[0]}`,
      accountId: ids[0],
      keyId: d.keyId,
      resolveAccessPoint: d.resolveAccessPoint,
    })
    delete tests[d.id]
  } else {
    const existing = new Set(settings.allAccounts.map((a) => a.accountId))
    const added: string[] = []
    const skipped: string[] = []
    for (const id of ids) {
      if (existing.has(id)) {
        skipped.push(id)
        continue
      }
      const entry: AccountEntry = {
        id: newId(),
        label: ids.length === 1 && d.label.trim() ? d.label.trim() : `#${id}`,
        accountId: id,
        keyId: d.keyId,
        resolveAccessPoint: d.resolveAccessPoint,
      }
      settings.upsertAccount(entry)
      added.push(id)
      void test(entry)
    }
    notice.value = [
      added.length ? `Đã thêm ${added.length} tài khoản.` : '',
      skipped.length ? `Bỏ qua (đã có): ${skipped.map((x) => '#' + x).join(', ')}.` : '',
    ].filter(Boolean).join(' ')
  }
  accountDraft.value = null
}

function removeAccount(a: AccountEntry) {
  if (confirm(`Xoá tài khoản ${a.label} (#${a.accountId}) khỏi dashboard?`)) {
    settings.removeAccount(a.id)
    delete tests[a.id]
  }
}

// ---------- Kiểm tra kết nối ----------

type TestResult =
  | { status: 'loading' }
  | { status: 'ok'; name?: string; currency?: string; leverage?: string; equity?: string; balance?: string }
  | { status: 'error'; message: string }

const tests = reactive<Record<string, TestResult>>({})

async function test(a: AccountEntry) {
  const cred = settings.credentials.find((c) => c.id === a.id)
  if (!cred) return (tests[a.id] = { status: 'error', message: 'Tài khoản chưa có API key hợp lệ.' })
  tests[a.id] = { status: 'loading' }
  try {
    const client = new AccountClient({ ...cred }, settings.mode)
    await client.init()
    const details = await client.getAccount()
    const snap = await client.getSnapshot()
    tests[a.id] = {
      status: 'ok',
      name: details.account_name,
      currency: details.settings?.currency,
      leverage: details.settings?.leverage,
      equity: snap.account_state.equity,
      balance: snap.account_state.balance,
    }
  } catch (e) {
    tests[a.id] = { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

function testAll() {
  // Tuần tự để không dồn request khi nhiều tài khoản dùng chung một key
  settings.allAccounts.reduce<Promise<unknown>>((p, a) => p.then(() => test(a)), Promise.resolve())
}

function statusView(t: TestResult): { cls: string; text: string } {
  if (t.status === 'loading') return { cls: 'muted', text: 'Đang kiểm tra…' }
  if (t.status === 'error') return { cls: 'neg', text: `✗ ${t.message}` }
  const parts = [t.name, t.currency, t.leverage, t.equity !== undefined ? `Equity ${money(Number(t.equity))}` : '']
  return { cls: 'pos', text: `✓ ${parts.filter(Boolean).join(' · ')}` }
}

const keyName = (id: string) => settings.allKeys.find((k) => k.id === id)?.name ?? '— chưa có key —'

async function reloadFile() {
  await settings.loadAccountsFile()
  for (const id of Object.keys(tests)) if (id.startsWith('file:')) delete tests[id]
}

// ---------- API key ----------

/** null = đóng; 'new' = thêm; ApiKeyEntry = sửa */
const keyEditing = ref<ApiKeyEntry | 'new' | null>(null)
/** Đang thêm key ngay trong form tài khoản */
const inlineKey = computed(() => accountDraft.value?.keyId === NEW_KEY)

function saveKey(k: ApiKeyEntry) {
  settings.upsertKey(k)
  keyEditing.value = null
  // Kết quả kiểm tra cũ của các tài khoản dùng key này không còn đúng
  for (const a of settings.accountsUsingKey(k.id)) delete tests[a.id]
}

function saveInlineKey(k: ApiKeyEntry) {
  settings.upsertKey(k)
  if (accountDraft.value) accountDraft.value.keyId = k.id
}

function cancelInlineKey() {
  if (accountDraft.value) accountDraft.value.keyId = settings.allKeys[0]?.id ?? NEW_KEY
  if (!settings.allKeys.length) accountDraft.value = null
}

function removeKey(k: ApiKeyEntry) {
  const used = settings.accountsUsingKey(k.id)
  if (used.length) return
  if (confirm(`Xoá key "${k.name}"?`)) settings.removeKey(k.id)
}

const mask = (s: string) => (s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s)
</script>

<template>
  <main class="page">
    <header class="top">
      <h1>Quản lý tài khoản</h1>
    </header>

    <p class="alert">
      API Key và Secret Key được lưu trong <b>localStorage</b> của trình duyệt này và dùng để ký request ngay trên
      trình duyệt. Chỉ dùng trên máy cá nhân; nên tạo key chỉ có quyền đọc và giới hạn IP trong Key Management.
      Một key có thể dùng chung cho nhiều tài khoản nếu khi tạo key bạn đã chọn các tài khoản đó.
    </p>

    <!-- Tài khoản -->
    <section class="card block">
      <div class="block-head">
        <h2>Tài khoản <span class="count">{{ settings.allAccounts.length }}</span></h2>
        <div class="actions">
          <button v-if="settings.allAccounts.length" class="btn" @click="testAll">Kiểm tra tất cả</button>
          <button v-if="!accountDraft" class="btn btn-primary" @click="startAddAccount">+ Thêm tài khoản</button>
        </div>
      </div>

      <div class="file-box">
        <div class="file-info">
          <b>Danh sách từ file</b> <code>public{{ ACCOUNTS_FILE }}</code>&nbsp;
          <span v-if="settings.fileStatus.state === 'loading'" class="muted">· đang đọc…</span>
          <span v-else-if="settings.fileStatus.state === 'ok'" class="pos">· {{ settings.fileStatus.count }} tài khoản</span>
          <span v-else-if="settings.fileStatus.state === 'missing'" class="muted">· chưa có file</span>
          <span v-else-if="settings.fileStatus.state === 'error'" class="neg">· {{ settings.fileStatus.message }}</span>
          <span v-if="settings.fileStatus.state === 'ok' && settings.fileStatus.message" class="muted">
            ({{ settings.fileStatus.message }})
          </span>
        </div>
        <div class="file-actions">
          <label class="inline">
            Key dùng cho file
            <select v-model="settings.fileKeyId" class="select small-select">
              <option :value="null" disabled>— chọn key —</option>
              <option v-for="k in settings.allKeys" :key="k.id" :value="k.id">{{ k.name }}</option>
            </select>
          </label>
          <button class="btn" @click="reloadFile">Tải lại file</button>
        </div>
      </div>

      <p v-if="notice" class="alert ok">{{ notice }}</p>

      <div v-if="accountDraft" class="panel">
        <h3>{{ accountDraft.id ? 'Sửa tài khoản' : 'Thêm tài khoản' }}</h3>
        <form class="form" @submit.prevent="saveAccount">
          <label>
            API key
            <select v-model="accountDraft.keyId" class="select">
              <option v-for="k in settings.allKeys" :key="k.id" :value="k.id">{{ k.name }} ({{ mask(k.apiKey) }})</option>
              <option :value="NEW_KEY">+ Thêm key mới…</option>
            </select>
          </label>

          <div v-if="inlineKey" class="nested">
            <h4>Key mới</h4>
            <KeyForm @save="saveInlineKey" @cancel="cancelInlineKey" />
          </div>

          <template v-else>
            <label>
              {{ accountDraft.id ? 'Account ID' : 'Account ID (có thể nhập nhiều, cách nhau bằng dấu phẩy)' }}
              <textarea v-if="!accountDraft.id" v-model="accountDraft.accountIds" rows="2" inputmode="numeric"
                placeholder="123456789, 987654321" />
              <input v-else v-model="accountDraft.accountIds" inputmode="numeric" />
            </label>
            <label v-if="draftIds.length <= 1">
              Tên hiển thị
              <input v-model="accountDraft.label" placeholder="Ví dụ: Standard chính" />
            </label>
            <p v-else class="muted small">Sẽ thêm {{ draftIds.length }} tài khoản, tên mặc định theo Account ID (có thể sửa sau).</p>
            <label class="check">
              <input v-model="accountDraft.resolveAccessPoint" type="checkbox" />
              Tự tìm access point của tài khoản (<code>GET /v1/trading/access-point</code>)
            </label>
            <p v-if="accountError" class="alert error">{{ accountError }}</p>
            <div class="actions">
              <button type="button" class="btn" @click="accountDraft = null">Huỷ</button>
              <button type="submit" class="btn btn-primary">{{ accountDraft.id ? 'Lưu' : 'Thêm' }}</button>
            </div>
          </template>
        </form>
      </div>

      <div v-if="settings.allAccounts.length" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Account ID</th>
              <th>API key</th>
              <th>Kết nối</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in settings.allAccounts" :key="a.id">
              <td>
                <b>{{ a.label }}</b>
                <span v-if="a.source === 'file'" class="badge" title="Sửa trong file JSON">từ file</span>
              </td>
              <td>#{{ a.accountId }}</td>
              <td>{{ keyName(a.keyId) }}</td>
              <td class="status">
                <button v-if="!tests[a.id]" class="link-btn" @click="test(a)">Kiểm tra</button>
                <span v-else :class="statusView(tests[a.id]).cls" :title="statusView(tests[a.id]).text">
                  {{ statusView(tests[a.id]).text }}
                </span>
              </td>
              <td>
                <div v-if="a.source !== 'file'" class="row-actions">
                  <button class="btn" @click="startEditAccount(a)">Sửa</button>
                  <button class="btn btn-danger" @click="removeAccount(a)">Xoá</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!accountDraft" class="empty">Chưa có tài khoản nào.</p>
    </section>

    <!-- API key -->
    <section class="card block">
      <div class="block-head">
        <h2>API key <span class="count">{{ settings.allKeys.length }}</span></h2>
        <button v-if="!keyEditing" class="btn" @click="keyEditing = 'new'">+ Thêm key</button>
      </div>

      <div v-if="keyEditing" class="panel">
        <h3>{{ keyEditing === 'new' ? 'Thêm key' : 'Sửa key' }}</h3>
        <KeyForm :key="keyEditing === 'new' ? 'new' : keyEditing.id" :initial="keyEditing === 'new' ? undefined : keyEditing"
          @save="saveKey" @cancel="keyEditing = null" />
      </div>

      <div v-if="settings.allKeys.length" class="keys">
        <div v-for="k in settings.allKeys" :key="k.id" class="key">
          <div>
            <b>{{ k.name }}</b>
            <span v-if="k.serverSigned" class="badge" title="Đọc từ app/.env; dev server ký request, Secret Key không xuống trình duyệt">
              .env · ký ở dev server
            </span>
            <div class="muted small"><code>{{ mask(k.apiKey) }}</code> · {{ k.host }}</div>
            <div class="muted small">Dùng cho {{ settings.accountsUsingKey(k.id).length }} tài khoản</div>
          </div>
          <div v-if="!k.serverSigned" class="row-actions">
            <button class="btn" @click="keyEditing = k">Sửa</button>
            <button class="btn btn-danger" :disabled="settings.accountsUsingKey(k.id).length > 0"
              :title="settings.accountsUsingKey(k.id).length ? 'Đang có tài khoản dùng key này' : ''"
              @click="removeKey(k)">Xoá</button>
          </div>
          <span v-else class="muted small">Sửa trong file .env rồi chạy lại npm run dev</span>
        </div>
      </div>
      <p v-if="settings.envKeyError" class="alert error">Key trong .env không hợp lệ: {{ settings.envKeyError }}</p>
      <p v-else-if="!keyEditing && !settings.allKeys.length" class="empty">Chưa có key. Key cũng có thể được thêm ngay khi thêm tài khoản.</p>
    </section>

    <!-- Cài đặt -->
    <section class="card block">
      <h2>Cài đặt</h2>
      <div class="settings">
        <div>
          <h3>Kết nối</h3>
          <label class="check">
            <input v-model="settings.mode" type="radio" value="direct" /> Gọi trực tiếp API Exness (hiện bị Exness chặn CORS)
          </label>
          <label class="check">
            <input v-model="settings.mode" type="radio" value="proxy" /> Qua proxy dev (Vite) — khuyên dùng
          </label>
        </div>
        <div>
          <h3>Múi giờ cho lịch PnL</h3>
          <label class="check"><input v-model="settings.timeZone" type="radio" value="utc" /> Giờ nền tảng (UTC+0)</label>
          <label class="check"><input v-model="settings.timeZone" type="radio" value="local" /> Giờ máy của bạn</label>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 24px 16px 48px; }
.top { margin-bottom: 8px; }
h1 { font-size: 32px; font-weight: 600; margin: 0; }
h2 { font-size: 17px; margin: 0; }
h3 { font-size: 14px; margin: 0 0 10px; }
h4 { font-size: 13px; margin: 0 0 8px; }
.block { padding: 20px 24px; margin-top: 16px; }
.block-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.count { background: #eceef0; color: var(--muted); font-size: 12px; border-radius: 999px; padding: 1px 8px; margin-left: 4px; vertical-align: middle; }
.actions, .row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.panel { border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px; max-width: 640px; background: #fbfbfc; }
.nested { border-left: 3px solid var(--accent); padding-left: 12px; }
.form { display: grid; gap: 10px; }
.form > label, .form label:not(.check) { display: grid; gap: 4px; color: var(--muted); font-size: 13px; }
.form input:not([type]), .form textarea {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text); font-size: 14px; background: #fff;
}
label.check { display: flex; gap: 8px; align-items: center; color: var(--text); font-size: 13px; margin: 4px 0; }
code { font-size: 12px; word-break: break-all; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.alert.ok { background: var(--pos-bg); color: #17663a; border-color: #bfe3cb; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 8px; border-bottom: 1px solid var(--border); }
td { padding: 10px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td.status { white-space: normal; min-width: 220px; max-width: 420px; }
.file-box {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  border: 1px dashed var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 13px;
}
.file-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
label.inline { display: flex; gap: 8px; align-items: center; color: var(--muted); }
.small-select { min-height: 34px; padding: 5px 8px; }
.badge { background: #eef3ff; color: var(--accent); font-size: 11px; border-radius: 4px; padding: 1px 6px; margin-left: 6px; }
.link-btn { border: 0; background: none; color: var(--accent); padding: 0; }
.keys { display: grid; gap: 8px; }
.key {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px; border: 1px solid var(--border); border-radius: 8px;
}
.empty { color: var(--muted); text-align: center; padding: 20px 0; margin: 0; }
.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 12px; }
@media (max-width: 520px) { h1 { font-size: 24px; } .block { padding: 16px; } }
</style>
