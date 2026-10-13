import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import QRCode from 'qrcode'
import { listSampleCredentials } from '@/lib/credentials'
import { certificateQrSvg } from '@/lib/qr'
import { isProduction, signCredential } from '@/lib/signing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Test certificates',
  robots: { index: false, follow: false },
}

const STATUS_LABEL = { approved: 'Verified', revoked: 'Revoked', superseded: 'Replaced' } as const

/** Test bench for previews: every sample record's QR code, plus two hostile QR codes. Never served in production. */
export default async function DemoPage() {
  if (isProduction) notFound()

  const samples = await listSampleCredentials()
  const cards = await Promise.all(samples.map(async (c) => ({ c, ...(await certificateQrSvg(c)) })))

  // A genuine TSU token on a lookalike domain, and a forged token on the same lookalike domain.
  const genuineToken = await signCredential(samples[0])
  const [h, , sig] = genuineToken.split('.')
  const forgedPayload = Buffer.from(
    JSON.stringify({ s: 'TSU/2025/000999', m: 'TSU/19/CSC/9999', n: 'OKAFOR, Fake Person', a: 'Bachelor of Science (B.Sc.) Medicine', c: 'First Class Honours', d: '2025-11-20' }),
  ).toString('base64url')
  const lookalike = 'https://tsu-certificate-check.com/c/xqsvzzmhmcfpjbvj'
  const hostile = await Promise.all(
    [
      { label: 'Genuine signature, lookalike site', expect: 'Scanner warns and offers the official record', url: `${lookalike}#${genuineToken}` },
      { label: 'Forged details, lookalike site', expect: 'Scanner says it is not a TSU code', url: `${lookalike}#${h}.${forgedPayload}.${sig}` },
    ].map(async (x) => ({ ...x, svg: await QRCode.toString(x.url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 4 }) })),
  )

  return (
    <div className="py-12">
      <div className="shell">
        <p className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 text-[13px] text-navy">
          <FlaskConical className="h-4 w-4" aria-hidden />
          Preview only. This page is switched off in production.
        </p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Test certificates</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">
          Scan these from a second screen with the &ldquo;Scan QR code&rdquo; tab or a phone camera, or type the serial and matric numbers
          into &ldquo;Enter details&rdquo;. All people here are fictional.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ c, svg, url }) => (
            <div key={c.id} className="card flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-semibold text-navy">
                    {c.surname.toUpperCase()}, {c.otherNames}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {c.award.replace(/ \(.+\)/, '')}, {c.programme}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-navy">{STATUS_LABEL[c.status]}</span>
              </div>
              <div className="mx-auto mt-5 w-48 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              <dl className="mt-5 space-y-1 font-display text-sm tracking-wide text-navy">
                <div className="flex justify-between gap-3"><dt className="font-body tracking-normal text-ink-muted">Serial</dt><dd>{c.serialNo}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-body tracking-normal text-ink-muted">Matric</dt><dd>{c.matricNo}</dd></div>
              </dl>
              <Link href={url.replace(/^https?:\/\/[^/]+/, '')} className="btn-outline mt-5">Open result</Link>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-semibold">Hostile QR codes</h2>
        <p className="mt-2 max-w-2xl text-ink-muted">These point to a lookalike website. Scan them with the site&apos;s own scanner to see the warnings.</p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {hostile.map((x) => (
            <div key={x.label} className="card flex gap-6 p-6">
              <div className="w-40 shrink-0 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: x.svg }} />
              <div>
                <p className="font-display font-semibold text-navy">{x.label}</p>
                <p className="mt-2 text-sm text-ink-muted">Expected: {x.expect}.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
