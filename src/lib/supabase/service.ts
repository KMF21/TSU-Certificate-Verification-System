import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL } from './env'

/**
 * Service-role client. Bypasses row-level security, so it is only used for:
 * creating staff accounts, logging verification events, and reading the full
 * record behind a QR token to compare its signed details.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const hasServiceRole = () => Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
