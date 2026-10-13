import type { Metadata } from 'next'
import { AuthShell } from '@/components/admin/auth-shell'
import { TwoFactorForm } from '@/components/admin/two-factor-form'
import { signOut } from '../auth-actions'

export const metadata: Metadata = { title: 'Two-factor sign-in', robots: { index: false, follow: false } }

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const safeNext = next?.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'
  return (
    <AuthShell
      title="Confirm it’s you"
      intro="Staff permissions only switch on after this step, so a stolen password alone can’t change the register."
    >
      <TwoFactorForm next={safeNext} />
      <form action={signOut} className="mt-6">
        <button type="submit" className="text-sm font-medium text-ink-muted underline-offset-4 hover:text-navy hover:underline">
          Sign out
        </button>
      </form>
    </AuthShell>
  )
}
