'use client'

import { useActionState, useRef } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { importRowsAction, type ImportState } from '@/app/admin/(staff)/batches/actions'
import type { AwardLevel } from '@/lib/admin/roles'
import { Notice } from './ui'

export function ImportPanel({ batchId, level }: { batchId: string; level: AwardLevel }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importRowsAction, {})
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <section className="card p-6">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy">
          <FileSpreadsheet className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Import records</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Fill in the template from the Senate-approved list. Every row is checked first; if any row has a problem, nothing is saved.
          </p>
        </div>
      </div>

      <a href={`/admin/batches/template?level=${level}`} className="btn-outline mt-5">
        <Download className="h-4 w-4" aria-hidden /> Download the template
      </a>

      <form ref={formRef} action={action} className="mt-5 space-y-4">
        <input type="hidden" name="batch_id" value={batchId} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy">Completed template (.xlsx or .csv, up to 5 MB)</span>
          <input
            type="file"
            name="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
            className="block w-full text-sm text-ink-muted file:mr-4 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-700"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {pending ? 'Checking every row' : 'Check and import'}
        </button>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {state.ok && <Notice tone="good">{state.ok}</Notice>}
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        {state.problems && state.problems.length > 0 && (
          <div className="max-h-80 overflow-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-canvas text-ink-muted">
                <tr>
                  <th scope="col" className="w-20 px-3 py-2 font-medium">Row</th>
                  <th scope="col" className="px-3 py-2 font-medium">Problem in {state.fileName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.problems.map((p, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-display tabular-nums text-navy">{p.row}</td>
                    <td className="px-3 py-2">{p.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
