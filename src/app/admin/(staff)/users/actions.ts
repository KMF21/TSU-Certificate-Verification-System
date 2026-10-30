'use server'

import { randomInt } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { isAdmin, ROLE_LABEL, type AppRole } from '@/lib/admin/roles'
import { createServiceClient, hasServiceRole } from '@/lib/supabase/service'

export interface AccountState {
  error?: string
  created?: { email: string; password: string; name: string; reset?: boolean }
}

const ROLES = Object.keys(ROLE_LABEL) as AppRole[]

/** A temporary password that reads clearly when said aloud or typed from paper. */
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const part = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')
  return `${part()}-${part()}-${part()}-${part()}`
}

async function guard() {
  const session = await requireStaff()
  if (!session.profile || !isAdmin(session.profile.role)) throw new Error('Only an Admin can manage staff accounts.')
  if (!hasServiceRole()) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server.')
  return session
}

export async function createAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  let session
  try {
    session = await guard()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const name = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? '') as AppRole
  if (name.length < 2) return { error: 'Enter the person’s full name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (!ROLES.includes(role)) return { error: 'Choose a role.' }

  const admin = createServiceClient()
  const password = temporaryPassword()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } })
  if (error || !data.user) {
    return { error: /already/i.test(error?.message ?? '') ? 'An account with that email address already exists.' : `The account could not be created. ${error?.message ?? ''}` }
  }

  // The role is set as the Admin, so the audit log records who granted it.
  const { error: roleError } = await session.supabase.rpc('save_staff_profile', {
    p_user_id: data.user.id, p_full_name: name, p_email: email, p_role: role, p_active: true,
  })
  if (roleError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: friendlyDbError(roleError) }
  }
  revalidatePath('/admin/users')
  return { created: { email, password, name } }
}

export async function updateAccountAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  let session
  try {
    session = await guard()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const userId = String(formData.get('user_id'))
  const role = String(formData.get('role')) as AppRole
  const active = formData.get('active') === 'on'
  if (!ROLES.includes(role)) return { error: 'Choose a role.' }
  const { data: current } = await session.supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle()
  if (!current) return { error: 'Account not found.' }
  const { error } = await session.supabase.rpc('save_staff_profile', {
    p_user_id: userId, p_full_name: current.full_name, p_email: current.email, p_role: role, p_active: active,
  })
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin/users')
  return {}
}

/** New temporary password and a fresh two-factor setup, for someone locked out or who lost their phone. */
export async function resetAccessAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  let session
  try {
    session = await guard()
  } catch (e) {
    return { error: (e as Error).message }
  }
  const userId = String(formData.get('user_id'))
  if (userId === session.user.id) return { error: 'Reset your own access through another Admin.' }
  const { data: current } = await session.supabase.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle()
  if (!current) return { error: 'Account not found.' }

  const admin = createServiceClient()
  const password = temporaryPassword()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: `Could not reset the password. ${error.message}` }
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId })
  for (const f of factors?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id })
  return { created: { email: current.email, password, name: current.full_name, reset: true } }
}
