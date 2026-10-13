import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { createServiceClient, hasServiceRole } from './supabase/service'

export type VerificationChannel = 'qr' | 'link' | 'details' | 'token'
export type VerificationResult = 'verified' | 'revoked' | 'superseded' | 'not_found'
export type SignatureOutcome = 'valid' | 'invalid' | 'unknown_key' | 'stale'

/**
 * Records one verification attempt for fraud analytics. IP addresses are stored only as a
 * salted hash. Logging never blocks or breaks a verification.
 */
export async function logVerification(event: {
  channel: VerificationChannel
  code: string | null
  result: VerificationResult
  signature?: SignatureOutcome
}) {
  if (!hasServiceRole()) return
  try {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
    const salt = process.env.VERIFY_LOG_SALT ?? 'tsu-verify'
    await createServiceClient().from('verification_events').insert({
      channel: event.channel,
      code_tried: event.code?.slice(0, 64) ?? null,
      result: event.result,
      signature: event.signature ?? null,
      country: h.get('x-vercel-ip-country')?.slice(0, 2) ?? null,
      user_agent: h.get('user-agent')?.slice(0, 200) ?? null,
      ip_hash: ip ? createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32) : null,
    })
  } catch {
    // Analytics only.
  }
}

export function resultFor(status: 'approved' | 'revoked' | 'superseded' | undefined): VerificationResult {
  return status === 'approved' ? 'verified' : status ?? 'not_found'
}
