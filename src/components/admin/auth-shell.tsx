import Image from 'next/image'
import Link from 'next/link'

/** Two-panel frame for the sign-in and two-factor screens. */
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/tsu-crest.png" alt="" width={48} height={48} priority />
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">Taraba State University</span>
            <span className="block text-[13px] text-white/65">Certificate Verification</span>
          </span>
        </Link>
        <div className="relative max-w-md">
          <p className="font-display text-3xl font-semibold leading-tight">Registry staff area</p>
          <p className="mt-4 text-white/70">
            Records prepared here become the official register that employers, embassies and NYSC check. Every change is recorded
            with the name of the person who made it.
          </p>
        </div>
        <Image
          src="/brand/tsu-crest.png"
          alt=""
          width={520}
          height={520}
          className="pointer-events-none absolute -bottom-32 -right-32 opacity-[0.06]"
        />
      </aside>

      <section className="flex items-center justify-center bg-canvas px-4 py-12 sm:px-8">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/tsu-crest.png" alt="" width={40} height={40} />
            <span className="font-display text-[15px] font-semibold text-navy">TSU Certificate Verification</span>
          </Link>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="mt-2 text-ink-muted">{intro}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  )
}
