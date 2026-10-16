/**
 * Đọc nến OHLC xuất từ MT5. Hỗ trợ:
 * - Script app/mql5/ExportCandlesCsv.mq5:  time,open,high,low,close,tick_volume  ("2026.08.24 01:38")
 * - MT5 View → Symbols → Bars → Export:   <DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>...
 * Thời gian là giờ server MT5 (Exness: UTC+0) → lưu dạng giây UTC cho lightweight-charts.
 */
export interface Candle {
  /** Unix giây (UTC) */
  time: number
  open: number
  high: number
  low: number
  close: number
}

export type CandleTimeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1'

export const TIMEFRAME_SECONDS: Record<CandleTimeframe, number> = {
  M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400,
}

/** "XAUUSDc_M5.csv" hoặc tên mặc định của MT5 "XAUUSDc_M5_202608010000_202610162359.csv" */
export function parseCandleFileName(name: string): { symbol: string; timeframe: CandleTimeframe } | null {
  const m = /^(.+?)_(M1|M5|M15|M30|H1|H4|D1)(?:_[\d_]+)?\.csv$/i.exec(name)
  return m ? { symbol: m[1], timeframe: m[2].toUpperCase() as CandleTimeframe } : null
}

/** "2026.08.24" + "01:38[:00]" → giây UTC */
function toSeconds(date: string, time: string): number | null {
  const d = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
  if (!d || !t) return null
  return Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], +(t[3] ?? 0)) / 1000
}

export function parseCandlesCsv(text: string): Candle[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const delimiter = [lines[0]?.includes('\t') ? '\t' : '', lines[0]?.includes(';') ? ';' : '', ','].find(Boolean)!
  const out: Candle[] = []
  for (const line of lines) {
    const cells = line.split(delimiter).map((c) => c.trim())
    if (cells.length < 5) continue
    // Ngày + giờ có thể chung một ô ("2026.08.24 01:38") hoặc tách hai ô (Export Bars)
    let time: number | null
    let i: number
    if (cells[0].includes(' ')) {
      const [d, t] = cells[0].split(/\s+/)
      time = toSeconds(d, t)
      i = 1
    } else {
      time = toSeconds(cells[0], cells[1])
      i = 2
    }
    if (time === null) continue // dòng tiêu đề / dòng lỗi
    const [open, high, low, close] = cells.slice(i, i + 4).map(Number)
    if (![open, high, low, close].every(Number.isFinite)) continue
    out.push({ time, open, high, low, close })
  }
  // lightweight-charts cần thời gian tăng dần, không trùng
  out.sort((a, b) => a.time - b.time)
  return out.filter((c, k) => k === 0 || c.time !== out[k - 1].time)
}
