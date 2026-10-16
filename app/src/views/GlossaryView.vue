<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import GlossaryCandleSketch from '../components/GlossaryCandleSketch.vue'
import { GLOSSARY_SECTIONS } from '../glossary/glossary-sections'

/**
 * Trang Thuật ngữ: giải thích từng cách phân tích / đánh giá, kèm chart minh hoạ (nến vẽ tay, không phải giá thật).
 * Thanh chọn (mục + "Tất cả thuật ngữ") luôn dính trên đầu khi cuộn → chọn thuật ngữ khác không cần cuộn lên.
 */
const sections = GLOSSARY_SECTIONS
const count = sections.reduce((n, s) => n + s.terms.length, 0)

const bar = ref<HTMLElement | null>(null)
const listOpen = ref(false)
const activeSection = ref(sections[0]?.id ?? '')
const flashId = ref('')
/** Chiều cao thanh menu mobile của App (thanh chọn dính ngay bên dưới) */
const stickyTop = ref(0)

function measure() {
  const mb = document.querySelector<HTMLElement>('.mobile-bar')
  stickyTop.value = mb && getComputedStyle(mb).display !== 'none' ? mb.offsetHeight : 0
}

/** Cuộn tới phần tử, chừa chỗ cho thanh dính; cập nhật #hash để chia sẻ link */
function goTo(id: string, hash: string, behavior: ScrollBehavior = 'smooth') {
  listOpen.value = false
  const el = document.getElementById(id)
  if (!el) return
  const offset = stickyTop.value + (bar.value?.offsetHeight ?? 0) + 8
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior })
  history.replaceState(history.state, '', `#${hash}`)
  if (id.startsWith('term-')) {
    flashId.value = id
    setTimeout(() => flashId.value === id && (flashId.value = ''), 1600)
  }
}
const goSection = (id: string) => goTo(id, id)
const goTerm = (id: string) => goTo(`term-${id}`, `term-${id}`)

/** Mục đang xem = mục cuối cùng có tiêu đề đã cuộn qua thanh dính */
function onScroll() {
  const line = stickyTop.value + (bar.value?.offsetHeight ?? 0) + 20
  let cur = sections[0]?.id ?? ''
  for (const s of sections) {
    const el = document.getElementById(s.id)
    if (el && el.getBoundingClientRect().top <= line) cur = s.id
  }
  activeSection.value = cur
}
/** Đổi #hash khi đang ở trang (link trong trang / sửa URL) */
function onHash() {
  const hash = decodeURIComponent(location.hash.slice(1))
  if (hash && document.getElementById(hash)) setTimeout(() => goTo(hash, hash, 'auto'), 0)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') listOpen.value = false
}
function onDocClick(e: MouseEvent) {
  if (listOpen.value && bar.value && !bar.value.contains(e.target as Node)) listOpen.value = false
}

onMounted(async () => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('keydown', onKey)
  window.addEventListener('hashchange', onHash)
  document.addEventListener('click', onDocClick)
  await nextTick()
  // Mở từ link /glossary#mục hoặc #term-...: chờ hình vẽ xong rồi cuộn
  const hash = decodeURIComponent(location.hash.slice(1))
  // (trình duyệt tự nhảy tới #anchor sau khi tải, đè lên thanh dính → cuộn lại sau đó)
  if (hash && document.getElementById(hash)) {
    for (const ms of [50, 400]) setTimeout(() => goTo(hash, hash, 'auto'), ms)
  }
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('hashchange', onHash)
  document.removeEventListener('click', onDocClick)
})
const activeTitle = computed(() => sections.find((s) => s.id === activeSection.value)?.title ?? '')
</script>

<template>
  <main class="page">
    <header class="head">
      <h1>Thuật ngữ</h1>
      <p class="desc">Giải thích từng cách phân tích và đánh giá lệnh trong dashboard. Hình minh hoạ là nến vẽ tay, không phải giá thật.</p>
    </header>

    <div ref="bar" class="toolbar" :style="{ top: `${stickyTop}px` }">
      <div class="bar-row">
        <button type="button" class="all-btn" :aria-expanded="listOpen" aria-controls="term-list" @click="listOpen = !listOpen">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" /></svg>
          Tất cả thuật ngữ ({{ count }})
        </button>
        <nav class="toc" aria-label="Các mục">
          <button v-for="s in sections" :key="s.id" type="button" :class="{ on: s.id === activeSection }" :aria-current="s.id === activeSection ? 'true' : undefined"
            @click="goSection(s.id)">{{ s.title }}</button>
        </nav>
      </div>
      <div v-if="listOpen" id="term-list" class="term-list card" role="dialog" aria-label="Tất cả thuật ngữ">
        <div v-for="s in sections" :key="s.id" class="group">
          <h4>{{ s.title }}</h4>
          <button v-for="t in s.terms" :key="t.id" type="button" class="term-link" @click="goTerm(t.id)">{{ t.title }}</button>
        </div>
      </div>
    </div>
    <p class="sr-only" aria-live="polite">{{ activeTitle }}</p>

    <section v-for="s in sections" :id="s.id" :key="s.id" class="section">
      <h2>{{ s.title }}</h2>
      <div class="grid">
        <article v-for="t in s.terms" :id="`term-${t.id}`" :key="t.id" class="card term" :class="{ wide: t.wide || (t.sketches?.length ?? 0) >= 2, flash: flashId === `term-${t.id}` }">
          <h3>{{ t.title }} <small v-if="t.aka">{{ t.aka }}</small></h3>
          <div v-if="t.sketches?.length" class="sketches" :style="{ '--cols': t.sketches.length }">
            <GlossaryCandleSketch v-for="(sk, k) in t.sketches" :key="k" :sketch="sk" />
          </div>
          <!-- Nội dung tĩnh trong mã nguồn (không phải dữ liệu người dùng) -->
          <div v-for="(b, k) in t.body" :key="k" class="para" v-html="b" />
          <p v-if="t.id === 'session'" class="sessions" aria-label="Các phiên theo giờ UTC">
            <span style="--w: 7">Á 0–7h</span><span style="--w: 5">Âu 7–12h</span><span style="--w: 4" class="hot">Âu–Mỹ 12–16h</span><span style="--w: 5">Mỹ 16–21h</span><span style="--w: 3">21–24h</span>
          </p>
          <p v-if="t.usedIn" class="used">Dùng ở: {{ t.usedIn }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1240px; margin: 0 auto; padding: 24px 24px 48px; }
.head { margin-bottom: 16px; }
h1 { margin: 0 0 4px; font-size: 22px; }
.desc { margin: 0; color: var(--muted); }
/* Thanh chọn dính trên đầu khi cuộn (mobile: ngay dưới thanh menu của App) */
.toolbar { position: sticky; z-index: 20; background: var(--bg); padding: 8px 0; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
.bar-row { display: flex; align-items: center; gap: 10px; }
.all-btn { flex: none; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 6px; padding: 6px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.toc { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; min-width: 0; }
.toc::-webkit-scrollbar { display: none; }
.toc button { flex: none; font: inherit; font-size: 12px; color: var(--accent); border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 4px 10px; cursor: pointer; white-space: nowrap; }
.toc button.on { background: #e8f0ff; border-color: var(--accent); font-weight: 600; }
.term-list { position: absolute; left: 0; right: 0; top: calc(100% + 4px); max-height: min(70vh, 560px); overflow-y: auto; border: 1px solid var(--border);
  padding: 12px 14px; box-shadow: 0 8px 24px rgba(20, 29, 34, .14); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 20px; }
.group h4 { margin: 0 0 4px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .02em; }
.term-link { display: block; width: 100%; text-align: left; border: 0; background: none; font: inherit; font-size: 13px; color: var(--text); padding: 5px 6px; border-radius: 4px; cursor: pointer; }
.term-link:hover, .term-link:focus-visible { background: var(--bg); color: var(--accent); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.term.flash { outline: 2px solid var(--accent); outline-offset: 2px; transition: outline-color .3s; }
h2 { font-size: 16px; margin: 22px 0 10px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.term { border: 1px solid var(--border); padding: 14px 16px; }
.term.wide { grid-column: 1 / -1; }
h3 { margin: 0 0 10px; font-size: 14px; }
h3 small { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 6px; }
.sketches { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
.term p, .term .para { margin: 6px 0; font-size: 13px; line-height: 1.55; }
.term :deep(table.mini) { border-collapse: collapse; font-size: 12px; margin: 8px 0; width: 100%; }
.term :deep(table.mini th), .term :deep(table.mini td) { border: 1px solid var(--border); padding: 4px 8px; text-align: left; vertical-align: top; }
.term :deep(table.mini thead th) { background: var(--bg); font-weight: 600; }
.term :deep(.two-tables) { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.term :deep(ol.steps) { margin: 6px 0; padding-left: 20px; font-size: 13px; line-height: 1.55; }
.term :deep(ol.steps li) { margin: 3px 0; }
.term :deep(code) { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
.used { color: var(--faint); font-size: 12px !important; }
.sessions { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
.sessions span { flex: var(--w); font-size: 11px; text-align: center; padding: 6px 2px; background: var(--bg); border-right: 1px solid var(--border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sessions span:last-child { border-right: 0; }
.sessions .hot { background: #e8f0ff; font-weight: 600; }
.empty { padding: 20px; text-align: center; color: var(--muted); }
@media (max-width: 860px) {
  .page { padding: 16px 16px 40px; }
  .term-list { grid-template-columns: 1fr; max-height: 65vh; }
  .all-btn { padding: 6px 10px; }
  .grid { grid-template-columns: 1fr; }
  .sketches { grid-template-columns: 1fr; }
  .term :deep(.two-tables) { grid-template-columns: 1fr; }
  .term :deep(table.mini) { display: block; overflow-x: auto; }
}
</style>
