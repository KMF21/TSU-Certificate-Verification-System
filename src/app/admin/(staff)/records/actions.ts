'use server'

import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { canWrite, isValidSession } from '@/lib/admin/roles'
import { getSigningKey } from '@/lib/signing'
import { lagosToday, normaliseReg, validateRecord, type FieldErrors, type RecordInput } from '@/lib/admin/record-input'

export interface BulkResult {
  ok?: string
  error?: string
}

const UUID = /^[0-9a-f-]{36}$/i

async function writer() {
  const session = await requireStaff()
  if (!session.profile || !canWrite(session.profile.role)) throw new Error('Your role can’t approve or verify records.')
  return session
}

function ids(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  return [...new Set(list.map(String).filter((s) => UUID.test(s)))]
}

export async function approveRecordsAction(input: { ids: string[]; senateDate: string; session?: string }): Promise<BulkResult> {
  try {
    const { supabase } = await writer()
    const list = ids(input.ids)
    if (!list.length) return { error: 'Select at least one pending record.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.senateDate ?? '')) return { error: 'Enter the Senate approval date.' }
    const session = input.session?.trim() || null
    if (session && !isValidSession(session)) return { error: 'Write the session as two consecutive years, like 2024/2025.' }
    const { data, error } = await supabase.rpc('approve_records', {
      p_ids: list,
      p_senate_approval_date: input.senateDate,
      p_graduation_session: session,
      p_key_id: getSigningKey().kid,
    })
    if (error) return { error: friendlyDbError(error) }
    revalidatePath('/admin', 'layout')
    return { ok: `${data} record${data === 1 ? '' : 's'} approved.` }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

export async function verifyRecordsAction(input: { ids: string[] }): Promise<BulkResult> {
  try {
    const { supabase } = await writer()
    const list = ids(input.ids)
    if (!list.length) return { error: 'Select at least one unverified legacy record.' }
    const { data, error } = await supabase.rpc('verify_records', { p_ids: list })
    if (error) return { error: friendlyDbError(error) }
    revalidatePath('/admin', 'layout')
    return { ok: `${data} record${data === 1 ? '' : 's'} marked as verified.` }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// ------------------------------------------------------------- single records

export interface SaveResult {
  ok?: boolean
  id?: string
  message?: string
  error?: string
  errors?: FieldErrors
}

/** Is this registration number already in the register? Used while typing. */
export async function checkRegAction(reg: string, excludeId?: string): Promise<{ taken: { id: string; full_name: string; status: string } | null }> {
  const { supabase, profile } = await requireStaff()
  const value = normaliseReg(reg ?? '')
  if (!profile || value.length < 3) return { taken: null }
  let q = supabase.from('graduates').select('id, full_name, status').eq('reg_number', value).limit(1)
  if (excludeId && UUID.test(excludeId)) q = q.neq('id', excludeId)
  const { data } = await q.maybeSingle()
  return { taken: data ?? null }
}

export async function saveRecordAction(input: { id?: string; record: RecordInput; reason?: string }): Promise<SaveResult> {
  let session
  try {
    session = await writer()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const { supabase } = session
  const { values, errors } = validateRecord(input.record, lagosToday())
  if (!values) return { errors, error: 'Check the highlighted fields.' }

  const { data: programme } = await supabase.from('programmes').select('id, level, active').eq('id', values.programme_id).maybeSingle()
  if (!programme) return { errors: { programme_id: 'That programme no longer exists.' } }
  if (values.class_id) {
    const { data: cls } = await supabase.from('degree_classes').select('level').eq('id', values.class_id).maybeSingle()
    if (!cls) return { errors: { class_id: 'That class no longer exists.' } }
    if (cls.level && cls.level !== programme.level) return { errors: { class_id: 'That class doesn’t apply to this programme’s level.' } }
  }

  const { source, ...fields } = values

  // New record: always lands as pending.
  if (!input.id) {
    const { taken } = await checkRegAction(values.reg_number)
    if (taken) return { errors: { reg_number: `Already in the register for ${taken.full_name}.` } }
    const { data, error } = await supabase.from('graduates').insert({ ...fields, source, status: 'pending' }).select('id').single()
    if (error) return error.code === '23505' ? { errors: { reg_number: 'That registration number is already in the register.' } } : { error: friendlyDbError(error) }
    revalidatePath('/admin', 'layout')
    return { ok: true, id: data.id, message: `${values.full_name} (${values.reg_number}) saved as pending.` }
  }

  if (!UUID.test(input.id)) return { error: 'Record not found.' }
  const { data: current } = await supabase
    .from('graduates')
    .select('id, status, full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session, senate_approval_date')
    .eq('id', input.id)
    .maybeSingle()
  if (!current) return { error: 'Record not found.' }
  const { taken } = await checkRegAction(values.reg_number, input.id)
  if (taken) return { errors: { reg_number: `Already in the register for ${taken.full_name}.` } }

  if (current.status === 'pending') {
    const { data, error } = await supabase.from('graduates').update(fields).eq('id', input.id).select('id')
    if (error) return { error: friendlyDbError(error) }
    if (!data?.length) return { error: 'This record was approved by someone else in the meantime. Reload the page to edit it with a reason.' }
  } else {
    const reason = (input.reason ?? '').trim()
    if (reason.length < 5) return { error: 'Give a reason for changing an approved record (at least 5 characters).', errors: {} }
    const changes: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fields)) {
      const was = (current as Record<string, unknown>)[k]
      const same = k === 'cgpa' ? (was == null ? null : Number(was)) === v : (was ?? null) === v
      if (!same) changes[k] = v
    }
    if (!Object.keys(changes).length) return { ok: true, id: input.id, message: 'Nothing changed.' }
    const { error } = await supabase.rpc('update_approved_record', { p_id: input.id, p_changes: changes, p_reason: reason })
    if (error) return { error: friendlyDbError(error) }
  }
  revalidatePath('/admin', 'layout')
  return { ok: true, id: input.id, message: 'Changes saved.' }
}

export async function deleteRecordAction(input: { id: string; reason: string }): Promise<BulkResult> {
  const { supabase, profile } = await requireStaff()
  if (!profile || profile.role !== 'admin') return { error: 'Only an Admin can delete records.' }
  if (!UUID.test(input.id)) return { error: 'Record not found.' }
  if ((input.reason ?? '').trim().length < 5) return { error: 'Give a reason for deleting this record (at least 5 characters).' }
  const { error } = await supabase.rpc('delete_record', { p_id: input.id, p_reason: input.reason.trim() })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin', 'layout')
  return { ok: 'Record deleted.' }
}
