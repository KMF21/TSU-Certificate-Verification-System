/**
 * DEMO SIGNING KEY — FOR PREVIEW AND TESTING ONLY.
 *
 * This key is public (it is in the repository), so anything it signs proves nothing.
 * It exists so preview deployments work before the production key is set up.
 * `getSigningKey()` refuses to use it when TSU_ENV=production; production signing
 * uses TSU_SIGNING_PRIVATE_JWK (and, before launch, a cloud KMS).
 */
export const DEMO_KEY_ID = 'tsu-demo-2026'

export const DEMO_PRIVATE_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'mQ5tBd9mbFojTfZHr1wZ-S8-zVTiuUSJ8_bLsZixX60',
  d: 'se7yxgO88T-P0DODI0jyZblRdpgVeezloGnThAyuny8',
} as const
