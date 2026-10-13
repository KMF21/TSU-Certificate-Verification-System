'use client'

import { useActionState, useState } from 'react'
import { BadgeCheck, Loader2, Send, Undo2 } from 'lucide-react'
import { approveBatchAction, rejectBatchAction, submitBatchAction, type FormState } from '@/app/admin/(staff)/batches/actions'
import { Notice } from './ui'

export function SubmitPanel({ batchId, count }: { batchId: string; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitBatchAction, {})
  return (
    <section className="card flex flex-col p-6">
      <h2 className="text-lg font-semibold">Send for approval</h2>
      <p className="mt-1 text-sm text-ink-muted">
        When the list matches the Senate approval, send it to the Registrar. You won’t be able to change it while it’s being reviewed.
      </p>
      <form action={action} className="mt-auto pt-5">
        <input type="hidden" name="batch_id" value={batchId} />
        <button type="submit" className="btn-primary w-full" disabled={pending || count === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          Send {count} {count === 1 ? 'record' : 'records'} to the Registrar
        </button>
      </form>
      <div aria-live="polite" className="mt-3">
        {state.error && <Notice tone="bad">{state.error}</Notice>}
      </div>
    </section>
  )
}

export function DecisionPanel({
  batchId,
  count,
  submittedBy,
  submittedAt,
  ownSubmission,
}: {
  batchId: string
  count: number
  submittedBy: string
  submittedAt: string
  ownSubmission: boolean
}) {
  const [mode, setMode] = useState<'approve' | 'return'>('approve')
  const [approveState, approve, approving] = useActionState<FormState, FormData>(approveBatchAction, {})
  const [returnState, reject, returning] = useActionState<FormState, FormData>(rejectBatchAction, {})

  if (ownSubmission) {
    return <Notice tone="warn">You sent this batch for approval, so another Registrar-level officer must decide on it.</Notice>
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line bg-[#EAF1FB] px-6 py-4">
        <h2 className="text-lg font-semibold">Your decision</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Sent by {submittedBy} on {submittedAt}. Check the {count} records below against the Senate-approved list.
        </p>
      </div>

      <div className="px-6 pt-5" role="tablist" aria-label="Decision">
        <div className="inline-grid grid-cols-2 gap-1 rounded-full bg-canvas p-1">
          {(['approve', 'return'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${mode === m ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'}`}
            >
              {m === 'approve' ? 'Approve' : 'Return for changes'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'approve' ? (
        <form action={approve} className="space-y-4 p-6">
          <input type="hidden" name="batch_id" value={batchId} />
          <label className="flex gap-3 text-[15px]">
            <input type="checkbox" name="confirm" className="mt-1 h-4 w-4 accent-[#0F1F3D]" />
            <span>I have checked these {count} records against the Senate-approved list, and they are correct.</span>
          </label>
          <p className="text-sm text-ink-muted">
            Approving gives each record a serial number and a signed QR code, and makes it verifiable on the public site straight away.
          </p>
          <button type="submit" className="btn-primary" disabled={approving}>
            {approving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BadgeCheck className="h-4 w-4" aria-hidden />}
            Approve and issue {count} {count === 1 ? 'certificate' : 'certificates'}
          </button>
          <div aria-live="polite">{approveState.error && <Notice tone="bad">{approveState.error}</Notice>}</div>
        </form>
      ) : (
        <form action={reject} className="space-y-4 p-6">
          <input type="hidden" name="batch_id" value={batchId} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy">What needs fixing?</span>
            <textarea name="reason" rows={3} className="field" placeholder="Row for OKORO, Chidi shows Second Class Upper; the Senate list says Lower." required minLength={5} />
          </label>
          <button type="submit" className="btn-outline" disabled={returning}>
            {returning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Undo2 className="h-4 w-4" aria-hidden />}
            Return to the Records Officer
          </button>
          <div aria-live="polite">{returnState.error && <Notice tone="bad">{returnState.error}</Notice>}</div>
        </form>
      )}
    </section>
  )
}
