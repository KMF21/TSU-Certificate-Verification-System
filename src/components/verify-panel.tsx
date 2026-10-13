'use client'

import { useActionState, useState } from 'react'
import { Keyboard, Loader2, ScanLine, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { verifyByDetails, type ManualCheckState } from '@/app/actions'
import { QrScanner } from './qr-scanner'

type Tab = 'scan' | 'details'

export function VerifyPanel({ initialTab = 'details' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [state, formAction, pending] = useActionState<ManualCheckState, FormData>(verifyByDetails, {})

  return (
    <div className="card overflow-hidden shadow-lift">
      <div className="border-b border-line px-6 pb-5 pt-6">
        <h2 className="text-xl font-semibold">Check a certificate</h2>
        <p className="mt-1 text-sm text-ink-muted">Free, and no account needed.</p>

        <div role="tablist" aria-label="How to check" className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1">
          <TabButton active={tab === 'scan'} onClick={() => setTab('scan')} icon={<ScanLine className="h-4 w-4" aria-hidden />}>
            Scan QR code
          </TabButton>
          <TabButton active={tab === 'details'} onClick={() => setTab('details')} icon={<Keyboard className="h-4 w-4" aria-hidden />}>
            Enter details
          </TabButton>
        </div>
      </div>

      <div className="px-6 py-6">
        {tab === 'scan' ? (
          <div role="tabpanel" aria-label="Scan QR code">
            <QrScanner />
          </div>
        ) : (
          <form role="tabpanel" aria-label="Enter details" action={formAction} className="space-y-4" noValidate>
            <div>
              <label htmlFor="serial" className="mb-1.5 block text-sm font-medium text-navy">
                Certificate serial number
              </label>
              <input
                id="serial"
                name="serial"
                className="field font-display tracking-wide"
                placeholder="TSU/2025/000148"
                defaultValue={state.serial}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <label htmlFor="matric" className="mb-1.5 block text-sm font-medium text-navy">
                Matric number
              </label>
              <input
                id="matric"
                name="matric"
                className="field font-display tracking-wide"
                placeholder="TSU/19/CSC/1045"
                defaultValue={state.matric}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </div>

            {state.error && (
              <p role="alert" className="rounded-lg border border-status-revoked/20 bg-status-revoked-bg px-4 py-3 text-sm text-status-revoked">
                {state.error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
              {pending ? 'Checking the register' : 'Check certificate'}
            </button>
            <p className="text-xs leading-relaxed text-ink-muted">
              Both numbers are printed beside the QR code. Certificates issued before QR codes were introduced are checked by the Registry.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-colors',
        active ? 'bg-navy text-white shadow-sm' : 'text-ink-muted hover:text-navy',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
