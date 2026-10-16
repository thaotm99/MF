import type { Mt5Position } from '../api/mt5-report-parser'
import type { JournalEntry } from '../stores/trade-journal'
import type { AutoTag } from './trade-auto-tags'
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

/** Giá trị bộ lọc nhãn: '' = tất cả, UNTAGGED, tên nhãn của bạn, hoặc AUTO_PREFIX + id nhãn tự động */
export const AUTO_PREFIX = 'auto:'

export function matchesTagFilter(filter: string, manual: string[], auto: AutoTag[]): boolean {
  if (!filter) return true
  if (filter === UNTAGGED) return !manual.length
  if (filter.startsWith(AUTO_PREFIX)) return auto.some((t) => t.id === filter.slice(AUTO_PREFIX.length))
  return manual.includes(filter)
}

/** Thống kê thắng/thua theo nhãn tự động (lệnh nhiều nhãn tính vào mỗi nhãn) */
export function groupByAutoTag(positions: Mt5Position[], tags: Map<string, AutoTag[]>): CategoryStat[] {
  const NONE = 'Không có nhãn tự động'
  const map = new Map<string, CategoryStat>()
  for (const p of positions) {
    const list = tags.get(p.id)
    if (!list) continue
    for (const label of list.length ? list.map((t) => t.label) : [NONE]) {
      const s = map.get(label) ?? { label, count: 0, wins: 0, pnl: 0 }
      s.count++
      if (p.netProfit >= 0) s.wins++
      s.pnl += p.netProfit
      map.set(label, s)
    }
  }
  return [...map.values()].sort((a, b) => Number(a.label === NONE) - Number(b.label === NONE) || b.pnl - a.pnl)
}
