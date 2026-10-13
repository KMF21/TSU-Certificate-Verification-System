import { DEGREE_CLASSES, POSTGRADUATE_GRADES, type AwardLevel } from './roles'

/** One validated row, in the shape public.import_batch_rows expects. */
export interface ImportRow {
  surname: string
  other_names: string
  matric_no: string
  programme_code: string
  class_of_degree: string | null
  date_of_award: string
  date_of_birth: string | null
  email: string | null
  phone: string | null
}

export interface ImportProblem {
  /** Row number as staff see it in the spreadsheet (header is row 1). */
  row: number
  message: string
}

export type Cell = string | number | Date | boolean | null | undefined

export const TEMPLATE_COLUMNS = [
  { key: 'surname', header: 'Surname', example: 'Ibrahim', required: true },
  { key: 'other_names', header: 'Other names', example: 'Aisha Ladi', required: true },
  { key: 'matric_no', header: 'Matric number', example: 'TSU/19/CSC/1045', required: true },
  { key: 'programme_code', header: 'Programme code', example: 'BSC-CSC', required: true },
  { key: 'class_of_degree', header: 'Class of degree', example: 'First Class Honours', required: false },
  { key: 'date_of_award', header: 'Date of award', example: '2025-11-20', required: true },
  { key: 'date_of_birth', header: 'Date of birth', example: '', required: false },
  { key: 'email', header: 'Email', example: '', required: false },
  { key: 'phone', header: 'Phone', example: '', required: false },
] as const

type ColumnKey = (typeof TEMPLATE_COLUMNS)[number]['key']

const ALIASES: Record<string, ColumnKey> = {
  surname: 'surname', last_name: 'surname', family_name: 'surname',
  other_names: 'other_names', othernames: 'other_names', first_names: 'other_names', first_name: 'other_names', given_names: 'other_names',
  matric_number: 'matric_no', matric_no: 'matric_no', matric: 'matric_no', matriculation_number: 'matric_no', reg_no: 'matric_no', registration_number: 'matric_no',
  programme_code: 'programme_code', program_code: 'programme_code', programme: 'programme_code',
  class_of_degree: 'class_of_degree', class: 'class_of_degree', degree_class: 'class_of_degree', grade: 'class_of_degree',
  date_of_award: 'date_of_award', award_date: 'date_of_award', senate_date: 'date_of_award', date_awarded: 'date_of_award',
  date_of_birth: 'date_of_birth', dob: 'date_of_birth', birth_date: 'date_of_birth',
  email: 'email', email_address: 'email',
  phone: 'phone', phone_number: 'phone', mobile: 'phone', gsm: 'phone',
}

const normaliseHeader = (h: Cell) =>
  String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return isoDate(cell) ?? ''
  return String(cell).replace(/\s+/g, ' ').trim()
}

function isoDate(d: Date): string | null {
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/** Accepts real dates, yyyy-mm-dd, dd/mm/yyyy (Nigerian order) and Excel serial numbers. */
export function parseDate(cell: Cell): string | null {
  if (cell === null || cell === undefined || cell === '') return null
  if (cell instanceof Date) {
    // Excel dates arrive as UTC midnight; nudge by 12h so time-zone drift never changes the day.
    return isoDate(new Date(cell.getTime() + 12 * 3600e3))
  }
  if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
    return isoDate(new Date(Date.UTC(1899, 11, 30) + Math.round(cell) * 864e5))
  }
  const s = String(cell).trim()
  let y: number, m: number, d: number
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return isoDate(date)
}

function canonicalClass(value: string, level: AwardLevel): string | null | undefined {
  if (!value) return null
  const allowed: readonly string[] = level === 'undergraduate' ? DEGREE_CLASSES : POSTGRADUATE_GRADES
  const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const shorthand: Record<string, string> = {
    first: 'First Class Honours', firstclass: 'First Class Honours',
    '21': 'Second Class Honours (Upper Division)', secondclassupper: 'Second Class Honours (Upper Division)', '2ndclassupper': 'Second Class Honours (Upper Division)',
    '22': 'Second Class Honours (Lower Division)', secondclasslower: 'Second Class Honours (Lower Division)', '2ndclasslower': 'Second Class Honours (Lower Division)',
    third: 'Third Class Honours', thirdclass: 'Third Class Honours',
  }
  const hit = allowed.find((a) => simple(a) === simple(value)) ?? (level === 'undergraduate' ? shorthand[simple(value)] : undefined)
  return hit ?? undefined
}

/**
 * Validates a sheet (first row = headers) for one batch. Collects every problem rather than
 * stopping at the first, so staff can fix the whole file in one pass.
 */
export function validateSheet(
  table: Cell[][],
  opts: { level: AwardLevel; programmeCodes: Set<string>; today?: string },
): { rows: ImportRow[]; problems: ImportProblem[] } {
  const problems: ImportProblem[] = []
  const rows: ImportRow[] = []
  const today = opts.today ?? new Date().toISOString().slice(0, 10)

  const header = table[0] ?? []
  const index = new Map<ColumnKey, number>()
  header.forEach((h, i) => {
    const key = ALIASES[normaliseHeader(h)]
    if (key && !index.has(key)) index.set(key, i)
  })
  const missing = TEMPLATE_COLUMNS.filter((c) => c.required && !index.has(c.key)).map((c) => c.header)
  if (missing.length) {
    return { rows, problems: [{ row: 1, message: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Use the template.` }] }
  }

  const seen = new Map<string, number>()
  const get = (r: Cell[], k: ColumnKey) => (index.has(k) ? r[index.get(k)!] : undefined)

  table.slice(1).forEach((r, i) => {
    const rowNo = i + 2
    if (r.every((c) => text(c) === '')) return
    const say = (message: string) => problems.push({ row: rowNo, message })

    const surname = text(get(r, 'surname'))
    const otherNames = text(get(r, 'other_names'))
    const matric = text(get(r, 'matric_no')).toUpperCase().replace(/\s/g, '').replace(/\\/g, '/')
    const programme = text(get(r, 'programme_code')).toUpperCase()
    const classRaw = text(get(r, 'class_of_degree'))
    const award = parseDate(get(r, 'date_of_award') ?? null)
    const dobRaw = get(r, 'date_of_birth')
    const dob = parseDate(dobRaw ?? null)
    const email = text(get(r, 'email')).toLowerCase() || null
    const phone = text(get(r, 'phone')) || null

    if (!surname) say('Surname is empty.')
    if (!otherNames) say('Other names is empty.')
    if (!matric) say('Matric number is empty.')
    else if (!/^[A-Z0-9][A-Z0-9/-]{3,39}$/.test(matric)) say(`Matric number "${matric}" has characters other than letters, digits, slashes and hyphens.`)
    if (!programme) say('Programme code is empty.')
    else if (!opts.programmeCodes.has(programme)) say(`Programme code "${programme}" is not in the ${opts.level} programme list.`)

    const cls = canonicalClass(classRaw, opts.level)
    if (cls === undefined) say(`"${classRaw}" is not a recognised ${opts.level === 'undergraduate' ? 'class of degree' : 'grade'}.`)
    if (opts.level === 'undergraduate' && cls === null) say('Class of degree is required for undergraduate awards.')

    if (!award) say('Date of award is missing or not a real date. Use YYYY-MM-DD or DD/MM/YYYY.')
    else if (award < '2008-01-01' || award > today) say(`Date of award ${award} is outside TSU's history or in the future.`)
    if (dobRaw && text(dobRaw) && !dob) say('Date of birth is not a real date.')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) say(`"${email}" is not an email address.`)

    if (matric && programme) {
      const key = `${matric}|${programme}`
      if (seen.has(key)) say(`Same matric number and programme as row ${seen.get(key)}.`)
      else seen.set(key, rowNo)
    }

    rows.push({
      surname,
      other_names: otherNames,
      matric_no: matric,
      programme_code: programme,
      class_of_degree: cls ?? null,
      date_of_award: award ?? '',
      date_of_birth: dob,
      email,
      phone,
    })
  })

  if (!rows.length && !problems.length) problems.push({ row: 2, message: 'The sheet has no records under the header row.' })
  return { rows, problems }
}

/** Minimal RFC 4180 CSV reader (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = input.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field); out.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); out.push(row) }
  return out
}
