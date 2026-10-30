import Link from 'next/link'
import { ArrowUpRight, PlusCircle, Upload } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { canWrite } from '@/lib/admin/roles'
import { Notice, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Overview' }

interface Stats {
  total: number
  pending: number
  approved: number
  legacy_unverified: number
  sample: number
  by_session: { session: string; approved: number; pending: number }[]
  by_faculty: { faculty: string; approved: number; pending: number }[]
}

const fmt = (n: number) => new Intl.NumberFormat('en-GB').format(n)

export default async function OverviewPage() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const { data, error } = await supabase.rpc('register_stats')
  const stats = (data ?? { total: 0, pending: 0, approved: 0, legacy_unverified: 0, sample: 0, by_session: [], by_faculty: [] }) as Stats
  const writer = canWrite(profile.role)

  const tiles = [
    { label: 'Records in the register', value: stats.total, href: '/admin/records' },
    { label: 'Waiting for approval', value: stats.pending, href: '/admin/records?status=pending', tone: stats.pending ? 'text-[#1D4E89]' : '' },
    { label: 'Approved', value: stats.approved, href: '/admin/records?status=approved' },
    {
      label: 'Legacy records not yet verified',
      value: stats.legacy_unverified,
      href: '/admin/records?source=legacy&verification=unverified',
      tone: stats.legacy_unverified ? 'text-status-superseded' : '',
    },
  ]
  const maxFaculty = Math.max(1, ...stats.by_faculty.map((f) => f.approved + f.pending))

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name.split(' ')[0]}`}
        intro="Graduation records of the College of Postgraduate Studies, Taraba State University."
        actions={
          writer && (
            <>
              <Link href="/admin/records/new" className="btn-primary">
                <PlusCircle className="h-4 w-4" aria-hidden /> Add a record
              </Link>
              <Link href="/admin/upload" className="btn-outline">
                <Upload className="h-4 w-4" aria-hidden /> Bulk upload
              </Link>
            </>
          )
        }
      />

      {error && <Notice tone="bad">The figures couldn’t be loaded: {error.message}</Notice>}
      {stats.sample > 0 && (
        <div className="mb-6">
          <Notice tone="warn">
            {fmt(stats.sample)} sample record{stats.sample === 1 ? '' : 's'} are in the register for testing. They are marked “Sample” and will be
            removed before the register goes live. The programme list is also a sample until CPGS confirms it.
          </Notice>
        </div>
      )}

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card group p-5 transition-colors hover:border-navy/30">
            <p className="flex items-start justify-between gap-2 text-sm text-ink-muted">
              {t.label}
              <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-navy" aria-hidden />
            </p>
            <p className={`mt-3 font-display text-3xl font-semibold tabular-nums text-navy ${t.tone ?? ''}`}>{fmt(t.value)}</p>
          </Link>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3">
          <h2 className="font-display text-lg font-semibold text-navy">By faculty</h2>
          {stats.by_faculty.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No records yet.</p>
          ) : (
            <ul className="mt-5 space-y-3.5">
              {stats.by_faculty.map((f) => {
                const total = f.approved + f.pending
                return (
                  <li key={f.faculty}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{f.faculty}</span>
                      <span className="shrink-0 tabular-nums text-ink-muted">
                        {fmt(f.approved)} approved{f.pending ? ` · ${fmt(f.pending)} pending` : ''}
                      </span>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-navy-50" aria-hidden>
                      <div className="bg-navy" style={{ width: `${(f.approved / maxFaculty) * 100}%` }} />
                      <div className="bg-[#7FA3D6]" style={{ width: `${(f.pending / maxFaculty) * 100}%` }} />
                    </div>
                    <span className="sr-only">{total} records</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-5 flex gap-4 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy" /> Approved</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7FA3D6]" /> Pending</span>
          </p>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-navy">By graduation session</h2>
          {stats.by_session.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">No records yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted">
                  <th className="py-2 font-medium">Session</th>
                  <th className="py-2 text-right font-medium">Approved</th>
                  <th className="py-2 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_session.map((s) => (
                  <tr key={s.session} className="border-t border-line">
                    <td className="py-2.5">
                      {s.session === 'Not set' ? (
                        <span className="text-ink-muted">Not set</span>
                      ) : (
                        <Link className="text-navy underline-offset-2 hover:underline" href={`/admin/records?session=${encodeURIComponent(s.session)}`}>
                          {s.session}
                        </Link>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{fmt(s.approved)}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-muted">{fmt(s.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  )
}
