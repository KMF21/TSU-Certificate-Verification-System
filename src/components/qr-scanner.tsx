'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, CameraOff, ImageUp, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { IScannerControls } from '@zxing/browser'
import type { SignatureCheckResult } from '@/lib/types'

type Outcome =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'camera-error'; message: string }
  | { kind: 'not-tsu' }
  | { kind: 'foreign-genuine'; host: string; href: string }
  | { kind: 'foreign-forged'; host: string }
  | { kind: 'unreadable' }

async function checkToken(token: string): Promise<SignatureCheckResult | null> {
  try {
    const res = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    return res.ok ? ((await res.json()) as SignatureCheckResult) : null
  } catch {
    return null
  }
}

/**
 * Reads a certificate QR code with the camera (or a photo) and decides where it may lead.
 * A code pointing at this site opens the record. A code pointing anywhere else is checked
 * against TSU's signing keys here, so a lookalike verification site can't vouch for a forgery.
 */
export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })

  const stop = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  const handleText = useCallback(
    async (text: string) => {
      stop()
      let url: URL
      try {
        url = new URL(text.trim())
      } catch {
        setOutcome({ kind: 'not-tsu' })
        return
      }

      if (url.origin === window.location.origin && url.pathname.startsWith('/c/')) {
        setOutcome({ kind: 'checking' })
        window.location.assign(url.href)
        return
      }

      const token = url.hash.slice(1)
      if (!token) {
        setOutcome({ kind: 'not-tsu' })
        return
      }
      setOutcome({ kind: 'checking' })
      const result = await checkToken(token)
      if (result?.state === 'valid' && result.verifyCode) {
        setOutcome({ kind: 'foreign-genuine', host: url.host, href: `/c/${result.verifyCode}#${token}` })
      } else {
        setOutcome({ kind: 'foreign-forged', host: url.host })
      }
    },
    [stop],
  )

  const startCamera = useCallback(async () => {
    setOutcome({ kind: 'starting' })
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 })
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current ?? undefined,
        (result) => {
          if (result) void handleText(result.getText())
        },
      )
      setOutcome({ kind: 'scanning' })
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      setOutcome({
        kind: 'camera-error',
        message: denied
          ? 'Camera access was blocked. Allow the camera in your browser settings, or upload a photo of the QR code instead.'
          : 'No camera is available on this device. Upload a photo of the QR code, or enter the details instead.',
      })
    }
  }, [handleText])

  const onPhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      stop()
      setOutcome({ kind: 'checking' })
      const objectUrl = URL.createObjectURL(file)
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        const result = await new BrowserQRCodeReader().decodeFromImageUrl(objectUrl)
        await handleText(result.getText())
      } catch {
        setOutcome({ kind: 'unreadable' })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    },
    [handleText, stop],
  )

  const live = outcome.kind === 'scanning' || outcome.kind === 'starting'

  return (
    <div className="space-y-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-navy">
        <video ref={videoRef} className={live ? 'h-full w-full object-cover' : 'hidden'} muted playsInline aria-label="Camera preview" />
        {live ? (
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(10,23,48,0.45)]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
            {outcome.kind === 'checking' ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                <p className="text-sm">Checking the QR code</p>
              </>
            ) : (
              <>
                <CameraOff className="h-8 w-8 text-white/50" aria-hidden />
                <p className="text-sm">Point your camera at the QR code on the certificate.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div aria-live="polite">
        <ScanMessage outcome={outcome} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {live ? (
          <button type="button" className="btn-outline" onClick={() => { stop(); setOutcome({ kind: 'idle' }) }}>
            <CameraOff className="h-4 w-4" aria-hidden />
            Stop camera
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={startCamera} disabled={outcome.kind === 'checking'}>
            <Camera className="h-4 w-4" aria-hidden />
            Start camera
          </button>
        )}
        <label className="btn-outline cursor-pointer">
          <ImageUp className="h-4 w-4" aria-hidden />
          Upload a photo
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  )
}

function ScanMessage({ outcome }: { outcome: Outcome }) {
  switch (outcome.kind) {
    case 'camera-error':
      return <Note tone="warn">{outcome.message}</Note>
    case 'unreadable':
      return <Note tone="warn">No QR code was found in that photo. Take a closer, well-lit photo of just the QR code, or enter the details instead.</Note>
    case 'not-tsu':
      return <Note tone="danger">This QR code is not a Taraba State University certificate code. Do not rely on it.</Note>
    case 'foreign-forged':
      return (
        <Note tone="danger">
          This QR code leads to <strong>{outcome.host}</strong>, which is not TSU&apos;s verification site, and it carries no valid TSU
          signature. Treat the certificate as unverified and contact the Registry.
        </Note>
      )
    case 'foreign-genuine':
      return (
        <Note tone="warn">
          This QR code carries a genuine TSU signature but leads to <strong>{outcome.host}</strong> instead of TSU&apos;s site.{' '}
          <Link href={outcome.href} className="font-semibold underline underline-offset-2">
            Open the official record
          </Link>{' '}
          and compare it with the certificate.
        </Note>
      )
    default:
      return null
  }
}

function Note({ tone, children }: { tone: 'warn' | 'danger'; children: React.ReactNode }) {
  const styles =
    tone === 'danger'
      ? 'border-status-revoked/20 bg-status-revoked-bg text-status-revoked'
      : 'border-status-superseded/20 bg-status-superseded-bg text-status-superseded'
  const Icon = tone === 'danger' ? ShieldAlert : ShieldCheck
  return (
    <p className={`flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
