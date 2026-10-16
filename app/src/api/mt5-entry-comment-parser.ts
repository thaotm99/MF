/**
 * Đọc chỉ báo lúc vào lệnh từ comment của lệnh do EA Tricoral ghi (xem OpenOrder trong test/*.mq5):
 * - Bản mới:  "MF_01,A: 2.4,er15: 0.31,er5: 0.05"   (có thể thêm ",S: TT")
 * - Bản trước: "MF_01,A: 2.6,ek: 0.97,er: 0.76"      (ek = ERRank, er = EfficiencyRatio trên InpERtf, mặc định M5)
 * - Bản cũ:   "MF_01, ATR: 2.3, erK: 0.51, er: 0.40"
 * - Bản đầu:  "ATR : 4.1"
 *
 * MT5 cắt comment ở 31 ký tự nên giá trị cuối có thể bị cụt ("er: 0." hoặc "er:") → coi như không có,
 * để không tính nhầm thành 0.
 */
export interface EntryIndicators {
  /** ATR lúc vào lệnh */
  atr?: number
  /** Efficiency Ratio khung M5 lúc vào lệnh (er5; bản trước ghi "er") */
  er5?: number
}

/** Chỉ nhận số đầy đủ — loại "0." hoặc chuỗi rỗng do comment bị cắt */
const COMPLETE_NUMBER = /^\d+(?:\.\d+)?$/

export function parseEntryComment(comment: string | undefined): EntryIndicators {
  if (!comment) return {}
  const fields = new Map<string, string>()
  for (const part of comment.split(',')) {
    const i = part.indexOf(':')
    if (i === -1) continue
    fields.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim())
  }
  const numberOf = (...keys: string[]) => {
    for (const k of keys) {
      const v = fields.get(k)
      if (v !== undefined && COMPLETE_NUMBER.test(v)) return Number(v)
    }
    return undefined
  }
  return {
    atr: numberOf('a', 'atr'),
    // er5 ưu tiên; "er" của bản trước cũng là ER trên M5 (InpERtf mặc định)
    er5: numberOf('er5', 'er'),
  }
}
