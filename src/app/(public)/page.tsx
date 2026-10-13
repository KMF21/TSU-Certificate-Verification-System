import Image from 'next/image'
import Link from 'next/link'
import {
  BadgeCheck,
  Building2,
  CircleX,
  FileSearch,
  Globe2,
  KeyRound,
  Landmark,
  Mail,
  Replace,
  ScanLine,
  SearchX,
  ShieldCheck,
} from 'lucide-react'
import { VerifyPanel } from '@/components/verify-panel'

const HERO_IMAGE = 'https://www.tsuniversity.edu.ng/wp-content/uploads/2014/10/GIT_1325-min-1024x731.jpg'
const REGISTRAR_EMAIL = 'registrar@tsuniversity.edu.ng'

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams

  return (
    <>
      {/* Hero */}
      <section id="verify" className="relative isolate scroll-mt-[72px] overflow-hidden bg-navy">
        <Image src={HERO_IMAGE} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/50" />

        <div className="shell grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
          <div className="max-w-xl text-white">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[13px] text-white/85">
              <Landmark className="h-3.5 w-3.5" aria-hidden />
              An official service of the University Registry
            </p>
            <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.1] text-white sm:text-5xl lg:text-[3.5rem]">
              Is this a genuine Taraba State University certificate?
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-white/80">
              Scan the QR code on the certificate, or enter its serial and matric numbers. You&apos;ll see the graduate&apos;s
              record exactly as the University holds it.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <Link href="#how-it-works" className="font-semibold text-white underline-offset-4 hover:underline">
                How verification works
              </Link>
              <Link href="#organisations" className="font-semibold text-white/75 underline-offset-4 hover:text-white hover:underline">
                Verifying for an organisation?
              </Link>
            </div>
          </div>

          <div className="w-full lg:max-w-[460px] lg:justify-self-end">
            <VerifyPanel initialTab={mode === 'scan' ? 'scan' : 'details'} />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="Why you can trust the result" className="bg-crimson text-white">
        <ul className="shell grid gap-4 py-5 text-sm sm:grid-cols-3 sm:gap-6">
          <TrustItem icon={<Landmark className="h-4 w-4" aria-hidden />}>Records come only from the TSU Registry</TrustItem>
          <TrustItem icon={<KeyRound className="h-4 w-4" aria-hidden />}>Every QR code carries TSU&apos;s digital signature</TrustItem>
          <TrustItem icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>Checking is free and needs no account</TrustItem>
        </ul>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-[72px] py-20 lg:py-24">
        <div className="shell">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold sm:text-4xl">What happens when you scan</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              A photocopy can fake a seal or a signature. It can&apos;t fake TSU&apos;s digital signature, because only the University holds the key.
            </p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n={1} icon={<ScanLine className="h-5 w-5" aria-hidden />} title="Scan the QR code">
              Any phone camera opens the certificate&apos;s page on this site. No app is needed.
            </Step>
            <Step n={2} icon={<KeyRound className="h-5 w-5" aria-hidden />} title="TSU's signature is checked">
              The code holds the certificate&apos;s details, signed by the University. Any change to them breaks the signature.
            </Step>
            <Step n={3} icon={<FileSearch className="h-5 w-5" aria-hidden />} title="Compare with the paper">
              The official record opens. Check the name, programme, class and date against the certificate in front of you.
            </Step>
          </ol>
        </div>
      </section>

      {/* Status legend */}
      <section aria-labelledby="results-heading" className="border-y border-line bg-white py-20 lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 id="results-heading" className="text-3xl font-semibold sm:text-4xl">
              Four results, each with one meaning
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              Only &ldquo;Verified&rdquo; means the certificate stands. Anything else is a reason to stop and contact the Registry.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Legend
              icon={<BadgeCheck className="h-5 w-5" aria-hidden />}
              tone="text-status-valid bg-status-valid-bg"
              term="Verified"
              detail="TSU awarded this certificate and it is in force."
            />
            <Legend
              icon={<CircleX className="h-5 w-5" aria-hidden />}
              tone="text-status-revoked bg-status-revoked-bg"
              term="Revoked"
              detail="The University has withdrawn this award. Do not accept it."
            />
            <Legend
              icon={<Replace className="h-5 w-5" aria-hidden />}
              tone="text-status-superseded bg-status-superseded-bg"
              term="Replaced"
              detail="A corrected certificate was issued. Ask for the current one."
            />
            <Legend
              icon={<SearchX className="h-5 w-5" aria-hidden />}
              tone="text-status-unknown bg-status-unknown-bg"
              term="Not found"
              detail="No TSU record matches. Check the numbers, then contact the Registry."
            />
          </dl>
        </div>
      </section>

      {/* Organisations */}
      <section id="organisations" className="scroll-mt-[72px] py-20 lg:py-24">
        <div className="shell">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold sm:text-4xl">Verifying for an organisation</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">
              Anyone can check a single certificate here. Organisations that need a formal letter for their files, or need to check many
              graduates at once, will use the verifier portal.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Audience icon={<Building2 className="h-5 w-5" aria-hidden />} title="Employers and recruiters">
              Confirm a candidate&apos;s degree, class and date of award before an offer.
            </Audience>
            <Audience icon={<Globe2 className="h-5 w-5" aria-hidden />} title="Embassies and evaluators">
              Credential evaluators such as WES can confirm awards without waiting on paper letters.
            </Audience>
            <Audience icon={<Landmark className="h-5 w-5" aria-hidden />} title="Government and NYSC">
              Check staff and corps members&apos; credentials in line with national verification rules.
            </Audience>
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-card border border-line bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] text-ink">
              The verifier portal, with signed letters and bulk checks, is coming soon. Until then, the Registry handles formal requests.
            </p>
            <a href={`mailto:${REGISTRAR_EMAIL}?subject=Certificate%20verification%20request`} className="btn-outline shrink-0">
              <Mail className="h-4 w-4" aria-hidden />
              Email the Registry
            </a>
          </div>
        </div>
      </section>

      {/* Help */}
      <section id="help" className="scroll-mt-[72px] border-t border-line bg-white py-20 lg:py-24">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">Help</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-muted">Common problems, and what to do about them.</p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            <Faq q="The QR code won't scan">
              Hold the phone 15 to 20 cm away in good light, or upload a clear photo of just the QR code. You can also choose
              &ldquo;Enter details&rdquo; and type the serial and matric numbers printed beside it.
            </Faq>
            <Faq q="The record doesn't match the certificate">
              Treat the certificate as unverified. The record on this site is the University&apos;s official one. Report the mismatch to
              the Registry with a photo of the certificate.
            </Faq>
            <Faq q="The certificate has no QR code">
              Certificates issued before QR codes were introduced are being added to the register. Until a record appears, the Registry
              confirms them on request.
            </Faq>
            <Faq q="Is a graduate's personal information public?">
              No. This site shows only what is printed on the certificate, with part of the matric number hidden. Nobody can search or
              list graduates by name.
            </Faq>
          </div>
        </div>
      </section>

      {/* Report */}
      <section className="bg-navy py-14">
        <div className="shell flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold text-white">Suspect a forged TSU certificate?</h2>
            <p className="mt-2 text-white/75">Send the Registry a photo of the certificate and where it was presented. Reports are handled confidentially.</p>
          </div>
          <a href={`mailto:${REGISTRAR_EMAIL}?subject=Suspected%20forged%20certificate`} className="btn-primary shrink-0">
            Report a certificate
          </a>
        </div>
      </section>
    </>
  )
}

function TrustItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">{icon}</span>
      <span className="font-medium">{children}</span>
    </li>
  )
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="card relative p-7">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-navy-50 text-navy">{icon}</span>
        <span className="font-display text-sm font-semibold text-ink-faint" aria-hidden>
          Step {n}
        </span>
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed text-ink-muted">{children}</p>
    </li>
  )
}

function Legend({ icon, tone, term, detail }: { icon: React.ReactNode; tone: string; term: string; detail: string }) {
  return (
    <div className="flex gap-4 rounded-card border border-line p-5">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span>
      <div>
        <dt className="font-display font-semibold text-navy">{term}</dt>
        <dd className="mt-1 text-[15px] leading-relaxed text-ink-muted">{detail}</dd>
      </div>
    </div>
  )
}

function Audience({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-7">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-crimson-50 text-crimson">{icon}</span>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed text-ink-muted">{children}</p>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group py-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[17px] font-semibold text-navy">
        {q}
        <span className="text-2xl font-normal leading-none text-ink-faint transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <p className="mt-3 max-w-[62ch] leading-relaxed text-ink-muted">{children}</p>
    </details>
  )
}
