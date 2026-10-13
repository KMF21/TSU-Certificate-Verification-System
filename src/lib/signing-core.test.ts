import { describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair } from 'jose'
import { claimsFor, claimsMatchCredential, publicJwkOf, signClaims, verifyToken, type SigningKey } from './signing-core'
import { SAMPLE_CREDENTIALS } from './sample-data'
import { DEMO_KEY_ID, DEMO_PRIVATE_JWK } from './keys/demo-key'

const demoKey: SigningKey = { kid: DEMO_KEY_ID, privateJwk: { ...DEMO_PRIVATE_JWK } }
const credential = SAMPLE_CREDENTIALS[0]

async function otherKey(kid: string): Promise<SigningKey> {
  const { privateKey } = await generateKeyPair('Ed25519', { extractable: true })
  return { kid, privateJwk: await exportJWK(privateKey) }
}

describe('certificate signing', () => {
  it('verifies a token signed by a published key', async () => {
    const token = await signClaims(claimsFor(credential), demoKey)
    const result = await verifyToken(token, [publicJwkOf(demoKey)])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.kid).toBe(DEMO_KEY_ID)
      expect(claimsMatchCredential(result.claims, credential)).toBe(true)
    }
  })

  it('rejects a token whose payload was altered', async () => {
    const token = await signClaims(claimsFor(credential), demoKey)
    const [header, , signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...claimsFor(credential), c: 'First Class Honours (forged)' })).toString('base64url')
    const result = await verifyToken(`${header}.${forged}.${signature}`, [publicJwkOf(demoKey)])
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' })
  })

  it('rejects a token signed by a key that claims a published kid', async () => {
    const impostor = await otherKey(DEMO_KEY_ID)
    const token = await signClaims(claimsFor(credential), impostor)
    const result = await verifyToken(token, [publicJwkOf(demoKey)])
    expect(result).toMatchObject({ ok: false, reason: 'bad-signature' })
  })

  it('reports an unpublished key id', async () => {
    const stranger = await otherKey('not-tsu')
    const token = await signClaims(claimsFor(credential), stranger)
    const result = await verifyToken(token, [publicJwkOf(demoKey)])
    expect(result).toMatchObject({ ok: false, reason: 'unknown-key', kid: 'not-tsu' })
  })

  it('rejects garbage', async () => {
    expect(await verifyToken('not-a-token', [publicJwkOf(demoKey)])).toMatchObject({ ok: false, reason: 'malformed' })
  })

  it('detects claims that no longer match the record', async () => {
    const token = await signClaims(claimsFor(SAMPLE_CREDENTIALS[4]), demoKey)
    const result = await verifyToken(token, [publicJwkOf(demoKey)])
    expect(result.ok).toBe(true)
    if (result.ok) expect(claimsMatchCredential(result.claims, SAMPLE_CREDENTIALS[5])).toBe(false)
  })

  it('never publishes the private part of a key', () => {
    expect(publicJwkOf(demoKey)).not.toHaveProperty('d')
  })
})
