<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { renderMarkdown } from '../utils/simple-markdown'

/** Hiển thị câu trả lời AI (Markdown an toàn); bấm #ticket → mở lệnh trên Chart giá */
const props = defineProps<{ markdown: string }>()
const router = useRouter()
const html = computed(() => renderMarkdown(props.markdown))

function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-trade]')
  if (!a || e.metaKey || e.ctrlKey) return
  e.preventDefault()
  void router.push({ path: '/chart', query: { trade: a.dataset.trade, tf: 'M5' } })
}
</script>

<template>
  <!-- Markdown đã escape toàn bộ, chỉ tạo lại vài thẻ định dạng + link ticket (simple-markdown.ts) -->
  <div class="md" @click="onClick" v-html="html" />
</template>

<style scoped>
.md { font-size: 13px; line-height: 1.55; }
.md :deep(h2), .md :deep(h3), .md :deep(h4) { font-size: 13px; margin: 14px 0 4px; }
.md :deep(h3:first-child), .md :deep(h2:first-child) { margin-top: 4px; }
.md :deep(p) { margin: 4px 0; }
.md :deep(ul), .md :deep(ol) { margin: 4px 0; padding-left: 20px; }
.md :deep(li) { margin: 2px 0; }
.md :deep(code) { background: var(--bg); padding: 1px 4px; border-radius: 4px; font-size: 12px; }
.md :deep(pre) { background: var(--bg); padding: 8px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
.md :deep(a[data-trade]) { color: var(--accent); text-decoration: none; font-variant-numeric: tabular-nums; }
.md :deep(a[data-trade]:hover) { text-decoration: underline; }
</style>
