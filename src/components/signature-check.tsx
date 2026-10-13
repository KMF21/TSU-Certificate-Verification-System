'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { SignatureCheckResult } from '@/lib/types'

type View =
  | { kind: 'checking' }
  | { kind: 'register-only'; via: 'details' | 'link' }
  | { kind: 'error' }
  | { kind: 'result'; result: SignatureCheckResult }

/**
 * Reads the signed token from the URL fragment (never sent to the server automatically)
 * and asks this site to check it against TSU's published keys and the current record.
 */
export function SignatureCheck({ code, via }: { code: string; via: 'details' | null }) {
  const [view, setView] = useState<View>({ kind: 'checking' })

  useEffect(() => {
    const token = window.location.hash.slice(1)
    if (!token) {
      setView({ kind: 'register-only', via: via ?? 'link' })
      return
    }
    let cancelled = false
    fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, code }),
    })
      .then((res) => (res.ok ? (res.json() as Promise<SignatureCheckResult>) : Promise.reject()))
      .then((result) => !cancelled && setView({ kind: 'result', result }))
      .catch(() => !cancelled && setView({ kind: 'error' }))
    return () => {
      cancelled = true
    }
  }, [code, via])

  return (
    <div aria-live="polite" className="min-h-[56px]">
      <Row view={view} />
    </div>
  )
}

function Row({ view }: { view: View }) {
  if (view.kind === 'checking') {
    return (
      <Line icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden />} tone="text-ink-muted">
        Checking TSU&apos;s digital signature on this QR code
      </Line>
    )
  }
  if (view.kind === 'register-only') {
    return (
      <Line icon={<KeyRound className="h-5 w-5" aria-hidden />} tone="text-navy">
        {view.via === 'details'
          ? 'Found in the TSU register by serial and matric number.'
          : 'Found in the TSU register. Scan the certificate’s QR code to also check its digital signature.'}
      </Line>
    )
  }
  if (view.kind === 'error') {
    return (
      <Line icon={<TriangleAlert className="h-5 w-5" aria-hidden />} tone="text-status-superseded">
        The digital signature couldn&apos;t be checked just now. The record above is still the University&apos;s official one.
      </Line>
    )
  }

  const { result } = view
  if (result.state === 'valid' && result.matchesRecord) {
    return (
      <Line icon={<ShieldCheck className="h-5 w-5" aria-hidden />} tone="text-status-valid">
        <strong className="font-semibold">TSU digital signature is valid.</strong> This QR code was issued by Taraba State University and
        its details match the record above.
      </Line>
    )
  }
  if (result.state === 'valid') {
    return (
      <Line icon={<TriangleAlert className="h-5 w-5" aria-hidden />} tone="text-status-superseded">
        <strong className="font-semibold">Signed by TSU, but out of date.</strong> The details in this QR code no longer match the
        register. Rely on the record above.
      </Line>
    )
  }
  return (
    <Line icon={<ShieldAlert className="h-5 w-5" aria-hidden />} tone="text-status-revoked">
      <strong className="font-semibold">This QR code&apos;s signature is not valid.</strong> It may have been altered. Rely only on the
      record above and compare it closely with the certificate.
    </Line>
  )
}

function Line({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <p className={`flex gap-3 text-[15px] leading-relaxed ${tone}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}
