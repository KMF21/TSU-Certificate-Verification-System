/** A cell as read from Excel or CSV, reduced to text, number or date. */
export type Cell = string | number | Date | null

/** Turns an ExcelJS cell value (or anything else) into a Cell. */
export function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'string') return v.trim() === '' ? null : v
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) return toCell((o.richText as { text?: string }[]).map((r) => r.text ?? '').join(''))
    if ('result' in o) return toCell(o.result)
    if ('text' in o) return toCell(o.text)
    if ('error' in o) return null
  }
  return toCell(String(v))
}

export function cellText(c: Cell): string {
  if (c === null) return ''
  if (c instanceof Date) return isoDate(c)
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(Math.round(c * 1e6) / 1e6)
  return c.replace(/\s+/g, ' ').trim()
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

/** Parses CSV text (commas, semicolons or tabs; quoted fields; CRLF). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.slice(0, src.search(/\r?\n|$/))
  const delim = [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// ------------------------------------------------------------------ values

/** Registration numbers as the database stores them. */
export const normaliseReg = (s: string) => s.replace(/\\/g, '/').replace(/\s/g, '').toUpperCase()

/** "BAKO, Ruth  Adi" → "BAKO Ruth Adi". Joins separate surname / other-names columns. */
export function readName(full: string, surname: string, other: string): string {
  const joined = full || [surname, other].filter(Boolean).join(' ')
  return joined.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
}

export type Parsed<T> = { value: T | null; error?: string }

/** CGPA: blank is fine; "4.5", "4.50/5.00", "4,5" are read; out-of-range is an error. */
export function readCgpa(c: Cell): Parsed<number> {
  if (c === null || cellText(c) === '' || /^(n\/?a|nil|-+)$/i.test(cellText(c))) return { value: null }
  let n: number
  if (typeof c === 'number') n = c
  else {
    const m = cellText(c).replace(',', '.').match(/^\d+(\.\d+)?/)
    if (!m) return { value: null, error: `CGPA “${cellText(c)}” isn’t a number` }
    n = Number(m[0])
  }
  n = Math.round(n * 100) / 100
  if (n < 0 || n > 5) return { value: null, error: `CGPA ${n} is outside 0.00–5.00` }
  return { value: n }
}

/** Session: "2023/2024", "2023/24", "2023-2024", "2023 / 2024". A single year is not enough. */
export function readSession(c: Cell): Parsed<string> {
  const t = cellText(c)
  if (!t) return { value: null }
  const m = t.match(/^(\d{4})\s*[/\-–]\s*(\d{2}|\d{4})$/)
  if (!m) return { value: null, error: `Session “${t}” should look like 2024/2025` }
  const a = Number(m[1])
  const b = m[2].length === 2 ? Math.floor(a / 100) * 100 + Number(m[2]) : Number(m[2])
  if (b !== a + 1) return { value: null, error: `Session “${t}” should be two consecutive years` }
  return { value: `${a}/${b}` }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function ymd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return isoDate(dt)
}

/**
 * Dates: Excel dates, Excel serial numbers, 2024-06-12, 12/06/2024 (day first, as used in Nigeria),
 * 12-Jun-2024, 12 June 2024, June 12, 2024.
 */
export function readDate(c: Cell, today: string): Parsed<string> {
  if (c === null || cellText(c) === '') return { value: null }
  let iso: string | null = null
  if (c instanceof Date) iso = isoDate(c)
  else if (typeof c === 'number') {
    if (c > 20000 && c < 80000) iso = isoDate(new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 864e5))
  } else {
    const t = cellText(c).toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
    let m: RegExpMatchArray | null
    if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) iso = ymd(+m[1], +m[2], +m[3])
    else if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) iso = ymd(+m[3], +m[2], +m[1])
    else if ((m = t.match(/^(\d{1,2})[ -]([a-z]{3,9})\.?[ -](\d{2,4})$/))) {
      const mi = MONTHS.indexOf(m[2].slice(0, 3))
      if (mi >= 0) iso = ymd(+m[3], mi + 1, +m[1])
    } else if ((m = t.match(/^([a-z]{3,9})\.? (\d{1,2}) (\d{4})$/))) {
      const mi = MONTHS.indexOf(m[1].slice(0, 3))
      if (mi >= 0) iso = ymd(+m[3], mi + 1, +m[2])
    }
  }
  if (!iso) return { value: null, error: `Date “${cellText(c)}” couldn’t be read (use 12/06/2024)` }
  if (iso > today) return { value: null, error: `Senate date ${iso} is in the future` }
  if (iso < '2008-01-01') return { value: null, error: `Senate date ${iso} is before 2008` }
  return { value: iso }
}
