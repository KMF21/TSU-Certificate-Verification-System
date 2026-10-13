'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

type Step =
  | { kind: 'loading' }
  | { kind: 'enrol'; factorId: string; qr: string; secret: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'failed'; message: string }

/**
 * First sign-in: set up an authenticator app (TOTP). Every later sign-in: enter its code.
 * Staff permissions in the database only switch on after this step.
 */
export function TwoFactorForm({ next }: { next: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const prepare = useCallback(async () => {
    const supabase = createClient()
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) return setStep({ kind: 'failed', message: 'Your session has expired. Sign in again.' })

    const verified = data.totp[0]
    if (verified) return setStep({ kind: 'verify', factorId: verified.id })

    // Clear any half-finished enrolment, then start a fresh one.
    for (const f of data.all.filter((f) => f.status === 'unverified')) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data: enrolled, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      issuer: 'TSU Certificate Verification',
    })
    if (enrolError || !enrolled) return setStep({ kind: 'failed', message: 'Two-factor setup could not start. Try again.' })
    setStep({ kind: 'enrol', factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret })
  }, [])

  useEffect(() => {
    void prepare()
  }, [prepare])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (step.kind !== 'enrol' && step.kind !== 'verify') return
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.trim() })
    if (verifyError) {
      setBusy(false)
      setCode('')
      return setError('That code didn’t work. Codes change every 30 seconds: enter the one showing now.')
    }
    router.replace(next)
    router.refresh()
  }

  if (step.kind === 'loading') {
    return (
      <p className="flex items-center gap-3 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Preparing two-factor sign-in
      </p>
    )
  }
  if (step.kind === 'failed') {
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-lg border border-status-revoked/20 bg-status-revoked-bg px-4 py-3 text-sm text-status-revoked">{step.message}</p>
        <a href="/admin/login" className="btn-outline">Back to sign-in</a>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {step.kind === 'enrol' && (
        <ol className="space-y-5 text-[15px] text-ink">
          <li>
            <p className="font-medium text-navy">1. Scan this with an authenticator app</p>
            <p className="mt-1 text-sm text-ink-muted">Google Authenticator, Microsoft Authenticator or similar.</p>
            <div className="mt-3 inline-block rounded-xl border border-line bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.qr} alt="QR code for your authenticator app" width={184} height={184} />
            </div>
            <details className="mt-2 text-sm text-ink-muted">
              <summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
              <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 font-display text-navy">{step.secret}</code>
            </details>
          </li>
          <li>
            <p className="font-medium text-navy">2. Enter the 6-digit code it shows</p>
          </li>
        </ol>
      )}

      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-navy">
          {step.kind === 'verify' ? 'Code from your authenticator app' : 'Authenticator code'}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          className="field text-center font-display text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
          required
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-status-revoked/20 bg-status-revoked-bg px-4 py-3 text-sm text-status-revoked">{error}</p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy || code.length !== 6}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : step.kind === 'enrol' ? <KeyRound className="h-4 w-4" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
        {step.kind === 'enrol' ? 'Turn on two-factor sign-in' : 'Confirm'}
      </button>
    </form>
  )
}
