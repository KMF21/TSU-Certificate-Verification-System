import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, CircleX, FlaskConical, Mail, Replace, ScanLine, SearchX } from 'lucide-react'
import clsx from 'clsx'
import { findByVerifyCode, toPublic } from '@/lib/credentials'
import { formatDate, UNIVERSITY } from '@/lib/site'
import type { PublicCredential } from '@/lib/types'
import { SignatureCheck } from '@/components/signature-check'
import { PrintButton } from '@/components/print-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verification result',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

const STATUS = {
  approved: {
    word: 'Verified',
    meaning: 'Taraba State University awarded this certificate, and it is in force.',
    icon: BadgeCheck,
    band: 'bg-status-valid-bg',
    ink: 'text-status-valid',
    ring: 'ring-status-valid/25',
  },
  revoked: {
    word: 'Revoked',
    meaning: 'The University has withdrawn this award. Do not accept this certificate.',
    icon: CircleX,
    band: 'bg-status-revoked-bg',
    ink: 'text-status-revoked',
    ring: 'ring-status-revoked/25',
  },
  superseded: {
    word: 'Replaced',
    meaning: 'A corrected certificate was issued in place of this one. Ask the graduate for the current certificate.',
    icon: Replace,
    band: 'bg-status-superseded-bg',
    ink: 'text-status-superseded',
    ring: 'ring-status-superseded/25',
  },
} as const

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ via?: string }>
}) {
  const { code } = await params
  const { via } = await searchParams
  const record = await findByVerifyCode(code)
  // TODO(phase-1): log this lookup to verification_events (code, result, country, user agent).

  const checkedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date())

  return (
    <div className="bg-canvas py-10 sm:py-14">
      <div className="shell max-w-[860px]">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center justify-between gap-4 text-sm print:hidden">
          <Link href="/#verify" className="font-medium text-ink-muted hover:text-navy">
            Verify another certificate
          </Link>
          <span className="text-ink-faint">Checked {checkedAt} (WAT)</span>
        </nav>

        {record ? <RecordCard record={toPublic(record)} via={via === 'details' ? 'details' : null} /> : <NotFoundCard />}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row print:hidden">
          <Link href="/?mode=scan#verify" className="btn-primary">
            <ScanLine className="h-4 w-4" aria-hidden />
            Check another certificate
          </Link>
          {record && <PrintButton />}
          <a
            href={`mailto:${UNIVERSITY.registrarEmail}?subject=${encodeURIComponent(`Certificate query: ${record?.serialNo ?? 'not found'}`)}`}
            className="btn-outline"
          >
            <Mail className="h-4 w-4" aria-hidden />
            Report a problem
          </a>
        </div>
      </div>
    </div>
  )
}

function RecordCard({ record, via }: { record: PublicCredential; via: 'details' | null }) {
  const s = STATUS[record.status]
  const Icon = s.icon
  const awardLine = `${record.award} in ${record.programme}`

  return (
    <article className="card overflow-hidden shadow-lift" aria-labelledby="graduate-name">
      {record.isSample && (
        <p className="flex items-center gap-2 border-b border-line bg-navy-50 px-6 py-2.5 text-[13px] text-navy">
          <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
          Sample record for testing. It does not belong to a real graduate.
        </p>
      )}

      {/* Status */}
      <header className={clsx('flex items-center gap-5 px-6 py-6 sm:px-10', s.band)}>
        <span className={clsx('inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white ring-8', s.ink, s.ring)}>
          <Icon className="h-8 w-8" aria-hidden strokeWidth={1.75} />
        </span>
        <div>
          <p className={clsx('font-display text-3xl font-semibold leading-none sm:text-4xl', s.ink)}>{s.word}</p>
          <p className={clsx('mt-2 text-[15px] leading-snug', s.ink)}>{s.meaning}</p>
        </div>
      </header>

      {/* The award, phrased the way the certificate phrases it */}
      <div className="relative px-6 pb-8 pt-9 sm:px-10">
        <Image
          src="/brand/tsu-crest.png"
          alt=""
          width={220}
          height={220}
          className="pointer-events-none absolute right-6 top-6 hidden w-[180px] opacity-[0.06] sm:block"
        />
        <p className="text-sm text-ink-muted">{UNIVERSITY.name}, Jalingo, certifies that</p>
        <h1 id="graduate-name" className="mt-3 sm:pr-44 text-[1.75rem] font-semibold leading-tight sm:text-[2.25rem]">
          {record.fullName}
        </h1>
        <p className="mt-3 max-w-[56ch] text-lg leading-relaxed text-ink sm:pr-44">
          was awarded the {record.awardLevel === 'postgraduate' ? 'postgraduate ' : ''}degree of{' '}
          <span className="font-semibold text-navy">{awardLine}</span>
          {record.classOfDegree ? (
            <>
              {' '}with <span className="font-semibold text-navy">{record.classOfDegree}</span>
            </>
          ) : null}
          , on {formatDate(record.dateOfAward)}.
        </p>

        {record.status === 'revoked' && record.revokedAt && (
          <p className="mt-5 rounded-lg border border-status-revoked/20 bg-status-revoked-bg px-4 py-3 text-[15px] text-status-revoked">
            Revoked by the University on {formatDate(record.revokedAt)}.
          </p>
        )}
        {record.status === 'superseded' && record.supersededBy && (
          <p className="mt-5 rounded-lg border border-status-superseded/20 bg-status-superseded-bg px-4 py-3 text-[15px] text-status-superseded">
            This serial number was replaced.{' '}
            <Link href={`/c/${record.supersededBy}`} className="font-semibold underline underline-offset-2">
              View the current certificate
            </Link>
            .
          </p>
        )}

        {/* Register entry */}
        <dl className="mt-8 grid border-t border-line sm:grid-cols-2">
          <Fact term="Certificate serial number" value={record.serialNo} mono />
          <Fact term="Matric number" value={record.matricNoMasked} mono hint="Partly hidden for privacy" />
          <Fact term="Faculty" value={record.faculty} />
          <Fact term="Department" value={record.department} />
          <Fact term="Session of graduation" value={record.session} />
          <Fact term="Level" value={record.awardLevel === 'postgraduate' ? 'Postgraduate' : 'Undergraduate'} />
        </dl>
      </div>

      <footer className="border-t border-line bg-canvas/60 px-6 py-5 sm:px-10">
        <SignatureCheck code={record.verifyCode} via={via} />
      </footer>
    </article>
  )
}

function Fact({ term, value, mono, hint }: { term: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div className="border-b border-line py-4 sm:odd:pr-6 sm:even:border-l sm:even:pl-6">
      <dt className="text-[13px] text-ink-muted">
        {term}
        {hint && <span className="text-ink-faint"> ({hint.toLowerCase()})</span>}
      </dt>
      <dd className={clsx('mt-1 text-[15px] font-medium text-navy', mono && 'font-display tracking-wide')}>{value}</dd>
    </div>
  )
}

function NotFoundCard() {
  return (
    <article className="card overflow-hidden shadow-lift">
      <header className="flex items-center gap-5 bg-status-unknown-bg px-6 py-6 sm:px-10">
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-status-unknown ring-8 ring-status-unknown/15">
          <SearchX className="h-8 w-8" aria-hidden strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold leading-none text-status-unknown sm:text-4xl">Not found</h1>
          <p className="mt-2 text-[15px] text-status-unknown">No Taraba State University certificate matches this link.</p>
        </div>
      </header>
      <div className="space-y-4 px-6 py-8 text-[15px] leading-relaxed text-ink sm:px-10">
        <p>Don&apos;t accept the certificate on the strength of this QR code. Either the link was typed wrongly, or the code was not issued by TSU.</p>
        <ul className="list-disc space-y-2 pl-5 text-ink-muted">
          <li>Try the serial and matric numbers printed on the certificate instead.</li>
          <li>If they don&apos;t match either, report the certificate to the Registry with a photo of it.</li>
        </ul>
      </div>
    </article>
  )
}
