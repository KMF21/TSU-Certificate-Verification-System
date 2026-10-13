import { findBySerial } from '@/lib/credentials'
import { claimsMatchCredential } from '@/lib/signing-core'
import { verifyCertificateToken } from '@/lib/signing'
import type { SignatureCheckResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MAX_TOKEN_LENGTH = 2048

/**
 * Checks a QR token's TSU signature and whether it still matches the register.
 * The token travels in the URL fragment, which browsers never send to a server,
 * so the result page posts it here explicitly.
 * TODO(phase-1): rate limit (Upstash) and log to verification_events.
 */
export async function POST(request: Request) {
  let body: { token?: unknown; code?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const code = typeof body.code === 'string' ? body.code : null
  if (!token || token.length > MAX_TOKEN_LENGTH) return Response.json({ error: 'Invalid request' }, { status: 400 })

  const verification = await verifyCertificateToken(token)
  let result: SignatureCheckResult

  if (!verification.ok) {
    result =
      verification.reason === 'unknown-key'
        ? { state: 'unknown-key', keyId: verification.kid ?? '' }
        : { state: 'invalid', reason: verification.reason }
  } else {
    const record = await findBySerial(verification.claims.s)
    const matchesRecord =
      !!record && claimsMatchCredential(verification.claims, record) && (code === null || code === record.verifyCode)
    result = { state: 'valid', matchesRecord, verifyCode: record?.verifyCode ?? null, keyId: verification.kid }
  }

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
