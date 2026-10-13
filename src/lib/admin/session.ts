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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, active')
    .eq('user_id', user.id)
    .maybeSingle<StaffProfile>()
  return { supabase, user, profile: profile && profile.active ? profile : null }
})

/** Turns a Postgres error from a workflow function into a sentence for staff. */
export function friendlyDbError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Something went wrong.'
  if (error.code === '42501' || /permission denied/i.test(error.message ?? '')) {
    return error.message && !/permission denied/i.test(error.message) ? error.message : 'Your role doesn’t allow that.'
  }
  if (error.code === '23505') return 'That would create a duplicate record.'
  return error.message ?? 'Something went wrong.'
}
