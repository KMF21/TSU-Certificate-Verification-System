import type { RegisterRow } from '../register-query'
import { LEVEL_LABEL, SOURCE_LABEL, STATUS_LABEL, VERIFICATION_LABEL } from '../roles'

export type ExportColumn =
  | 'sn'
  | 'full_name'
  | 'reg_number'
  | 'programme'
  | 'level'
  | 'department'
  | 'faculty'
  | 'class'
  | 'cgpa'
  | 'session'
  | 'senate_date'
  | 'certificate_serial'
  | 'status'
  | 'source'
  | 'verification'
  | 'remark'

export interface ColumnDef {
  key: ExportColumn
  label: string
  /** Relative width, used by Excel (characters) and PDF (share of the page). */
  width: number
  /** Hidden from the picker when the list is grouped, because the group headings show it. */
  groupedAway?: boolean
  align?: 'left' | 'right' | 'center'
}

export const COLUMNS: ColumnDef[] = [
  { key: 'sn', label: 'S/N', width: 6, align: 'right' },
  { key: 'full_name', label: 'Name (surname first)', width: 34 },
  { key: 'reg_number', label: 'Registration number', width: 22 },
  { key: 'programme', label: 'Programme', width: 40, groupedAway: true },
  { key: 'level', label: 'Level', width: 12 },
  { key: 'department', label: 'Department', width: 34, groupedAway: true },
  { key: 'faculty', label: 'Faculty', width: 30, groupedAway: true },
  { key: 'class', label: 'Class of degree', width: 16 },
  { key: 'cgpa', label: 'CGPA', width: 8, align: 'right' },
  { key: 'session', label: 'Session', width: 12 },
  { key: 'senate_date', label: 'Senate approval', width: 15 },
  { key: 'certificate_serial', label: 'Certificate serial', width: 22 },
  { key: 'status', label: 'Status', width: 11 },
  { key: 'source', label: 'Source', width: 9 },
  { key: 'verification', label: 'Verification', width: 12 },
  { key: 'remark', label: 'Remark', width: 28 },
]

export const COLUMN_BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]))

/** CGPA is off by default: CPGS doesn't usually issue it. */
export const DEFAULT_COLUMNS: ExportColumn[] = ['sn', 'full_name', 'reg_number', 'class', 'session', 'senate_date']

export type ExportFormat = 'xlsx' | 'pdf'

export interface ExportOptions {
  columns: ExportColumn[]
  format: ExportFormat
  grouped: boolean
  title: string
}

export function parseOptions(sp: Record<string, string | string[] | undefined>): ExportOptions {
  const one = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const cols = one('cols')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is ExportColumn => COLUMN_BY_KEY.has(s as ExportColumn))
  return {
    columns: cols.length ? [...new Set(cols)] : DEFAULT_COLUMNS,
    format: one('fmt') === 'pdf' ? 'pdf' : 'xlsx',
    grouped: one('group') !== '0',
    title: one('title').trim().slice(0, 160),
  }
}

export function optionsToParams(o: ExportOptions, p = new URLSearchParams()): URLSearchParams {
  p.set('cols', o.columns.join(','))
  p.set('fmt', o.format)
  if (!o.grouped) p.set('group', '0')
  if (o.title) p.set('title', o.title)
  return p
}

/** Columns actually printed: grouped lists drop the ones the headings already show. */
export function effectiveColumns(o: ExportOptions): ColumnDef[] {
  return o.columns.map((k) => COLUMN_BY_KEY.get(k)!).filter((c) => c && !(o.grouped && c.groupedAway))
}

export interface ExportRow extends RegisterRow {
  programme_code?: string
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

/** The text for one cell. */
export function cellValue(row: ExportRow, key: ExportColumn, sn: number): string | number {
  switch (key) {
    case 'sn': return sn
    case 'full_name': return row.full_name
    case 'reg_number': return row.reg_number
    case 'programme': return `${row.award_title} ${row.programme_name}`
    case 'level': return LEVEL_LABEL[row.level]
    case 'department': return row.department_name
    case 'faculty': return row.faculty_name
    case 'class': return row.class_of_degree ?? ''
    case 'cgpa': return row.cgpa == null ? '' : Number(Number(row.cgpa).toFixed(2))
    case 'session': return row.graduation_session ?? ''
    case 'senate_date': return day(row.senate_approval_date)
    case 'certificate_serial': return row.certificate_serial ?? ''
    case 'status': return STATUS_LABEL[row.status]
    case 'source': return SOURCE_LABEL[row.source]
    case 'verification': return VERIFICATION_LABEL[row.verification_status]
    case 'remark': return row.remark ?? ''
  }
}

export interface Group {
  faculty: string
  departments: { department: string; programmes: { programme: string; rows: ExportRow[] }[] }[]
}

/** Faculty → department → programme, each sorted by name; graduates sorted by name. */
export function groupRows(rows: ExportRow[]): Group[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, 'en-GB')
  const byFaculty = new Map<string, Map<string, Map<string, ExportRow[]>>>()
  for (const r of rows) {
    const f = byFaculty.get(r.faculty_name) ?? new Map()
    byFaculty.set(r.faculty_name, f)
    const d = f.get(r.department_name) ?? new Map()
    f.set(r.department_name, d)
    const label = `${r.award_title} ${r.programme_name}`
    d.set(label, [...(d.get(label) ?? []), r])
  }
  return [...byFaculty.entries()]
    .sort(([a], [b]) => cmp(a, b))
    .map(([faculty, depts]) => ({
      faculty,
      departments: [...depts.entries()]
        .sort(([a], [b]) => cmp(a, b))
        .map(([department, progs]) => ({
          department,
          programmes: [...progs.entries()]
            .sort(([a], [b]) => cmp(a, b))
            .map(([programme, list]) => ({ programme, rows: list.sort((x, y) => cmp(x.full_name, y.full_name)) })),
        })),
    }))
}

/** A short line describing the filters, printed under the title. */
export function describeFilters(parts: string[]): string {
  return parts.length ? parts.join(' · ') : 'All records in the register'
}

export function fileName(title: string, format: ExportFormat, date: string): string {
  const base = (title || 'Graduation register').replace(/[^\w\s()-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return `${base} ${date}.${format}`
}
