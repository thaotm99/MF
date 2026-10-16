import type { Mt5Position } from '../api/mt5-report-parser'
import type { TimeZoneMode } from '../stores/settings'

/**
 * Cách chia nhóm vị thế theo một chiều (giờ vào lệnh, ATR, ER5) — dùng chung cho biểu đồ cột và bản đồ nhiệt,
 * để hai nơi luôn chia nhóm giống nhau.
 */
export interface PositionDimension {
  id: 'hour' | 'atr' | 'er5'
  label: string
  /** Khoá nhóm (số dạng chuỗi để sắp xếp), undefined nếu vị thế không có giá trị */
  keyOf: (p: Mt5Position) => string | undefined
  labelOf: (key: string) => string
}

export const byKeyNumber = (a: string, b: string) => Number(a) - Number(b)

/**
 * Chia giá trị thành khoảng [lo, lo + step); giá trị ≥ cap gộp vào nhóm "≥ cap".
 * Khoá là cận dưới của khoảng.
 */
function binned(
  id: 'atr' | 'er5',
  label: string,
  valueOf: (p: Mt5Position) => number | undefined,
  step: number,
  cap: number,
  digits: number,
): PositionDimension {
  return {
    id,
    label,
    keyOf: (p) => {
      const v = valueOf(p)
      if (v === undefined) return undefined
      return (v >= cap ? cap : Math.floor(v / step + 1e-9) * step).toFixed(digits)
    },
    labelOf: (k) => (Number(k) >= cap ? `≥ ${k}` : `${k}–${(Number(k) + step).toFixed(digits)}`),
  }
}

export function hourDimension(tz: TimeZoneMode): PositionDimension {
  return {
    id: 'hour',
    label: 'Giờ vào lệnh',
    keyOf: (p) => {
      const d = new Date(p.openTime)
      return String(tz === 'utc' ? d.getUTCHours() : d.getHours())
    },
    labelOf: (k) => `${k}:00`,
  }
}

/** ATR lúc vào lệnh: bước 0.5, gộp từ 5 trở lên */
export const atrDimension = binned('atr', 'ATR', (p) => p.atr, 0.5, 5, 1)
/** ER5 lúc vào lệnh (0–1): bước 0.1 */
export const er5Dimension = binned('er5', 'ER5', (p) => p.er5, 0.1, 1, 1)
