import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { AdminNav } from '@/components/admin/admin-nav'
import { signOut } from '../auth-actions'

export const metadata: Metadata = {
  title: { default: 'Staff area', template: '%s | CPGS Graduation Register' },
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await requireStaff()

  if (!profile) {
    return (
      <main id="main" className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <div className="card max-w-md p-8">
          <ShieldOff className="h-8 w-8 text-status-revoked" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">No staff access</h1>
          <p className="mt-2 text-ink-muted">
            {user.email} is signed in but has no active staff role. Ask an Admin of the graduation register to set one up.
          </p>
          <form action={signOut} className="mt-6">
            <button className="btn-outline" type="submit">Sign out</button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminNav
        name={profile.full_name}
        role={profile.role}
        signOut={signOut}
      />
      <main id="main" className="min-w-0 flex-1 bg-canvas">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  )
}
