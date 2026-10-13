# TSU Certificate Verification System

The official service for confirming that a Taraba State University, Jalingo certificate is genuine. Anyone can scan the QR code printed on a certificate, or enter its serial and matric numbers, and see the graduate's record as the University Registry holds it.

Built and managed by [KMFenterprise](https://www.kmfenterprise.ng).

## Status

**Phase 1, slice 1: design system and public verification pages, on sample data.**

| Done | Next |
| --- | --- |
| TSU design system (navy and crimson, Sora and Inter) | Supabase schema, RLS and the restricted public lookup function |
| Verify home: QR scanner (camera or photo) and manual check | Staff sign-in with 2FA, Excel import, maker-checker approval |
| Result page: Verified, Revoked, Replaced and Not found states | Print file and proof sheet export |
| Ed25519 signed QR tokens, public key endpoint, signature check | Rate limiting and verification event logging |
| `/demo` test bench with sample and hostile QR codes | Production signing key in a cloud KMS |

The full requirements live in the shared requirements document.

## How a certificate is verified

Each QR code holds a link to `https://<site>/c/<verify-code>#<signed-token>`.

- Any phone camera opens the official record page for `<verify-code>`.
- The part after `#` is a compact JWS signed with TSU's Ed25519 key, carrying the printed details (serial, matric, name, award, class, date). Browsers never send it to the server, so the page posts it to `/api/verify-token`, which checks it against the published keys and the current record.
- TSU's public keys are published at `/.well-known/tsu-keys.json`. Retired keys stay published so older certificates keep verifying.
- The in-page scanner also checks QR codes that point to other websites, so a lookalike verification site can't vouch for a forged certificate.

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000 and http://localhost:3000/demo for test certificates.

```bash
pnpm test        # signing and verification tests
pnpm typecheck
pnpm lint
pnpm build
```

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Origin printed in QR codes. Empty on previews to use the request host. |
| `TSU_SIGNING_PRIVATE_JWK` | Private Ed25519 JWK with `kid`. Generate with `pnpm keys:generate`. Secret. |
| `TSU_RETIRED_PUBLIC_JWKS` | JSON array of retired public keys. |
| `TSU_ENV` | `production` refuses the demo key and turns off `/demo`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase, wired in the next slice. |

Previews without `TSU_SIGNING_PRIVATE_JWK` use a demo key that is committed to this repository. Anything it signs proves nothing, which is why production refuses it.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `jose` for signing, `qrcode` for generation, `@zxing/browser` for scanning, Supabase (next slice), pnpm.
