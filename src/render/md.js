export function fence(text, lang = '') {
  const body = String(text ?? '');
  let longest = 2;
  for (const m of body.matchAll(/`+/g)) if (m[0].length > longest) longest = m[0].length;
  const ticks = '`'.repeat(longest + 1);
  return `${ticks}${lang}\n${body}\n${ticks}`;
}

export function cell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function table(headers, rows) {
  const line = (cells) => `| ${cells.map(cell).join(' | ')} |`;
  return [line(headers), `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map(line)].join('\n');
}

export function linkText(text) {
  return String(text ?? '').replace(/[[\]]/g, '\\$&');
}

export function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function title(value, fallback) {
  const t = text(value).replace(/\s+/g, ' ');
  return t === '' ? fallback : t;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
