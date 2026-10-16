import type { Mt5Position } from '../api/mt5-report-parser'
import type { JournalEntry } from '../stores/trade-journal'
import type { CategoryStat } from './trade-evaluation-features'

export const UNTAGGED = 'Chưa gắn nhãn'

/**
 * Thống kê thắng/thua theo nhãn người dùng gắn. Một lệnh có nhiều nhãn được tính vào mỗi nhãn
 * (tổng các dòng có thể lớn hơn tổng lệnh).
 */
export function groupByTag(positions: Mt5Position[], entries: Record<string, JournalEntry>): CategoryStat[] {
  const map = new Map<string, CategoryStat>()
  for (const p of positions) {
    const tags = entries[p.id]?.tags.length ? entries[p.id].tags : [UNTAGGED]
    for (const label of tags) {
      const s = map.get(label) ?? { label, count: 0, wins: 0, pnl: 0 }
      s.count++
      if (p.netProfit >= 0) s.wins++
      s.pnl += p.netProfit
      map.set(label, s)
    }
  }
  // Nhãn thật trước, "Chưa gắn nhãn" cuối
  return [...map.values()].sort((a, b) => Number(a.label === UNTAGGED) - Number(b.label === UNTAGGED) || b.pnl - a.pnl)
}
