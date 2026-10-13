import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/admin/session'
import { canManageUsers, ROLE_LABEL, type AppRole } from '@/lib/admin/roles'
import { Badge, formatDateTime, PageHeader } from '@/components/admin/ui'
import { AccountRow, NewAccountForm } from '@/components/admin/account-forms'

export const metadata = { title: 'Staff accounts' }

export default async function UsersPage() {
  const { supabase, profile } = await requireStaff()
  if (!profile || !canManageUsers(profile.role)) redirect('/admin')
  const { data } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, active, created_at')
    .order('active', { ascending: false })
    .order('full_name')
    .returns<{ user_id: string; full_name: string; email: string; role: AppRole; active: boolean; created_at: string }[]>()

  return (
    <>
      <PageHeader
        title="Staff accounts"
        intro="Each person gets their own account; never share one. New accounts get a temporary password and set up two-factor sign-in the first time they sign in."
      />
      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-canvas/60 text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Person</th>
                <th scope="col" className="px-4 py-3 font-medium">Role and access</th>
                <th scope="col" className="px-4 py-3 font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((p) => (
                <tr key={p.user_id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy">
                      {p.full_name} {p.user_id === profile.user_id && <Badge tone="neutral">You</Badge>}
                    </p>
                    <p className="text-ink-muted">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <AccountRow userId={p.user_id} role={p.role} active={p.active} self={p.user_id === profile.user_id} roles={ROLE_LABEL} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <NewAccountForm roles={ROLE_LABEL} />
      </div>
    </>
  )
}
