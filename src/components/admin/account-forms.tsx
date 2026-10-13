'use client'

import { useActionState, useState } from 'react'
import { Copy, KeyRound, Loader2, UserPlus } from 'lucide-react'
import { createAccountAction, resetAccessAction, updateAccountAction, type AccountState } from '@/app/admin/(staff)/users/actions'
import type { AppRole } from '@/lib/admin/roles'
import { Notice } from './ui'

function TemporaryPassword({ created }: { created: NonNullable<AccountState['created']> }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-lg border border-status-valid/20 bg-status-valid-bg p-4 text-sm text-ink">
      <p className="font-semibold text-status-valid">{created.reset ? `Access reset for ${created.name}` : `Account created for ${created.name}`}</p>
      <p className="mt-1">
        Give them this temporary password in person or by phone. It is shown only once. They will set up two-factor sign-in next.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded-md bg-white px-3 py-2 font-display text-base tracking-wide text-navy">{created.password}</code>
        <button
          type="button"
          className="btn-outline px-3 py-2"
          onClick={() => navigator.clipboard.writeText(created.password).then(() => setCopied(true))}
        >
          <Copy className="h-4 w-4" aria-hidden /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-2 text-ink-muted">Sign-in email: {created.email}</p>
    </div>
  )
}

export function NewAccountForm({ roles }: { roles: Record<AppRole, string> }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(createAccountAction, {})
  return (
    <section className="card h-fit p-6">
      <h2 className="text-lg font-semibold">Add a staff member</h2>
      {state.created ? (
        <div className="mt-4 space-y-4">
          <TemporaryPassword created={state.created} />
          <a href="/admin/users" className="btn-outline w-full">Add another</a>
        </div>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy">Full name</span>
            <input name="full_name" className="field" required autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy">Official email address</span>
            <input name="email" type="email" className="field" placeholder="name@tsuniversity.edu.ng" required autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy">Role</span>
            <select name="role" className="field" required defaultValue="">
              <option value="" disabled>Choose a role</option>
              {(Object.keys(roles) as AppRole[]).map((r) => <option key={r} value={r}>{roles[r]}</option>)}
            </select>
          </label>
          {state.error && <Notice tone="bad">{state.error}</Notice>}
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
            Create account
          </button>
        </form>
      )}
    </section>
  )
}

export function AccountRow({
  userId, role, active, self, roles,
}: { userId: string; role: AppRole; active: boolean; self: boolean; roles: Record<AppRole, string> }) {
  const [updateState, update, saving] = useActionState<AccountState, FormData>(updateAccountAction, {})
  const [resetState, reset, resetting] = useActionState<AccountState, FormData>(resetAccessAction, {})
  return (
    <div className="space-y-3">
      <form action={update} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="user_id" value={userId} />
        <select name="role" defaultValue={role} disabled={self} className="field w-auto py-2 text-sm" aria-label="Role">
          {(Object.keys(roles) as AppRole[]).map((r) => <option key={r} value={r}>{roles[r]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={active} disabled={self} className="h-4 w-4 accent-[#0F1F3D]" /> Active
        </label>
        {!self && (
          <button type="submit" className="text-sm font-semibold text-navy hover:underline" disabled={saving}>
            {saving ? 'Saving' : 'Save'}
          </button>
        )}
      </form>
      {!self && (
        <form action={reset}>
          <input type="hidden" name="user_id" value={userId} />
          <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy" disabled={resetting}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Reset password and two-factor
          </button>
        </form>
      )}
      {updateState.error && <Notice tone="bad">{updateState.error}</Notice>}
      {resetState.error && <Notice tone="bad">{resetState.error}</Notice>}
      {resetState.created && <TemporaryPassword created={resetState.created} />}
    </div>
  )
}
