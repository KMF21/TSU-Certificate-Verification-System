import Link from 'next/link'
import { redirect } from 'next/navigation'
import clsx from 'clsx'
import { requireStaff } from '@/lib/admin/session'
import { canSeeAudit } from '@/lib/admin/roles'
import { Empty, formatDateTime, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Audit log' }

const TABLES: Record<string, string> = {
  credentials: 'Certificates',
  batches: 'Batches',
  graduates: 'Graduates',
  profiles: 'Staff accounts',
  programmes: 'Programmes',
  departments: 'Departments',
  faculties: 'Faculties',
}

interface Entry {
  id: number
  at: string
  actor_id: string | null
  action: 'insert' | 'update' | 'delete'
  table_name: string
  row_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

/** Plain-language summary of one change: which fields moved, and to what. */
function describe(e: Entry): string {
  const subject = (TABLES[e.table_name] ?? e.table_name).replace(/s$/, '').toLowerCase()
  if (e.action === 'insert') {
    const a = e.after ?? {}
    const label = (a.title ?? a.full_name ?? a.name ?? a.matric_no ?? a.code ?? '') as string
    return `Created ${subject}${label ? ` “${label}”` : ''}`
  }
  if (e.action === 'delete') return `Deleted ${subject}`
  const skip = new Set(['updated_at', 'created_at'])
  const changed = Object.keys(e.after ?? {}).filter((k) => !skip.has(k) && JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k]))
  if (!changed.length) return `Touched ${subject}`
  return changed
    .slice(0, 4)
    .map((k) => `${k.replace(/_/g, ' ')}: ${e.before?.[k] ?? 'empty'} → ${e.after?.[k] ?? 'empty'}`)
    .join('; ')
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { supabase, profile } = await requireStaff()
  if (!profile || !canSeeAudit(profile.role)) redirect('/admin')
  const { table } = await searchParams
  const filter = table && TABLES[table] ? table : null

  let query = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300)
  if (filter) query = query.eq('table_name', filter)
  const { data } = await query.returns<Entry[]>()
  const actorIds = [...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean))] as string[]
  const { data: people } = await supabase.from('profiles').select('user_id, full_name').in('user_id', actorIds.length ? actorIds : ['00000000-0000-0000-0000-000000000000'])
  const nameOf = (id: string | null) => (id ? people?.find((p) => p.user_id === id)?.full_name ?? 'Unknown account' : 'System')

  return (
    <>
      <PageHeader title="Audit log" intro="Every change to the register, newest first. Entries can’t be edited or deleted, by anyone." />
      <nav aria-label="Filter" className="mb-5 flex flex-wrap gap-2">
        {[['', 'Everything'], ...Object.entries(TABLES)].map(([key, label]) => (
          <Link
            key={key || 'all'}
            href={key ? `/admin/audit?table=${key}` : '/admin/audit'}
            aria-current={(filter ?? '') === key ? 'page' : undefined}
            className={clsx(
              'rounded-full px-4 py-2 text-sm font-semibold',
              (filter ?? '') === key ? 'bg-navy text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:text-navy',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {data && data.length ? (
        <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {data.map((e) => (
            <li key={e.id} className="grid gap-1 px-5 py-3.5 text-sm md:grid-cols-[180px_200px_1fr] md:gap-4">
              <span className="text-ink-muted">{formatDateTime(e.at)}</span>
              <span className="font-medium text-navy">{nameOf(e.actor_id)}</span>
              <span className="min-w-0 break-words">
                <span className="mr-2 text-ink-faint">{TABLES[e.table_name] ?? e.table_name}</span>
                {describe(e)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No changes recorded yet" />
      )}
    </>
  )
}
