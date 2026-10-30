export interface AuditEntry {
  id: number
  at: string
  actor_id: string | null
  action: string
  table_name: string
  row_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  details: Record<string, unknown> | null
}

export const AUDIT_TABLES: Record<string, string> = {
  graduates: 'Records',
  import_batches: 'Uploads',
  profiles: 'Staff accounts',
  programmes: 'Programmes',
  departments: 'Departments',
  faculties: 'Faculties',
  degree_classes: 'Degree classes',
  export_presets: 'Export presets',
}

const ACTION_LABEL: Record<string, string> = {
  insert: 'Created',
  update: 'Edited',
  delete: 'Deleted',
  approve: 'Approved',
  verify: 'Verified',
  edit_approved: 'Edited after approval',
  import: 'Uploaded',
  undo_import: 'Upload undone',
  export: 'Exported',
}

const FIELD_LABEL: Record<string, string> = {
  full_name: 'name',
  reg_number: 'reg. number',
  programme_id: 'programme',
  class_id: 'class',
  cgpa: 'CGPA',
  remark: 'remark',
  graduation_session: 'session',
  senate_approval_date: 'Senate date',
  status: 'status',
  verification_status: 'verification',
  certificate_serial: 'serial',
  role: 'role',
  active: 'active',
  name: 'name',
  label: 'label',
  award_title: 'award',
  sort_order: 'order',
}

// Fields that change as a side effect and would only add noise.
const QUIET = new Set([
  'updated_at', 'created_at', 'updated_by', 'surname_key', 'approved_at', 'approved_by', 'verified_at', 'verified_by',
  'verify_code', 'key_id', 'import_batch_id',
])

export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/_/g, ' ')

/** Field changes in one entry, as [label, before, after]. IDs are resolved by the caller via `name`. */
export function changedFields(e: AuditEntry, name: (field: string, value: unknown) => string = (_f, v) => fmt(v)): [string, string, string][] {
  if (!e.before || !e.after) return []
  return Object.keys(e.after)
    .filter((k) => !QUIET.has(k) && JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k]))
    .map((k) => [FIELD_LABEL[k] ?? k.replace(/_/g, ' '), name(k, e.before?.[k]), name(k, e.after?.[k])])
}

export function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'empty'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return String(v)
}

/** One-line description of an entry for the audit list. */
export function summarise(e: AuditEntry): string {
  const a = e.after ?? e.before ?? {}
  const label = (a.full_name ?? a.name ?? a.label ?? a.file_name ?? a.code ?? '') as string
  const reg = a.reg_number ? ` (${a.reg_number})` : ''
  if (e.action === 'export') {
    const d = e.details ?? {}
    return `${fmt(d.rows)} records to ${String(d.format ?? '').toUpperCase()}`
  }
  const head = label ? `“${label}”${reg}` : ''
  if (e.action === 'update' || e.action === 'edit_approved') {
    const changes = changedFields(e)
      .slice(0, 3)
      .map(([f, b, c]) => `${f}: ${b} → ${c}`)
      .join('; ')
    return [head, changes].filter(Boolean).join(' · ')
  }
  return head
}
