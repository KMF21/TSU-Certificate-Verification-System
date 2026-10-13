import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="shell flex min-h-[50vh] flex-col items-start justify-center py-20">
      <h1 className="text-3xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-muted">
        If you followed a link from a certificate, scan its QR code again or enter its serial and matric numbers.
      </p>
      <Link href="/#verify" className="btn-primary mt-8">Verify a certificate</Link>
    </div>
  )
}
