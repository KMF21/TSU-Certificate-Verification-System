import 'server-only'
import type { JWK } from 'jose'
import { DEMO_KEY_ID, DEMO_PRIVATE_JWK } from './keys/demo-key'
import { claimsFor, publicJwkOf, signClaims, verifyToken, type SigningKey } from './signing-core'
import type { Credential } from './types'

export const isProduction = process.env.TSU_ENV === 'production'

/**
 * The active signing key. Production must supply TSU_SIGNING_PRIVATE_JWK
 * (a private Ed25519 JWK with a `kid`); previews fall back to the public demo key.
 */
export function getSigningKey(): SigningKey {
  const raw = process.env.TSU_SIGNING_PRIVATE_JWK
  if (raw) {
    const jwk = JSON.parse(raw) as JWK & { kid?: string }
    if (!jwk.kid) throw new Error('TSU_SIGNING_PRIVATE_JWK must include a kid')
    return { kid: jwk.kid, privateJwk: jwk }
  }
  if (isProduction) throw new Error('TSU_SIGNING_PRIVATE_JWK is required when TSU_ENV=production')
  return { kid: DEMO_KEY_ID, privateJwk: { ...DEMO_PRIVATE_JWK } }
}

/** Retired public keys stay published so older certificates keep verifying. */
function retiredPublicKeys(): JWK[] {
  const raw = process.env.TSU_RETIRED_PUBLIC_JWKS
  return raw ? (JSON.parse(raw) as JWK[]) : []
}

export function getPublicKeys(): JWK[] {
  const keys = [publicJwkOf(getSigningKey()), ...retiredPublicKeys()]
  // The demo key is only ever trusted outside production.
  return isProduction ? keys.filter((k) => k.kid !== DEMO_KEY_ID) : keys
}

export async function signCredential(c: Credential): Promise<string> {
  return signClaims(claimsFor(c), getSigningKey())
}

export async function verifyCertificateToken(token: string) {
  return verifyToken(token, getPublicKeys())
}
