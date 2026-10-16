import type { GlossarySection } from './glossary-sketch-builders'
import { RSI_BASIC_TERMS } from './glossary-rsi-basics-terms'
import { RSI_SIGNAL_TERMS } from './glossary-rsi-signal-terms'

/** Mục RSI trên trang Thuật ngữ — tổng kết ebook John Hayden (docs/RSI TOÀN TẬP EBOOK.pdf) */
export const RSI_SECTION: GlossarySection = {
  id: 'rsi',
  title: 'RSI (ebook John Hayden)',
  terms: [...RSI_BASIC_TERMS, ...RSI_SIGNAL_TERMS],
}
