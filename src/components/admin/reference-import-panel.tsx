'use client'

import { useActionState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { importReferenceAction } from '@/app/admin/(staff)/programmes/actions'
import type { ImportState } from '@/app/admin/(staff)/batches/actions'
import { Notice } from './ui'

export function ReferenceImportPanel() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importReferenceAction, {})
  return (
    <section className="card p-6">
      <h2 className="text-lg font-semibold">Load or update the programme list</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        The download already contains every programme in the register. Add or correct rows and upload it again; existing codes are
        updated. Programmes with issued certificates keep their printed name and award title.
      </p>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <a href="/admin/programmes/template" className="btn-outline shrink-0">
          <Download className="h-4 w-4" aria-hidden /> Download programme list
        </a>
        <form action={action} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-sm font-medium text-navy">Completed list (.xlsx or .csv)</span>
            <input type="file" name="file" accept=".xlsx,.csv" required className="block w-full text-sm text-ink-muted file:mr-4 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white" />
          </label>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
            Check and load
          </button>
        </form>
      </div>
      <div aria-live="polite" className="mt-4 space-y-3">
        {state.ok && <Notice tone="good">{state.ok}</Notice>}
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        {state.problems && state.problems.length > 0 && (
          <ul className="max-h-64 overflow-auto rounded-lg border border-line text-sm">
            {state.problems.map((p, i) => (
              <li key={i} className="flex gap-4 border-b border-line px-3 py-2 last:border-0">
                <span className="w-12 shrink-0 font-display text-navy">Row {p.row}</span>
                <span>{p.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
