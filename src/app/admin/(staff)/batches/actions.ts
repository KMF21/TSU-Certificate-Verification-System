'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { editableLevel, type AwardLevel } from '@/lib/admin/roles'
import { validateSheet, type Cell, type ImportProblem } from '@/lib/admin/import-rows'
import { MAX_UPLOAD_BYTES, readTable } from '@/lib/admin/spreadsheet'
import { getSigningKey } from '@/lib/signing'

export interface FormState {
  error?: string
  ok?: string
}

export interface ImportState extends FormState {
  problems?: ImportProblem[]
  fileName?: string
}

export async function createBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireStaff()
  const level = profile ? editableLevel(profile.role) : null
  if (!level) return { error: 'Only Records Officers can start batches.' }

  const title = String(formData.get('title') ?? '').trim()
  const session = String(formData.get('session') ?? '').trim()
  if (title.length < 3) return { error: 'Give the batch a name, such as “2025/2026 Convocation, Faculty of Science”.' }
  const m = session.match(/^(\d{4})\/(\d{4})$/)
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return { error: 'Enter the session as two consecutive years, such as 2024/2025.' }

  const { data, error } = await supabase.rpc('create_batch', { p_title: title, p_award_level: level, p_session: session })
  if (error) return { error: friendlyDbError(error) }
  redirect(`/admin/batches/${data}`)
}

export async function importRowsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, profile } = await requireStaff()
  const level = profile ? editableLevel(profile.role) : null
  const batchId = String(formData.get('batch_id') ?? '')
  const file = formData.get('file')
  if (!level) return { error: 'Only Records Officers can import records.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose the completed template to upload.' }
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'That file is over 5 MB. Split it into smaller files.' }

  const { data: batch } = await supabase.from('batches').select('award_level').eq('id', batchId).maybeSingle<{ award_level: AwardLevel }>()
  if (!batch) return { error: 'Batch not found.' }

  const { data: programmes } = await supabase.from('programmes').select('code').eq('award_level', batch.award_level).eq('active', true)
  const codes = new Set((programmes ?? []).map((p: { code: string }) => p.code))

  let table: Cell[][]
  try {
    table = await readTable(file)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The file could not be read.', fileName: file.name }
  }

  const { rows, problems } = validateSheet(table, { level: batch.award_level, programmeCodes: codes })
  if (problems.length) {
    return {
      fileName: file.name,
      problems,
      error: `Nothing was saved. Fix the ${problems.length === 1 ? 'problem' : `${problems.length} problems`} below and upload the file again.`,
    }
  }

  const { data: count, error } = await supabase.rpc('import_batch_rows', { p_batch_id: batchId, p_rows: rows })
  if (error) return { fileName: file.name, error: `Nothing was saved. ${friendlyDbError(error)}` }

  revalidatePath(`/admin/batches/${batchId}`)
  return { ok: `Added ${count} ${count === 1 ? 'record' : 'records'} from ${file.name}.` }
}

async function runRpc(fn: string, args: Record<string, unknown>, batchId: string): Promise<FormState> {
  const { supabase } = await requireStaff()
  const { error } = await supabase.rpc(fn, args)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath(`/admin/batches/${batchId}`)
  revalidatePath('/admin/batches')
  revalidatePath('/admin')
  return {}
}

export async function removeRecordAction(formData: FormData) {
  const batchId = String(formData.get('batch_id'))
  await runRpc('remove_draft_credential', { p_credential_id: String(formData.get('credential_id')) }, batchId)
}

export async function submitBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const batchId = String(formData.get('batch_id'))
  const result = await runRpc('submit_batch', { p_batch_id: batchId }, batchId)
  return result.error ? result : { ok: 'Sent to the Registrar for approval.' }
}

export async function approveBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const batchId = String(formData.get('batch_id'))
  if (formData.get('confirm') !== 'on') return { error: 'Tick the box to confirm you have checked this list against the Senate approval.' }
  const result = await runRpc('approve_batch', { p_batch_id: batchId, p_key_id: getSigningKey().kid }, batchId)
  return result.error ? result : { ok: 'Approved. Every record now has a serial number and a signed QR code.' }
}

export async function rejectBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const batchId = String(formData.get('batch_id'))
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 5) return { error: 'Say what needs fixing, so the Records Officer can correct it.' }
  const result = await runRpc('reject_batch', { p_batch_id: batchId, p_reason: reason }, batchId)
  return result.error ? result : { ok: 'Returned to the Records Officer with your note.' }
}

export async function deleteBatchAction(formData: FormData) {
  const batchId = String(formData.get('batch_id'))
  const result = await runRpc('delete_draft_batch', { p_batch_id: batchId }, batchId)
  if (!result.error) redirect('/admin/batches')
}
