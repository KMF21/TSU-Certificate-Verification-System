import Link from 'next/link'
import { ArrowUpRight, FilePlus2 } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { canSeeAudit, editableLevel, LEVEL_LABEL, type AwardLevel, type BatchStatus } from '@/lib/admin/roles'
import { BatchBadge, Empty, formatDateTime, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Overview' }

interface BatchRow {
  id: string
  title: string
  award_level: AwardLevel
  session: string
  status: BatchStatus
  updated_at: string
}

export default async function OverviewPage() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null

  const count = (status: string) =>
    supabase.from('credentials').select('id', { count: 'exact', head: true }).eq('status', status).then((r) => r.count ?? 0)

  const since = new Date(Date.now() - 30 * 864e5).toISOString()
  const [issued, revoked, superseded, inProgress, pendingBatches, recent, checks] = await Promise.all([
    count('approved'),
    count('revoked'),
    count('superseded'),
    supabase.from('credentials').select('id', { count: 'exact', head: true }).in('status', ['draft', 'pending']).then((r) => r.count ?? 0),
    supabase.from('batches').select('id, title, award_level, session, status, updated_at').eq('status', 'pending').order('submitted_at').returns<BatchRow[]>(),
    supabase.from('batches').select('id, title, award_level, session, status, updated_at').order('updated_at', { ascending: false }).limit(6).returns<BatchRow[]>(),
    canSeeAudit(profile.role)
      ? supabase.from('verification_events').select('id', { count: 'exact', head: true }).gte('at', since).then((r) => r.count ?? 0)
      : Promise.resolve(null),
  ])

  const level = editableLevel(profile.role)
  const waiting = pendingBatches.data ?? []

  return (
    <>
      <PageHeader
        title={`Good to see you, ${profile.full_name.split(' ')[0]}`}
        intro={
          profile.role === 'registrar'
            ? waiting.length
              ? `${waiting.length} ${waiting.length === 1 ? 'batch is' : 'batches are'} waiting for your decision.`
              : 'No batches are waiting for your decision.'
            : level
              ? `You prepare ${LEVEL_LABEL[level].toLowerCase()} records for the Registrar to approve.`
              : 'Here is the state of the register.'
        }
        actions={
          level ? (
            <Link href="/admin/batches/new" className="btn-primary">
              <FilePlus2 className="h-4 w-4" aria-hidden /> Start a batch
            </Link>
          ) : null
        }
      />

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Certificates issued" value={issued} />
        <Stat label="Records being prepared" value={inProgress} />
        <Stat label="Revoked or replaced" value={revoked + superseded} />
        {checks !== null ? <Stat label="Verifications, last 30 days" value={checks} /> : <Stat label="Batches awaiting approval" value={waiting.length} />}
      </dl>

      {profile.role === 'registrar' && waiting.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Waiting for your decision</h2>
          <BatchList rows={waiting} />
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent batches</h2>
          <Link href="/admin/batches" className="text-sm font-semibold text-navy hover:underline">All batches</Link>
        </div>
        {recent.data && recent.data.length > 0 ? (
          <BatchList rows={recent.data} />
        ) : (
          <div className="mt-4">
            <Empty title="No batches yet">
              {level ? 'Start a batch for a convocation and import its graduating list.' : 'Records Officers create batches from Senate graduating lists.'}
            </Empty>
          </div>
        )}
      </section>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-2 font-display text-3xl font-semibold text-navy">{value.toLocaleString('en-NG')}</dd>
    </div>
  )
}

function BatchList({ rows }: { rows: BatchRow[] }) {
  return (
    <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
      {rows.map((b) => (
        <li key={b.id}>
          <Link href={`/admin/batches/${b.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-canvas/60">
            <div className="min-w-0">
              <p className="truncate font-medium text-navy">{b.title}</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                {LEVEL_LABEL[b.award_level]}, {b.session} session. Updated {formatDateTime(b.updated_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <BatchBadge status={b.status} />
              <ArrowUpRight className="h-4 w-4 text-ink-faint" aria-hidden />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
