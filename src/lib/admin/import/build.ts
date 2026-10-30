import type { ImportField } from './fields'
import { findClass, flat, programmeIndex, type ClassRef, type ProgrammeRef, type Suggestion } from './match'
import { cellText, normaliseReg, readCgpa, readDate, readName, readSession, type Cell } from './values'

export interface SharedValues {
  programme_id?: string
  graduation_session?: string
  senate_approval_date?: string
  class_id?: string
}

export interface Existing {
  id: string
  full_name: string
  status: 'pending' | 'approved'
}

export type RowAction = 'create' | 'update' | 'skip' | 'reject'

export interface BuiltRow {
  /** Row number as shown in Excel (1-based, counting the heading rows). */
  row: number
  full_name: string
  reg_number: string
  programme_id: string | null
  programme_label: string
  cgpa: number | null
  class_id: string | null
  class_label: string
  remark: string | null
  graduation_session: string | null
  senate_approval_date: string | null
  action: RowAction
  problems: string[]
  note?: string
  existing?: Existing
}

export interface Unresolved<T> {
  text: string
  rows: number
  suggestions: T[]
}

export interface BuildInput {
  rows: Cell[][]
  /** Index in `rows` of the heading row; data starts after it. */
  headingRow: number
  mapping: (ImportField | null)[]
  shared: SharedValues
  programmes: ProgrammeRef[]
  classes: ClassRef[]
  /** Staff choices for programme texts that didn't match on their own: text → programme id ('' = leave unmatched). */
  programmeChoices: Record<string, string>
  /** Staff choices for class texts: text → class id, or '' to leave the class blank. */
  classChoices: Record<string, string>
  existing: Record<string, Existing>
  duplicates: 'skip' | 'update'
  today: string
}

export interface BuildResult {
  rows: BuiltRow[]
  unresolvedProgrammes: Unresolved<Suggestion<ProgrammeRef>>[]
  unresolvedClasses: Unresolved<ClassRef>[]
  counts: Record<RowAction, number>
  /** Rows ignored because every mapped cell was empty. */
  blank: number
}

const key = (s: string) => flat(s)

export function buildRows(input: BuildInput): BuildResult {
  const col = (f: ImportField) => input.mapping.indexOf(f)
  const c = Object.fromEntries(
    (['full_name', 'surname', 'other_names', 'reg_number', 'programme', 'award', 'cgpa', 'class', 'graduation_session', 'senate_approval_date', 'remark'] as ImportField[]).map((f) => [f, col(f)]),
  ) as Record<ImportField, number>
  const at = (r: Cell[], i: number): Cell => (i >= 0 ? (r[i] ?? null) : null)
  const text = (r: Cell[], i: number) => cellText(at(r, i))

  const index = programmeIndex(input.programmes)
  const byId = new Map(input.programmes.map((p) => [p.id, p]))
  const classById = new Map(input.classes.map((k) => [k.id, k]))
  const progCache = new Map<string, ReturnType<typeof index.find>>()
  const unresolvedProg = new Map<string, Unresolved<Suggestion<ProgrammeRef>>>()
  const unresolvedClass = new Map<string, Unresolved<ClassRef>>()

  const out: BuiltRow[] = []
  let blank = 0
  const mappedCols = input.mapping.map((m, i) => (m ? i : -1)).filter((i) => i >= 0)

  for (let i = input.headingRow + 1; i < input.rows.length; i++) {
    const r = input.rows[i] ?? []
    const filled = mappedCols.filter((ci) => text(r, ci) !== '').length
    // Empty rows, and stray lines like "Signed: Secretary" under the table.
    if (filled === 0 || (filled === 1 && !text(r, c.reg_number))) {
      blank++
      continue
    }
    const full_name = readName(text(r, c.full_name), text(r, c.surname), text(r, c.other_names))
    // The template's example row.
    if (/\(delete this row\)/i.test(full_name)) {
      blank++
      continue
    }
    const problems: string[] = []

    if (full_name.length < 3) problems.push('Name is missing')
    else if (full_name.length > 200) problems.push('Name is too long')

    const reg_number = normaliseReg(text(r, c.reg_number))
    if (!reg_number) problems.push('Registration number is missing')
    else if (!/^[A-Z0-9][A-Z0-9/.-]{2,39}$/.test(reg_number)) problems.push(`Registration number “${reg_number}” has characters the register doesn’t accept`)

    // Programme: shared value, or matched from the row's text.
    let programme: ProgrammeRef | null = null
    let programme_label = ''
    const progText = [text(r, c.award), text(r, c.programme)].filter(Boolean).join(' ')
    if (input.shared.programme_id) programme = byId.get(input.shared.programme_id) ?? null
    else if (progText) {
      const k = key(progText)
      programme_label = progText
      let found = progCache.get(k)
      if (!found) {
        found = index.find(text(r, c.programme), text(r, c.award))
        progCache.set(k, found)
      }
      const chosen = input.programmeChoices[k]
      programme = chosen ? (byId.get(chosen) ?? null) : found.match
      // Anything that didn't match on its own stays listed, even after staff choose, so they can review it.
      if (!found.match) {
        const u = unresolvedProg.get(k) ?? { text: progText, rows: 0, suggestions: found.suggestions }
        u.rows++
        unresolvedProg.set(k, u)
      }
    }
    if (programme) programme_label = `${programme.award_title} ${programme.name}`
    if (!programme) problems.push(progText ? `Programme “${progText}” needs matching` : 'Programme is missing')

    const cg = readCgpa(at(r, c.cgpa))
    if (cg.error) problems.push(cg.error)

    let class_id: string | null = null
    let class_label = ''
    if (input.shared.class_id) {
      class_id = input.shared.class_id
      class_label = classById.get(class_id)?.label ?? ''
    } else {
      const ct = text(r, c.class)
      if (ct) {
        const k = key(ct)
        const found = findClass(ct, input.classes, programme?.level)
        if (!found.match) {
          const u = unresolvedClass.get(k) ?? { text: ct, rows: 0, suggestions: found.suggestions }
          u.rows++
          unresolvedClass.set(k, u)
        }
        if (k in input.classChoices) class_id = input.classChoices[k] || null
        else {
          class_id = found.match?.id ?? null
          if (!found.match) problems.push(`Class “${ct}” needs matching`)
        }
        class_label = class_id ? (classById.get(class_id)?.label ?? '') : ''
        const cls = class_id ? classById.get(class_id) : null
        if (cls?.level && programme && cls.level !== programme.level) problems.push(`Class “${cls.label}” doesn’t apply to this programme’s level`)
      }
    }

    const ses = input.shared.graduation_session ? { value: input.shared.graduation_session } : readSession(at(r, c.graduation_session))
    if ('error' in ses && ses.error) problems.push(ses.error)
    const dt = input.shared.senate_approval_date ? { value: input.shared.senate_approval_date } : readDate(at(r, c.senate_approval_date), input.today)
    if ('error' in dt && dt.error) problems.push(dt.error)

    const remark = text(r, c.remark).slice(0, 500) || null

    out.push({
      row: i + 1,
      full_name,
      reg_number,
      programme_id: programme?.id ?? null,
      programme_label,
      cgpa: cg.value,
      class_id,
      class_label,
      remark,
      graduation_session: ses.value ?? null,
      senate_approval_date: dt.value ?? null,
      action: 'create',
      problems,
    })
  }

  // Duplicates inside the file: every copy is rejected, so nobody has to guess which is right.
  const seen = new Map<string, number[]>()
  out.forEach((r, i) => r.reg_number && seen.set(r.reg_number, [...(seen.get(r.reg_number) ?? []), i]))
  for (const [reg, idx] of seen) {
    if (idx.length < 2) continue
    const rowsList = idx.map((i) => out[i].row).join(', ')
    for (const i of idx) out[i].problems.push(`${reg} appears more than once in the file (rows ${rowsList})`)
  }

  for (const r of out) {
    const existing = input.existing[r.reg_number]
    if (existing) r.existing = existing
    if (r.problems.length) r.action = 'reject'
    else if (existing) {
      if (existing.status === 'approved') {
        r.action = 'skip'
        r.note = 'Already approved in the register; change it from its record page if needed'
      } else if (input.duplicates === 'update') {
        r.action = 'update'
        r.note = 'Updates the pending record already in the register'
      } else {
        r.action = 'skip'
        r.note = 'Already in the register (pending)'
      }
    }
  }

  const counts: Record<RowAction, number> = { create: 0, update: 0, skip: 0, reject: 0 }
  for (const r of out) counts[r.action]++
  return {
    rows: out,
    unresolvedProgrammes: [...unresolvedProg.values()].sort((a, b) => b.rows - a.rows),
    unresolvedClasses: [...unresolvedClass.values()].sort((a, b) => b.rows - a.rows),
    counts,
    blank,
  }
}

export const choiceKey = key

/** Finds the heading row: the first of the top 20 rows with at least two recognisable headings. */
export function findHeadingRow(rows: Cell[][], score: (cells: string[]) => number): number {
  let best = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const s = score((rows[i] ?? []).map(cellText))
    if (s > bestScore) {
      best = i
      bestScore = s
    }
    if (s >= 3) return i
  }
  return bestScore >= 2 ? best : 0
}
