import type { Cell, ImportProblem } from './import-rows'
import type { AwardLevel } from './roles'

export interface ReferenceRow {
  faculty_code: string
  faculty_name: string
  department_code: string
  department_name: string
  programme_code: string
  programme_name: string
  award_title: string
  award_level: AwardLevel
}

export const REFERENCE_COLUMNS = [
  { key: 'faculty_code', header: 'Faculty code', example: 'FSC' },
  { key: 'faculty_name', header: 'Faculty', example: 'Faculty of Science' },
  { key: 'department_code', header: 'Department code', example: 'MTH' },
  { key: 'department_name', header: 'Department', example: 'Department of Mathematics' },
  { key: 'programme_code', header: 'Programme code', example: 'BSC-MTH' },
  { key: 'programme_name', header: 'Programme', example: 'Mathematics' },
  { key: 'award_title', header: 'Award title', example: 'Bachelor of Science (B.Sc.)' },
  { key: 'award_level', header: 'Level', example: 'Undergraduate' },
] as const

const norm = (h: Cell) => String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const text = (c: Cell) => (c === null || c === undefined ? '' : String(c).replace(/\s+/g, ' ').trim())

export function validateReference(table: Cell[][]): { rows: ReferenceRow[]; problems: ImportProblem[] } {
  const problems: ImportProblem[] = []
  const rows: ReferenceRow[] = []
  const header = (table[0] ?? []).map(norm)
  const idx = new Map<string, number>()
  REFERENCE_COLUMNS.forEach((c) => {
    const i = header.findIndex((h) => h === norm(c.header) || h === c.key)
    if (i >= 0) idx.set(c.key, i)
  })
  const missing = REFERENCE_COLUMNS.filter((c) => !idx.has(c.key)).map((c) => c.header)
  if (missing.length) return { rows, problems: [{ row: 1, message: `Missing columns: ${missing.join(', ')}. Use the template.` }] }

  const codeOk = (s: string, max: number) => new RegExp(`^[A-Z0-9${max > 12 ? '-' : ''}]{2,${max}}$`).test(s)
  const seen = new Map<string, number>()

  table.slice(1).forEach((r, i) => {
    const rowNo = i + 2
    if (r.every((c) => text(c) === '')) return
    const get = (k: string) => text(r[idx.get(k)!])
    const say = (m: string) => problems.push({ row: rowNo, message: m })

    const row: ReferenceRow = {
      faculty_code: get('faculty_code').toUpperCase(),
      faculty_name: get('faculty_name'),
      department_code: get('department_code').toUpperCase(),
      department_name: get('department_name'),
      programme_code: get('programme_code').toUpperCase(),
      programme_name: get('programme_name'),
      award_title: get('award_title'),
      award_level: get('award_level').toLowerCase().startsWith('post') ? 'postgraduate' : 'undergraduate',
    }
    const levelRaw = get('award_level').toLowerCase()
    if (!/^(undergraduate|postgraduate|ug|pg)$/.test(levelRaw)) say('Level must be Undergraduate or Postgraduate.')
    if (levelRaw === 'pg') row.award_level = 'postgraduate'
    if (!codeOk(row.faculty_code, 12)) say('Faculty code must be 2 to 12 letters or digits.')
    if (!codeOk(row.department_code, 12)) say('Department code must be 2 to 12 letters or digits.')
    if (!codeOk(row.programme_code, 16)) say('Programme code must be 2 to 16 letters, digits or hyphens.')
    if (row.faculty_name.length < 3) say('Faculty name is missing.')
    if (row.department_name.length < 3) say('Department name is missing.')
    if (row.programme_name.length < 2) say('Programme name is missing.')
    if (row.award_title.length < 3) say('Award title is missing, for example “Bachelor of Science (B.Sc.)”.')
    if (seen.has(row.programme_code)) say(`Programme code ${row.programme_code} is also used on row ${seen.get(row.programme_code)}.`)
    else seen.set(row.programme_code, rowNo)
    rows.push(row)
  })
  if (!rows.length && !problems.length) problems.push({ row: 2, message: 'The sheet has no programmes under the header row.' })
  return { rows, problems }
}
