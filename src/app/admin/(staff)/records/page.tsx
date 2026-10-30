import Link from 'next/link'
import { Download, PlusCircle } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { canWrite, sessionOptions } from '@/lib/admin/roles'
import { loadReference } from '@/lib/admin/reference'
import { applyFilters, filtersToParams, parseFilters, REGISTER_COLUMNS, type RegisterRow } from '@/lib/admin/register-query'
import { Notice, PageHeader } from '@/components/admin/ui'
import { RecordFilters } from '@/components/admin/record-filters'
import { RecordsTable } from '@/components/admin/records-table'

export const metadata = { title: 'Records' }

const PAGE_SIZE = 50
const SORTS = {
  name: ['full_name', true],
  reg: ['reg_number', true],
  date: ['senate_approval_date', false],
  updated: ['updated_at', false],
} as const

export default async function RecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile, user } = await requireStaff()
  if (!profile) return null
  const sp = await searchParams
  const filters = parseFilters(sp)
  const sortKey = (typeof sp.sort === 'string' && sp.sort in SORTS ? sp.sort : 'updated') as keyof typeof SORTS
  const page = Math.max(1, Number.parseInt(String(sp.page ?? '1'), 10) || 1)

  const [column, ascending] = SORTS[sortKey]
  const query = applyFilters(supabase.from('register_view').select(REGISTER_COLUMNS, { count: 'exact' }), filters)
    .order(column, { ascending, nullsFirst: false })
    .order('id')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  const [{ data, count, error }, reference] = await Promise.all([query, loadReference(supabase)])
  const rows = (data ?? []) as unknown as RegisterRow[]
  const total = count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const base = filtersToParams(filters)
  if (sortKey !== 'updated') base.set('sort', sortKey)
  const pageHref = (p: number) => {
    const q = new URLSearchParams(base)
    if (p > 1) q.set('page', String(p))
    return `/admin/records${q.size ? `?${q}` : ''}`
  }
  const exportHref = `/admin/export${base.size ? `?${filtersToParams(filters)}` : ''}`

  return (
    <>
      <PageHeader
        title="Records"
        intro="Search, filter and approve graduation records. Approving and verifying need a second person: you can’t approve or verify a record you created or last edited."
        actions={
          <>
            {canWrite(profile.role) && (
              <Link href="/admin/records/new" className="btn-primary">
                <PlusCircle className="h-4 w-4" aria-hidden /> Add a record
              </Link>
            )}
            <Link href={exportHref} className="btn-outline">
              <Download className="h-4 w-4" aria-hidden /> Export these
            </Link>
          </>
        }
      />
      <RecordFilters filters={filters} sort={sortKey} reference={reference} sessions={sessionOptions()} />
      {error && (
        <div className="mt-4">
          <Notice tone="bad">The records couldn’t be loaded: {error.message}</Notice>
        </div>
      )}
      <RecordsTable
        rows={rows}
        total={total}
        page={page}
        pages={pages}
        pageSize={PAGE_SIZE}
        prevHref={page > 1 ? pageHref(page - 1) : null}
        nextHref={page < pages ? pageHref(page + 1) : null}
        canAct={canWrite(profile.role)}
        userId={user.id}
        sessions={sessionOptions()}
      />
    </>
  )
}
