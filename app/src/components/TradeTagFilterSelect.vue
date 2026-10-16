<script setup lang="ts">
import { useTradeJournalStore } from '../stores/trade-journal'
import { AUTO_TAG_RULES } from '../utils/trade-auto-tags'
import { AUTO_PREFIX, UNTAGGED } from '../utils/trade-journal-stats'

/** Chọn lọc theo nhãn: nhãn của bạn + nhãn tự động (giá trị xem matchesTagFilter) */
const model = defineModel<string>({ required: true })
const journal = useTradeJournalStore()
</script>

<template>
  <select v-model="model" class="select small" aria-label="Lọc theo nhãn">
    <option value="">Mọi nhãn</option>
    <optgroup label="Nhãn tự động">
      <option v-for="r in AUTO_TAG_RULES" :key="r.id" :value="AUTO_PREFIX + r.id">{{ r.label }}</option>
    </optgroup>
    <optgroup label="Nhãn của bạn">
      <option v-for="t in journal.allTags" :key="t" :value="t">{{ t }}</option>
      <option :value="UNTAGGED">{{ UNTAGGED }}</option>
    </optgroup>
  </select>
</template>

<style scoped>
.select.small { min-height: 30px; padding: 3px 8px; font-size: 12px; }
</style>
