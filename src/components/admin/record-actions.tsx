'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, CheckCircle2, Trash2 } from 'lucide-react'
import type { RecordStatus } from '@/lib/admin/roles'
import { approveRecordsAction, deleteRecordAction, verifyRecordsAction } from '@/app/admin/(staff)/records/actions'
import { lagosToday } from '@/lib/admin/record-input'
import { Notice } from './ui'

export function RecordActions({
  id,
  status,
  needsVerify,
  own,
  session,
  senateDate,
  isAdmin,
  sessions,
}: {
  id: string
  status: RecordStatus
  needsVerify: boolean
  own: boolean
  session: string | null
  senateDate: string | null
  isAdmin: boolean
  sessions: string[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [date, setDate] = useState(senateDate ?? '')
  const [sess, setSess] = useState(session ?? '')
  const [reason, setReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn()
      setMessage(res.error ? { tone: 'bad', text: res.error } : { tone: 'good', text: res.ok ?? 'Done.' })
      if (!res.error) {
        if (after) after()
        else router.refresh()
      }
    })

  const canSignOff = status === 'pending' || needsVerify

  return (
    <section className="card p-6 text-sm">
      <h2 className="font-display text-base font-semibold text-navy">Actions</h2>
      {message && <div className="mt-3"><Notice tone={message.tone}>{message.text}</Notice></div>}

      {canSignOff && own && (
        <p className="mt-3 text-ink-muted">You entered or last edited this record, so another officer must {status === 'pending' ? 'approve' : 'verify'} it.</p>
      )}

      {status === 'pending' && !own && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => approveRecordsAction({ ids: [id], senateDate: date, session: sess }))
          }}
        >
          <label className="block">
            <span className="label">Senate approval date</span>
            <input type="date" required className="field-sm" max={lagosToday()} min="2008-01-01" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Graduation session</span>
            <select required className="field-sm" value={sess} onChange={(e) => setSess(e.target.value)}>
              <option value="">Choose a session</option>
              {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary btn-sm w-full" disabled={pending}>
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve this record
          </button>
        </form>
      )}

      {needsVerify && !own && (
        <div className="mt-4">
          <p className="text-ink-muted">Checked this record against the official Senate documents?</p>
          <button type="button" className="btn-outline btn-sm mt-2 w-full" disabled={pending} onClick={() => run(() => verifyRecordsAction({ ids: [id] }))}>
            <BadgeCheck className="h-4 w-4" aria-hidden /> Mark as verified
          </button>
        </div>
      )}

      {!canSignOff && <p className="mt-3 text-ink-muted">Approved{needsVerify ? '' : ' and complete'}. Use “Correct this record” to change it with a reason.</p>}

      {isAdmin && (
        <div className="mt-6 border-t border-line pt-4">
          {!confirmDelete ? (
            <button type="button" className="inline-flex items-center gap-1.5 text-status-revoked hover:underline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete this record
            </button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                run(() => deleteRecordAction({ id, reason }), () => router.push('/admin/records'))
              }}
            >
              <label className="block">
                <span className="label">Why is this record being deleted?</span>
                <textarea required minLength={5} rows={2} className="field-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
              <p className="text-xs text-ink-muted">The record disappears from the register and from public checks. The audit log keeps a copy.</p>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-sm bg-status-revoked text-white hover:bg-status-revoked/90" disabled={pending}>Delete</button>
                <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
