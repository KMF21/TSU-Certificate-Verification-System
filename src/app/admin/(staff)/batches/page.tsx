import Link from 'next/link'
import { FilePlus2 } from 'lucide-react'
import clsx from 'clsx'
import { requireStaff } from '@/lib/admin/session'
import { editableLevel, LEVEL_LABEL, type AwardLevel, type BatchStatus } from '@/lib/admin/roles'
import { BatchBadge, Empty, formatDateTime, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Batches' }

const FILTERS: { key: 'all' | BatchStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pending', label: 'Awaiting approval' },
  { key: 'rejected', label: 'Returned' },
  { key: 'approved', label: 'Approved' },
]

interface Row {
  id: string
  title: string
  award_level: AwardLevel
  session: string
  status: BatchStatus
  updated_at: string
  credentials: { count: number }[]
}

export default async function BatchesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const { status } = await searchParams
  const filter = FILTERS.find((f) => f.key === status)?.key ?? 'all'

  let query = supabase
    .from('batches')
    .select('id, title, award_level, session, status, updated_at, credentials(count)')
    .order('updated_at', { ascending: false })
    .limit(200)
  if (filter !== 'all') query = query.eq('status', filter)
  const { data } = await query.returns<Row[]>()
  const level = editableLevel(profile.role)

  return (
    <>
      <PageHeader
        title="Batches"
        intro="Each batch is one graduating list, usually one convocation for one faculty or for CPGS. Records in a batch are issued together when the Registrar approves it."
        actions={
          level ? (
            <Link href="/admin/batches/new" className="btn-primary">
              <FilePlus2 className="h-4 w-4" aria-hidden /> Start a batch
            </Link>
          ) : null
        }
      />

      <nav aria-label="Filter batches" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/admin/batches' : `/admin/batches?status=${f.key}`}
            aria-current={filter === f.key ? 'page' : undefined}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              filter === f.key ? 'bg-navy text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:text-navy',
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {data && data.length ? (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-canvas/60 text-ink-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Batch</th>
                <th scope="col" className="px-5 py-3 font-medium">Level</th>
                <th scope="col" className="px-5 py-3 font-medium">Session</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Records</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((b) => (
                <tr key={b.id} className="hover:bg-canvas/50">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/batches/${b.id}`} className="font-medium text-navy hover:underline">{b.title}</Link>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">{LEVEL_LABEL[b.award_level]}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{b.session}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{b.credentials[0]?.count ?? 0}</td>
                  <td className="px-5 py-3.5"><BatchBadge status={b.status} /></td>
                  <td className="px-5 py-3.5 text-ink-muted">{formatDateTime(b.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={filter === 'all' ? 'No batches yet' : 'Nothing here'}>
          {filter === 'all' && level ? 'Start a batch, then import the graduating list from the Excel template.' : null}
        </Empty>
      )}
    </>
  )
}
