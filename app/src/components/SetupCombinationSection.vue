<script setup lang="ts">
import { computed, ref } from 'vue'
import { money } from '../utils/format'
import { findSetupCombinations, type ComboResult, type Stat } from '../utils/setup-combination-finder'
import type { EvaluationOptions, TradeEvaluation } from '../utils/trade-evaluation'
import { EVALUATION_FEATURES } from '../utils/trade-evaluation-features'

/** Tổ hợp 2–3 điều kiện lúc vào lệnh tốt nhất / tệ nhất, kèm kết quả trên giai đoạn kiểm tra */
const props = defineProps<{ evals: TradeEvaluation[]; options: EvaluationOptions; currency: string }>()

const minCount = ref(15)
const TRAIN_RATIO = 0.7
const result = computed(() =>
  findSetupCombinations(props.evals, EVALUATION_FEATURES, props.options, { minCount: minCount.value, trainRatio: TRAIN_RATIO, topN: 8 }),
)

const wr = (s: Stat) => (s.count ? `${Math.round((s.wins / s.count) * 100)}%` : '—')
const m = (v: number) => money(v, { sign: true })
/** Tổ hợp có lặp lại ở giai đoạn kiểm tra không (cùng dấu lãi/lỗ, đủ ≥ 5 lệnh) */
function verdict(r: ComboResult, kind: 'best' | 'worst') {
  if (r.test.count < 5) return { text: 'Ít lệnh kiểm tra', cls: 'muted' }
  const holds = kind === 'best' ? r.test.pnl > 0 : r.test.pnl < 0
  return holds ? { text: 'Lặp lại ✓', cls: kind === 'best' ? 'pos' : 'neg' } : { text: 'Không lặp lại', cls: 'muted' }
}
const fmtDate = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')
</script>

<template>
  <section class="combo">
    <div class="head">
      <h2>Tổ hợp setup</h2>
      <label>Tối thiểu
        <select v-model.number="minCount" class="select small"><option v-for="n in [10, 15, 20, 30]" :key="n" :value="n">{{ n }} lệnh</option></select>
      </label>
      <span class="muted">
        Tìm trên 70% lệnh đầu (đến {{ fmtDate(result.splitTime) }}), kiểm tra trên 30% sau.
        Toàn bộ: train {{ result.baseline.train.count }} lệnh · thắng {{ wr(result.baseline.train) }} · {{ m(result.baseline.train.pnl) }} —
        kiểm tra {{ result.baseline.test.count }} lệnh · thắng {{ wr(result.baseline.test) }} · {{ m(result.baseline.test.pnl) }} {{ currency }}
      </span>
    </div>

    <div v-for="block in ([['worst', 'Setup xấu nhất — nên cân nhắc chặn'], ['best', 'Setup tốt nhất — nên ưu tiên']] as const)" :key="block[0]" class="card block">
      <h3>{{ block[1] }}</h3>
      <table v-if="result[block[0]].length">
        <thead>
          <tr>
            <th>Điều kiện</th>
            <th class="r">Lệnh</th><th class="r">Thắng</th><th class="r">Lãi/Lỗ</th>
            <th class="r sep">Kiểm tra: lệnh</th><th class="r">Thắng</th><th class="r">Lãi/Lỗ</th><th>Kết luận</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in result[block[0]]" :key="r.key">
            <td class="cond">
              <span v-for="c in r.conditions" :key="c.feature" class="chip" :title="c.feature">{{ c.label }}</span>
            </td>
            <td class="r num">{{ r.train.count }}</td>
            <td class="r num">{{ wr(r.train) }}</td>
            <td class="r num" :class="r.train.pnl >= 0 ? 'pos' : 'neg'">{{ m(r.train.pnl) }}</td>
            <td class="r num sep">{{ r.test.count }}</td>
            <td class="r num">{{ wr(r.test) }}</td>
            <td class="r num" :class="r.test.pnl >= 0 ? 'pos' : 'neg'">{{ r.test.count ? m(r.test.pnl) : '—' }}</td>
            <td :class="verdict(r, block[0]).cls">{{ verdict(r, block[0]).text }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Không có tổ hợp nào đủ {{ minCount }} lệnh.</p>
    </div>
    <p class="foot">
      Mỗi tổ hợp ghép 2–3 yếu tố lúc vào lệnh (không dùng yếu tố "trước khi đóng" vì bot không biết trước). "Lặp lại ✓" = ở giai đoạn
      kiểm tra tổ hợp vẫn lãi (setup tốt) / vẫn lỗ (setup xấu) với ≥ 5 lệnh — chỉ những tổ hợp này mới nên đưa vào điều kiện của EA.
    </p>
  </section>
</template>

<style scoped>
.combo { margin-top: 22px; }
.head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; font-size: 13px; }
h2 { font-size: 14px; font-weight: 600; margin: 0; }
label { display: flex; align-items: center; gap: 6px; color: var(--muted); }
.select.small { min-height: 32px; padding: 4px 8px; }
.muted { color: var(--muted); font-size: 12px; }
.block { border: 1px solid var(--border); padding: 12px 14px; margin-bottom: 12px; overflow-x: auto; }
h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; color: var(--muted); font-weight: 500; padding: 5px 6px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td { padding: 6px; border-bottom: 1px solid var(--border); white-space: nowrap; }
td.cond { white-space: normal; min-width: 320px; }
.chip { display: inline-block; background: #f1f3f5; border-radius: 4px; padding: 2px 6px; margin: 1px 4px 1px 0; }
.sep { border-left: 1px solid var(--border); }
.r { text-align: right; }
.num { font-variant-numeric: tabular-nums; }
.empty { color: var(--muted); text-align: center; padding: 14px 0; margin: 0; font-size: 12px; }
.foot { color: var(--faint); font-size: 11px; margin: 4px 0 0; text-align: center; }
</style>
