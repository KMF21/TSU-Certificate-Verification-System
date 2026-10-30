'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Undo2 } from 'lucide-react'
import { undoImportAction } from '@/app/admin/(staff)/upload/actions'
import { Notice } from './ui'

interface ReportRow {
  row: number | null
  reg_number: string
  full_name: string
  outcome: string
  reason: string
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Stop spreadsheet apps treating text as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function BatchTools({ batchId, fileName, canUndo, rows }: { batchId: string; fileName: string; canUndo: boolean; rows: ReportRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()

  const download = () => {
    const lines = [['Row in file', 'Registration number', 'Name', 'Outcome', 'Detail'], ...rows.map((r) => [r.row ?? '', r.reg_number, r.full_name, r.outcome, r.reason])]
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Import report - ${fileName.replace(/\.[^.]+$/, '')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="card p-5 text-sm">
      <h2 className="font-display text-base font-semibold text-navy">Report</h2>
      <p className="mt-1 text-ink-muted">Every row of the file with what happened to it.</p>
      <button type="button" className="btn-outline btn-sm mt-3 w-full" onClick={download}>
        <Download className="h-4 w-4" aria-hidden /> Download import report (CSV)
      </button>

      {canUndo && (
        <div className="mt-5 border-t border-line pt-4">
          {message && <div className="mb-3"><Notice tone={message.tone}>{message.text}</Notice></div>}
          {!open ? (
            <button type="button" className="inline-flex items-center gap-1.5 font-medium text-status-revoked hover:underline" onClick={() => setOpen(true)}>
              <Undo2 className="h-4 w-4" aria-hidden /> Undo this upload
            </button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                start(async () => {
                  const res = await undoImportAction({ batchId, reason })
                  setMessage(res.error ? { tone: 'bad', text: res.error } : { tone: 'good', text: res.ok! })
                  if (!res.error) {
                    setOpen(false)
                    router.refresh()
                  }
                })
              }}
            >
              <p className="text-ink-muted">
                Removes the records this upload added and restores the ones it updated. Only possible while none of them has been approved or edited since.
              </p>
              <label className="block">
                <span className="label">Reason</span>
                <textarea required minLength={5} rows={2} className="field-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong session’s list uploaded" />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-sm bg-status-revoked text-white hover:bg-status-revoked/90" disabled={pending}>Undo upload</button>
                <button type="button" className="btn-outline btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
