'use server'

import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { canWrite } from '@/lib/admin/roles'
import type { Existing } from '@/lib/admin/import/build'

const UUID = /^[0-9a-f-]{36}$/i
const MAX_ROWS = 10000

/** Which of these registration numbers are already in the register. */
export async function lookupExistingAction(regs: string[]): Promise<{ existing: Record<string, Existing>; error?: string }> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !canWrite(profile.role)) return { existing: {}, error: 'Your role can’t upload records.' }
  const list = [...new Set((Array.isArray(regs) ? regs : []).map(String).filter((r) => /^[A-Z0-9][A-Z0-9/.-]{2,39}$/.test(r)))].slice(0, MAX_ROWS)
  const existing: Record<string, Existing> = {}
  for (let i = 0; i < list.length; i += 300) {
    const { data, error } = await supabase.from('graduates').select('id, reg_number, full_name, status').in('reg_number', list.slice(i, i + 300))
    if (error) return { existing, error: friendlyDbError(error) }
    for (const g of data ?? []) existing[g.reg_number] = { id: g.id, full_name: g.full_name, status: g.status }
  }
  return { existing }
}

export interface CommitRow {
  row: number
  action: 'create' | 'update'
  full_name: string
  reg_number: string
  programme_id: string
  cgpa: number | null
  class_id: string | null
  remark: string | null
  graduation_session: string | null
  senate_approval_date: string | null
}

export interface CommitInput {
  fileName: string
  source: 'live' | 'legacy'
  rows: CommitRow[]
  mapping: Record<string, string>
  shared: Record<string, string>
  report: { row: number; reg_number: string; full_name: string; outcome: 'skipped' | 'rejected'; reason: string }[]
}

export async function commitImportAction(input: CommitInput): Promise<{ batchId?: string; error?: string }> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !canWrite(profile.role)) return { error: 'Your role can’t upload records.' }
  if (input.source !== 'live' && input.source !== 'legacy') return { error: 'Choose whether these are live or legacy records.' }
  const rows = Array.isArray(input.rows) ? input.rows : []
  if (!rows.length) return { error: 'There are no rows ready to import.' }
  if (rows.length > MAX_ROWS) return { error: `Upload at most ${MAX_ROWS.toLocaleString('en-GB')} records at a time. Split the file and try again.` }
  const report = (Array.isArray(input.report) ? input.report : []).slice(0, 5000)
  const { data, error } = await supabase.rpc('commit_import', {
    p_file_name: String(input.fileName ?? 'upload').slice(0, 255),
    p_source: input.source,
    p_rows: rows.map((r) => ({
      row: String(r.row),
      action: r.action === 'update' ? 'update' : 'create',
      full_name: r.full_name,
      reg_number: r.reg_number,
      programme_id: r.programme_id,
      cgpa: r.cgpa == null ? '' : String(r.cgpa),
      class_id: r.class_id ?? '',
      remark: r.remark ?? '',
      graduation_session: r.graduation_session ?? '',
      senate_approval_date: r.senate_approval_date ?? '',
    })),
    p_column_mapping: input.mapping ?? {},
    p_shared_values: input.shared ?? {},
    p_report: report,
    p_skipped: report.filter((r) => r.outcome === 'skipped').length,
    p_rejected: report.filter((r) => r.outcome === 'rejected').length,
  })
  if (error) {
    if (/statement timeout/i.test(error.message)) return { error: 'The upload took too long. Split the file into smaller parts (for example 3,000 rows each) and try again.' }
    return { error: friendlyDbError(error) }
  }
  revalidatePath('/admin', 'layout')
  return { batchId: data as string }
}

export async function undoImportAction(input: { batchId: string; reason: string }): Promise<{ ok?: string; error?: string }> {
  const { supabase, profile } = await requireStaff()
  if (!profile || profile.role !== 'admin') return { error: 'Only an Admin can undo an upload.' }
  if (!UUID.test(input.batchId ?? '')) return { error: 'Upload not found.' }
  if ((input.reason ?? '').trim().length < 5) return { error: 'Give a reason for undoing this upload (at least 5 characters).' }
  const { data, error } = await supabase.rpc('undo_import', { p_batch_id: input.batchId, p_reason: input.reason.trim() })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin', 'layout')
  return { ok: `Upload undone. ${data} new record${data === 1 ? '' : 's'} removed and any updated records restored.` }
}
