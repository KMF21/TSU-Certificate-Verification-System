'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export interface SignInState {
  error?: string
  email?: string
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : ''
  return value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin'
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!isSupabaseConfigured) return { email, error: 'The staff area is not connected to the database yet.' }
  if (!email || !password) return { email, error: 'Enter your email address and password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { email, error: 'That email address and password don’t match a staff account.' }

  redirect(`/admin/two-factor?next=${encodeURIComponent(safeNext(formData.get('next')))}`)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
