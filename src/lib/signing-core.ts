import {
  CompactSign,
  compactVerify,
  createLocalJWKSet,
  decodeProtectedHeader,
  importJWK,
  type JWK,
} from 'jose'
import type { CertificateClaims, Credential } from './types'

export const SIGNING_ALG = 'Ed25519'
export const TOKEN_TYPE = 'tsu-cert+jws'

export interface SigningKey {
  kid: string
  privateJwk: JWK
}

export function fullNameOf(c: Pick<Credential, 'surname' | 'otherNames'>): string {
  return `${c.surname.toUpperCase()}, ${c.otherNames}`
}

/** The exact printed facts a QR token vouches for. */
export function claimsFor(c: Credential): CertificateClaims {
  return {
    s: c.serialNo,
    m: c.matricNo,
    n: fullNameOf(c),
    a: `${c.award} ${c.programme}`,
    c: c.classOfDegree ?? '',
    d: c.dateOfAward,
  }
}

export function claimsMatchCredential(claims: CertificateClaims, c: Credential): boolean {
  const expected = claimsFor(c)
  return (Object.keys(expected) as (keyof CertificateClaims)[]).every((k) => expected[k] === claims[k])
}

export function publicJwkOf(key: SigningKey): JWK {
  const { d: _private, ...pub } = key.privateJwk
  void _private
  return { ...pub, kid: key.kid, alg: SIGNING_ALG, use: 'sig' }
}

export async function signClaims(claims: CertificateClaims, key: SigningKey): Promise<string> {
  const privateKey = await importJWK({ ...key.privateJwk, kid: key.kid }, SIGNING_ALG)
  const payload = new TextEncoder().encode(JSON.stringify(claims))
  return new CompactSign(payload)
    .setProtectedHeader({ alg: SIGNING_ALG, kid: key.kid, typ: TOKEN_TYPE })
    .sign(privateKey)
}

export type TokenVerification =
  | { ok: true; claims: CertificateClaims; kid: string }
  | { ok: false; reason: 'malformed' | 'unknown-key' | 'bad-signature'; kid?: string }

export async function verifyToken(token: string, publicKeys: JWK[]): Promise<TokenVerification> {
  let kid: string | undefined
  try {
    const header = decodeProtectedHeader(token)
    kid = header.kid
    if (header.alg !== SIGNING_ALG || header.typ !== TOKEN_TYPE || !kid) return { ok: false, reason: 'malformed', kid }
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (!publicKeys.some((k) => k.kid === kid)) return { ok: false, reason: 'unknown-key', kid }

  try {
    const jwks = createLocalJWKSet({ keys: publicKeys })
    const { payload } = await compactVerify(token, jwks, { algorithms: [SIGNING_ALG] })
    const claims = JSON.parse(new TextDecoder().decode(payload)) as CertificateClaims
    if (typeof claims?.s !== 'string' || typeof claims?.m !== 'string') return { ok: false, reason: 'malformed', kid }
    return { ok: true, claims, kid }
  } catch {
    return { ok: false, reason: 'bad-signature', kid }
  }
}
