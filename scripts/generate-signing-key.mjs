// Generates a new Ed25519 signing key for TSU certificate QR codes.
// Usage: pnpm keys:generate [key-id]
// Put the private JWK in TSU_SIGNING_PRIVATE_JWK (server-only secret). Never commit it.
import { exportJWK, generateKeyPair } from 'jose'

const kid = process.argv[2] ?? `tsu-${new Date().getFullYear()}-1`
const { privateKey } = await generateKeyPair('Ed25519', { extractable: true })
const jwk = { ...(await exportJWK(privateKey)), kid }
const { d, ...publicJwk } = jwk

console.log('\nTSU_SIGNING_PRIVATE_JWK (secret, server only):')
console.log(JSON.stringify(jwk))
console.log('\nPublic key (published automatically at /.well-known/tsu-keys.json):')
console.log(JSON.stringify(publicJwk))
console.log()
