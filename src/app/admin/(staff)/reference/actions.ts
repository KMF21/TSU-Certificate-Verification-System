'use server'

import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireRole } from '@/lib/admin/session'
import type { ProgrammeLevel } from '@/lib/admin/roles'

export interface RefResult {
  ok?: string
  error?: string
}

const LEVELS: ProgrammeLevel[] = ['pgd', 'masters', 'phd', 'undergraduate']
const UUID = /^[0-9a-f-]{36}$/i

export async function saveClassAction(input: { id?: string; label: string; level: string; sort_order: string; active: boolean }): Promise<RefResult> {
  const { supabase } = await requireRole(['admin'])
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ')
  if (label.length < 2 || label.length > 80) return { error: 'Enter a class name of 2 to 80 characters.' }
  const level = input.level ? (LEVELS.includes(input.level as ProgrammeLevel) ? (input.level as ProgrammeLevel) : undefined) : null
  if (level === undefined) return { error: 'Choose a level.' }
  const sort_order = Number.parseInt(input.sort_order, 10)
  if (!Number.isFinite(sort_order) || sort_order < 0 || sort_order > 1000) return { error: 'Order must be a whole number from 0 to 1000.' }
  const row = { label, level, sort_order, active: !!input.active }
  const { error } = input.id && UUID.test(input.id)
    ? await supabase.from('degree_classes').update(row).eq('id', input.id)
    : await supabase.from('degree_classes').insert(row)
  if (error) return { error: error.code === '23505' ? 'That class already exists for this level.' : friendlyDbError(error) }
  revalidatePath('/admin/reference')
  return { ok: input.id ? 'Class updated.' : 'Class added.' }
}

export async function setProgrammeActiveAction(input: { id: string; active: boolean }): Promise<RefResult> {
  const { supabase } = await requireRole(['admin'])
  if (!UUID.test(input.id)) return { error: 'Programme not found.' }
  const { error } = await supabase.from('programmes').update({ active: !!input.active }).eq('id', input.id)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin/reference')
  return { ok: input.active ? 'Programme shown in pickers again.' : 'Programme hidden from pickers. Existing records keep it.' }
}
