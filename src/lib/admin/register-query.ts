import type { ProgrammeLevel, RecordSource, RecordStatus, VerificationState } from './roles'

/** Filters shared by the records table and, later, the export centre. All optional. */
export interface RegisterFilters {
  q?: string
  faculty?: string
  department?: string
  programme?: string
  level?: ProgrammeLevel
  sessions?: string[]
  from?: string
  to?: string
  status?: RecordStatus
  source?: RecordSource
  verification?: VerificationState
  batch?: string
}

export interface RegisterRow {
  id: string
  full_name: string
  reg_number: string
  cgpa: number | null
  remark: string | null
  graduation_session: string | null
  senate_approval_date: string | null
  status: RecordStatus
  source: RecordSource
  verification_status: VerificationState
  is_sample: boolean
  certificate_serial: string | null
  class_of_degree: string | null
  programme_name: string
  award_title: string
  level: ProgrammeLevel
  department_name: string
  faculty_name: string
  created_by: string | null
  updated_by: string | null
}

const UUID = /^[0-9a-f-]{36}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const SESSION = /^\d{4}\/\d{4}$/

const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined)

/** Reads filters from URL search params, dropping anything malformed. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): RegisterFilters {
  const one = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
  }
  const many = (k: string) => {
    const v = sp[k]
    return (Array.isArray(v) ? v : v ? v.split(',') : []).map((s) => s.trim()).filter(Boolean)
  }
  const id = (k: string) => {
    const v = one(k)
    return v && UUID.test(v) ? v : undefined
  }
  const date = (k: string) => {
    const v = one(k)
    return v && DATE.test(v) ? v : undefined
  }
  return {
    q: one('q')?.slice(0, 80),
    faculty: id('faculty'),
    department: id('department'),
    programme: id('programme'),
    level: pick(one('level'), ['pgd', 'masters', 'phd', 'undergraduate'] as const),
    sessions: many('session').filter((s) => SESSION.test(s)).slice(0, 20),
    from: date('from'),
    to: date('to'),
    status: pick(one('status'), ['pending', 'approved'] as const),
    source: pick(one('source'), ['live', 'legacy'] as const),
    verification: pick(one('verification'), ['verified', 'unverified'] as const),
    batch: id('batch'),
  }
}

export function filtersToParams(f: RegisterFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.faculty) p.set('faculty', f.faculty)
  if (f.department) p.set('department', f.department)
  if (f.programme) p.set('programme', f.programme)
  if (f.level) p.set('level', f.level)
  f.sessions?.forEach((s) => p.append('session', s))
  if (f.from) p.set('from', f.from)
  if (f.to) p.set('to', f.to)
  if (f.status) p.set('status', f.status)
  if (f.source) p.set('source', f.source)
  if (f.verification) p.set('verification', f.verification)
  if (f.batch) p.set('batch', f.batch)
  return p
}

export const activeFilterCount = (f: RegisterFilters) =>
  [f.faculty, f.department, f.programme, f.level, f.from, f.to, f.status, f.source, f.verification, f.batch].filter(Boolean).length +
  (f.sessions?.length ? 1 : 0)

/** Escapes a search term for a PostgREST ilike pattern inside an or() filter. */
export function searchPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()"]/g, ' ').trim()}%`
}

// Structural type so this module stays free of Supabase imports (and testable).
interface FilterableQuery {
  eq(column: string, value: unknown): FilterableQuery
  in(column: string, values: unknown[]): FilterableQuery
  gte(column: string, value: unknown): FilterableQuery
  lte(column: string, value: unknown): FilterableQuery
  or(filters: string): FilterableQuery
}

/** Adds the filters to a Supabase query on register_view and returns the same query type. */
export function applyFilters<T>(query: T, f: RegisterFilters): T {
  let q = query as unknown as FilterableQuery
  if (f.q) {
    const pattern = searchPattern(f.q)
    q = q.or(`full_name.ilike.${pattern},reg_number.ilike.${pattern}`)
  }
  if (f.faculty) q = q.eq('faculty_id', f.faculty)
  if (f.department) q = q.eq('department_id', f.department)
  if (f.programme) q = q.eq('programme_id', f.programme)
  if (f.level) q = q.eq('level', f.level)
  if (f.sessions?.length) q = q.in('graduation_session', f.sessions)
  if (f.from) q = q.gte('senate_approval_date', f.from)
  if (f.to) q = q.lte('senate_approval_date', f.to)
  if (f.status) q = q.eq('status', f.status)
  if (f.source) q = q.eq('source', f.source)
  if (f.verification) q = q.eq('verification_status', f.verification)
  if (f.batch) q = q.eq('import_batch_id', f.batch)
  return q as unknown as T
}

export const REGISTER_COLUMNS =
  'id, full_name, reg_number, cgpa, remark, graduation_session, senate_approval_date, status, source, verification_status, ' +
  'is_sample, certificate_serial, class_of_degree, programme_name, award_title, level, department_name, faculty_name, created_by, updated_by'
