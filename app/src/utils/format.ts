/** Tách phần nguyên / phần thập phân để hiển thị như "-140.78" (phần lẻ nhỏ hơn). */
export function splitMoney(value: number, digits = 2): { int: string; frac: string } {
  const s = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  const i = s.lastIndexOf('.')
  return i === -1 ? { int: s, frac: '' } : { int: s.slice(0, i), frac: s.slice(i) }
}

export function money(value: number, opts: { sign?: boolean; digits?: number } = {}): string {
  const s = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: opts.digits ?? 2,
    maximumFractionDigits: opts.digits ?? 2,
  }).format(value)
  return opts.sign && value > 0 ? `+${s}` : s
}

/** Kiểu hiển thị lịch: 50,46 $ (dấu phẩy thập phân). */
export function moneyVi(value: number): string {
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function int(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}
