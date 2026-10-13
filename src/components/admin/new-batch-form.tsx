'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { createBatchAction, type FormState } from '@/app/admin/(staff)/batches/actions'
import { Notice } from './ui'

export function NewBatchForm({ defaultSession }: { defaultSession: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBatchAction, {})
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-navy">Batch name</label>
        <input id="title" name="title" className="field" placeholder="2025/2026 Convocation, Faculty of Science" required minLength={3} maxLength={160} />
        <p className="mt-1.5 text-sm text-ink-muted">Name it so the Registrar recognises the list at a glance.</p>
      </div>
      <div>
        <label htmlFor="session" className="mb-1.5 block text-sm font-medium text-navy">Session of graduation</label>
        <input id="session" name="session" className="field max-w-[200px] font-display" defaultValue={defaultSession} pattern="\d{4}/\d{4}" required />
      </div>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Create batch
      </button>
    </form>
  )
}
