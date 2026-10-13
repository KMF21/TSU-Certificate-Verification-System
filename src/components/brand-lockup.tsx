import Image from 'next/image'
import Link from 'next/link'

export function BrandLockup({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const primary = tone === 'light' ? 'text-white' : 'text-navy'
  const secondary = tone === 'light' ? 'text-white/65' : 'text-ink-muted'
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="TSU Certificate Verification, home">
      <Image src="/brand/tsu-crest.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0" priority />
      <span className="flex flex-col leading-tight">
        <span className={`font-display text-[15px] font-semibold ${primary}`}>Taraba State University</span>
        <span className={`text-[12.5px] ${secondary}`}>Certificate Verification</span>
      </span>
    </Link>
  )
}
