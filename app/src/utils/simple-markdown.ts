/**
 * Markdown tối giản → HTML an toàn (escape toàn bộ trước, chỉ tạo lại vài thẻ): tiêu đề, đậm, nghiêng, code, danh sách, đoạn.
 * Dùng cho câu trả lời của Claude Code — không cho HTML / link tuỳ ý.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
}

export function renderMarkdown(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let para: string[] = []
  let code: string[] | null = null
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    if (code) {
      if (/^```/.test(raw)) {
        out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`)
        code = null
      } else code.push(raw)
      continue
    }
    if (/^```/.test(raw)) {
      flushPara(); closeList()
      code = []
      continue
    }
    const line = raw.trimEnd()
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (h) {
      flushPara(); closeList()
      const lvl = Math.min(4, h[1].length + 1)
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
    } else if (ul || ol) {
      flushPara()
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
    } else if (!line.trim()) {
      flushPara(); closeList()
    } else {
      closeList()
      para.push(line)
    }
  }
  if (code) out.push(`<pre><code>${esc((code as string[]).join('\n'))}</code></pre>`)
  flushPara(); closeList()
  return out.join('')
}
