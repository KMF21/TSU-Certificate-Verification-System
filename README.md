# TSU Certificate Verification System

The official service for confirming that a Taraba State University, Jalingo certificate is genuine. Anyone can scan the QR code printed on a certificate, or enter its serial and matric numbers, and see the graduate's record as the University Registry holds it.

Built and managed by [KMFenterprise](https://www.kmfenterprise.ng).

## Status

**Graduation Records Register, stage 1 of 5: database and roles (applied to Supabase).**

Next: staff interface and single entry → bulk upload → filtered downloads → public verification connection.
The staff screens on this branch still target the earlier model and are rebuilt in stage 2.

The full requirements live in the shared requirements document.

## How a certificate is verified

Each QR code holds a link to `https://<site>/c/<verify-code>#<signed-token>`.

- Any phone camera opens the official record page for `<verify-code>`.
- The part after `#` is a compact JWS signed with TSU's Ed25519 key, carrying the printed details (serial, matric, name, award, class, date). Browsers never send it to the server, so the page posts it to `/api/verify-token`, which checks it against the published keys and the current record.
- TSU's public keys are published at `/.well-known/tsu-keys.json`. Retired keys stay published so older certificates keep verifying.
- The in-page scanner also checks QR codes that point to other websites, so a lookalike verification site can't vouch for a forged certificate.

## Database: Graduation Records Register

The register is the single source of truth for graduates, starting with the College of Postgraduate Studies. Migrations live in `supabase/migrations` and run in filename order:

| Migration | What it does |
| --- | --- |
| `20261030120000_graduation_register.sql` | Tables, row-level security, audit trail, workflow and public lookup functions |
| `20261030120100_sample_reference_data.sql` | Class list and the CPGS 2025/2026 programme list, **flagged as sample** until CPGS vets it |
| `20261030121500_performance_fixes.sql` | Policy and index tuning from the Supabase advisor |

`supabase/seed/sample_records.sql` adds 40 fictional records for testing; `supabase/seed/remove_sample_records.sql` removes them.

### Roles

All staff sign in with two-factor authentication. Without it the database shows them nothing.

| | Viewer | Records Officer | Admin |
| --- | --- | --- | --- |
| Search, view, export (exports always logged) | Yes | Yes | Yes |
| Add or edit pending records, upload files | | Yes | Yes |
| Edit an approved record (reason required) | | Yes | Yes |
| Approve or verify records they didn't enter or last edit | | Yes | Yes |
| Delete records, undo imports, manage staff and reference data | | | Yes |

### Public lookups

Anonymous visitors have no database access. The website's server calls `lookup_by_code` (QR code or link) and `lookup_by_reg_and_surname`, which rate-limit each address (10 a minute, 100 a day), log the attempt and return only: name, programme, level, faculty, class, session, Senate date and certificate serial. Results are `verified`, `under_review` (legacy records not yet verified) or `not_found`.

### Tests

```bash
PGHOST=<socket dir> PGPORT=<port> supabase/tests/run.sh
```

Runs every migration and the sample seed on a scratch Postgres 16+ with a small Supabase stand-in, then checks roles, two-factor, the two-person rule, approved-record edits, imports and undo, public lookup results, rate limiting and the append-only audit log.

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
