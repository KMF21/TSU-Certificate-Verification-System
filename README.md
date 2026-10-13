# TSU Certificate Verification System

The official service for confirming that a Taraba State University, Jalingo certificate is genuine. Anyone can scan the QR code printed on a certificate, or enter its serial and matric numbers, and see the graduate's record as the University Registry holds it.

Built and managed by [KMFenterprise](https://www.kmfenterprise.ng).

## Status

**Phase 1, slice 2: the register and the approval workflow.**

| Done | Next (slice 3) |
| --- | --- |
| Public site: QR scanner, manual check, result page, signed QR tokens | Print file and proof sheet export |
| Supabase register: schema, row-level security, append-only audit log | Corrections, revocation and reissue |
| Staff sign-in with mandatory two-factor (TOTP) | Rate limiting on public lookups |
| Roles: Records Officer, CPGS Records Officer, Registrar, Auditor, Super Admin | Production signing key in a cloud KMS |
| Excel/CSV import with row-by-row checks, all or nothing | |
| Maker-checker: submit, approve (issues serials and codes) or return | |
| Programme list import, staff accounts, audit log viewer | |
| Verification event logging (hashed IPs) | |

The full requirements live in the shared requirements document.

## How a certificate is verified

Each QR code holds a link to `https://<site>/c/<verify-code>#<signed-token>`.

- Any phone camera opens the official record page for `<verify-code>`.
- The part after `#` is a compact JWS signed with TSU's Ed25519 key, carrying the printed details (serial, matric, name, award, class, date). Browsers never send it to the server, so the page posts it to `/api/verify-token`, which checks it against the published keys and the current record.
- TSU's public keys are published at `/.well-known/tsu-keys.json`. Retired keys stay published so older certificates keep verifying.
- The in-page scanner also checks QR codes that point to other websites, so a lookalike verification site can't vouch for a forged certificate.

## Database

Migrations live in `supabase/migrations` and run in filename order. They are tested on plain Postgres 16 with a small Supabase stand-in:

```bash
PGHOST=<socket dir> PGPORT=<port> supabase/tests/run.sh
```

The tests cover the maker-checker rule, all-or-nothing imports, separate undergraduate (`TSU/2025/000001`) and postgraduate (`TSU/PG/2025/000001`) serials, two-factor-only staff access, anonymous access limited to the two lookup functions, and the append-only audit log.

### First-time setup on Supabase

1. Apply the three migrations in order (SQL editor, or the Supabase CLI).
2. Check **Authentication → Multi-Factor** has TOTP enabled.
3. Create the first Super Admin with `supabase/bootstrap_super_admin.sql`.
4. Sign in at `/admin`, set up two-factor, load the programme list, then create the other staff accounts.

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
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and anon (publishable) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Creates staff accounts, logs verifications, checks QR tokens. |
| `VERIFY_LOG_SALT` | Random string used to hash visitor IP addresses in the verification log. |

Previews without `TSU_SIGNING_PRIVATE_JWK` use a demo key that is committed to this repository. Anything it signs proves nothing, which is why production refuses it.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `jose` for signing, `qrcode` for generation, `@zxing/browser` for scanning, Supabase (Postgres, Auth with TOTP), ExcelJS, pnpm.
