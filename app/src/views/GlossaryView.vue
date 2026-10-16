<script setup lang="ts">
import { computed, ref } from 'vue'
import GlossaryCandleSketch from '../components/GlossaryCandleSketch.vue'
import { GLOSSARY_SECTIONS } from '../glossary/glossary-sections'

/** Trang Thuật ngữ: giải thích từng cách phân tích / đánh giá, kèm chart minh hoạ (nến vẽ tay, không phải giá thật) */
const q = ref('')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
const sections = computed(() => {
  const k = norm(q.value.trim())
  if (!k) return GLOSSARY_SECTIONS
  return GLOSSARY_SECTIONS.map((s) => ({
    ...s,
    terms: s.terms.filter((t) => norm(`${t.title} ${t.aka ?? ''} ${t.body.join(' ').replace(/<[^>]+>/g, '')}`).includes(k)),
  })).filter((s) => s.terms.length)
})
const count = computed(() => sections.value.reduce((n, s) => n + s.terms.length, 0))
</script>

<template>
  <main class="page">
    <header class="head">
      <h1>Thuật ngữ</h1>
      <p class="desc">Giải thích từng cách phân tích và đánh giá lệnh trong dashboard. Hình minh hoạ là nến vẽ tay, không phải giá thật.</p>
    </header>

    <div class="toolbar">
      <input v-model="q" class="search" type="search" placeholder="Tìm thuật ngữ (ví dụ: sideway, pin bar, MAE)…" aria-label="Tìm thuật ngữ" />
      <nav class="toc" aria-label="Mục lục">
        <a v-for="s in sections" :key="s.id" :href="`#${s.id}`">{{ s.title }}</a>
      </nav>
      <span class="muted">{{ count }} thuật ngữ</span>
    </div>

    <section v-for="s in sections" :id="s.id" :key="s.id" class="section">
      <h2>{{ s.title }}</h2>
      <div class="grid">
        <article v-for="t in s.terms" :id="`term-${t.id}`" :key="t.id" class="card term" :class="{ wide: t.wide || (t.sketches?.length ?? 0) >= 2 }">
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
    <p v-if="!count" class="card empty">Không tìm thấy thuật ngữ nào.</p>
  </main>
</template>

<style scoped>
.page { max-width: 1240px; margin: 0 auto; padding: 24px 24px 48px; }
.head { margin-bottom: 16px; }
h1 { margin: 0 0 4px; font-size: 22px; }
.desc { margin: 0; color: var(--muted); }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-bottom: 8px; position: sticky; top: 0; background: var(--bg); padding: 8px 0; z-index: 1; }
.search { flex: 0 1 320px; min-height: 34px; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font: inherit; background: var(--surface); color: var(--text); }
.toc { display: flex; flex-wrap: wrap; gap: 6px; }
.toc a { font-size: 12px; color: var(--accent); text-decoration: none; border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 3px 10px; }
.muted { color: var(--muted); font-size: 12px; }
.section { scroll-margin-top: 60px; }
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
  .toolbar { position: static; }
  .grid { grid-template-columns: 1fr; }
  .sketches { grid-template-columns: 1fr; }
  .term :deep(.two-tables) { grid-template-columns: 1fr; }
  .term :deep(table.mini) { display: block; overflow-x: auto; }
}
</style>
