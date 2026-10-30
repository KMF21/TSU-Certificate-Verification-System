'use client'

import { useActionState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { signIn, type SignInState } from '@/app/admin/auth-actions'

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {})
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-navy">Email address</label>
        <input id="email" name="email" type="email" autoComplete="username" className="field" defaultValue={state.email} required />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-navy">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="field" required />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg border border-status-revoked/20 bg-status-revoked-bg px-4 py-3 text-sm text-status-revoked">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
        {pending ? 'Signing in' : 'Sign in'}
      </button>
      <p className="text-sm text-ink-muted">Forgotten your password? Ask an Admin of the graduation register to reset it.</p>
    </form>
  )
}
