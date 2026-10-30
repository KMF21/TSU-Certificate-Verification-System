import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import type { AppRole } from './roles'

export interface StaffProfile {
  user_id: string
  full_name: string
  email: string
  role: AppRole
  active: boolean
}

/** The signed-in staff member, or a redirect. Cached per request. */
export const requireStaff = cache(async () => {
  if (!isSupabaseConfigured) redirect('/admin/login')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, active')
    .eq('user_id', user.id)
    .maybeSingle<StaffProfile>()
  return { supabase, user, profile: profile && profile.active ? profile : null }
})

/** The signed-in staff member with a role, or a redirect to the overview. */
export async function requireRole(allowed: AppRole[]) {
  const session = await requireStaff()
  if (!session.profile || !allowed.includes(session.profile.role)) redirect('/admin')
  return session as typeof session & { profile: StaffProfile }
}

/** Turns a database error into a sentence for staff. Workflow functions already raise plain-language messages. */
export function friendlyDbError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Something went wrong. Try again.'
  const msg = error.message ?? ''
  if (/row-level security|permission denied/i.test(msg)) return 'Your role doesn’t allow that.'
  if (error.code === '23505') {
    if (/reg_number/.test(msg)) return 'That registration number is already in the register.'
    return 'That would create a duplicate.'
  }
  if (error.code === '23514' && !/Senate approval date/.test(msg)) return 'One of the values is outside what the register accepts.'
  return msg || 'Something went wrong. Try again.'
}
