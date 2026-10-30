import Link from 'next/link'
import clsx from 'clsx'
import { requireRole } from '@/lib/admin/session'
import { actionLabel, AUDIT_TABLES, summarise, type AuditEntry } from '@/lib/admin/audit'
import { Empty, formatDateTime, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Audit log' }

const PAGE = 100

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string; before?: string }> }) {
  const { supabase } = await requireRole(['admin'])
  const sp = await searchParams
  const filter = sp.table && AUDIT_TABLES[sp.table] ? sp.table : null
  const before = sp.before && /^\d+$/.test(sp.before) ? Number(sp.before) : null

  let query = supabase.from('audit_log').select('*').order('id', { ascending: false }).limit(PAGE)
  if (filter) query = query.eq('table_name', filter)
  if (before) query = query.lt('id', before)
  const [{ data, error }, { data: people }] = await Promise.all([query.returns<AuditEntry[]>(), supabase.rpc('staff_directory')])
  const names = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]))
  const nameOf = (id: string | null) => (id ? names.get(id) ?? 'Unknown account' : 'System')
  const entries = data ?? []
  const older = entries.length === PAGE ? entries[entries.length - 1].id : null
  const href = (t: string, b?: number) => {
    const q = new URLSearchParams()
    if (t) q.set('table', t)
    if (b) q.set('before', String(b))
    return `/admin/audit${q.size ? `?${q}` : ''}`
  }

  return (
    <>
      <PageHeader title="Audit log" intro="Every change to the register, newest first. Entries can’t be edited or deleted by anyone, including Admins." />
      <nav aria-label="Filter" className="mb-5 flex flex-wrap gap-2">
        {[['', 'Everything'], ...Object.entries(AUDIT_TABLES)].map(([key, label]) => (
          <Link
            key={key || 'all'}
            href={href(key)}
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
      {error && <p className="mb-4 text-sm text-status-revoked">{error.message}</p>}
      {entries.length ? (
        <ol className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
          {entries.map((e) => (
            <li key={e.id} className="grid gap-1 px-5 py-3.5 text-sm md:grid-cols-[170px_170px_1fr] md:gap-4">
              <span className="text-ink-muted">{formatDateTime(e.at)}</span>
              <span className="font-medium text-navy">{nameOf(e.actor_id)}</span>
              <span className="min-w-0 break-words">
                <span className="mr-2 font-medium">
                  {actionLabel(e.action)} <span className="font-normal text-ink-faint">{(AUDIT_TABLES[e.table_name] ?? e.table_name).toLowerCase()}</span>
                </span>
                {e.table_name === 'graduates' && e.row_id && e.action !== 'delete' ? (
                  <Link href={`/admin/records/${e.row_id}`} className="text-navy underline-offset-2 hover:underline">{summarise(e)}</Link>
                ) : (
                  summarise(e)
                )}
                {e.reason && <span className="mt-1 block text-ink-muted">Reason: {e.reason}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No changes recorded yet" />
      )}
      {older && (
        <div className="mt-4 flex justify-end">
          <Link href={href(filter ?? '', older)} className="btn-outline btn-sm">Older entries</Link>
        </div>
      )}
    </>
  )
}
