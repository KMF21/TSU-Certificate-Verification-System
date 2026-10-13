import { getPublicKeys } from '@/lib/signing'

export const dynamic = 'force-dynamic'

/** TSU's published public signing keys (JWKS). Anyone can check a certificate token against these. */
export function GET() {
  return Response.json(
    { issuer: 'Taraba State University, Jalingo', keys: getPublicKeys() },
    { headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } },
  )
}
