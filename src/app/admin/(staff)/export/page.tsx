import { requireStaff } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { sessionOptions } from '@/lib/admin/roles'
import { applyFilters, filtersToParams, parseFilters, REGISTER_COLUMNS } from '@/lib/admin/register-query'
import { describeFilters, optionsToParams, parseOptions, type ExportRow } from '@/lib/admin/export/options'
import { describeFilterParts } from '@/lib/admin/export/describe'
import { Notice, PageHeader } from '@/components/admin/ui'
import { RecordFilters } from '@/components/admin/record-filters'
import { ExportBuilder, type Preset } from '@/components/admin/export-builder'

export const metadata = { title: 'Export' }

export default async function ExportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const sp = await searchParams
  const filters = parseFilters(sp)
  const options = parseOptions(sp)

  const [{ data, count, error }, reference, parts, { data: presetRows }] = await Promise.all([
    applyFilters(supabase.from('register_view').select(REGISTER_COLUMNS, { count: 'exact' }), filters)
      .order('faculty_name')
      .order('department_name')
      .order('programme_name')
      .order('full_name')
      .limit(12),
    loadReference(supabase),
    describeFilterParts(supabase, filters),
    supabase.from('export_presets').select('id, owner_id, name, filters, columns, shared').order('name'),
  ])

  const presets: Preset[] = (presetRows ?? []).map((p) => {
    const f = (p.filters ?? {}) as { params?: string; format?: string; grouped?: boolean; title?: string }
    const q = new URLSearchParams(f.params ?? '')
    optionsToParams({ columns: p.columns as never, format: f.format === 'pdf' ? 'pdf' : 'xlsx', grouped: f.grouped !== false, title: f.title ?? '' }, q)
    return { id: p.id, name: p.name, shared: p.shared, mine: p.owner_id === profile.user_id, query: q.toString() }
  })

  return (
    <>
      <PageHeader
        title="Export"
        intro="Choose the records and columns, then download a list in Excel or PDF. Every download is recorded in the audit log."
      />
      <RecordFilters filters={filters} reference={reference} sessions={sessionOptions()} action="/admin/export" carry={['cols', 'fmt', 'group', 'title']} />
      {error && <div className="mt-4"><Notice tone="bad">The records couldn’t be counted: {error.message}</Notice></div>}
      <ExportBuilder
        count={count ?? 0}
        preview={(data ?? []) as unknown as ExportRow[]}
        filterQuery={filtersToParams(filters).toString()}
        filterSummary={describeFilters(parts)}
        initial={options}
        presets={presets}
      />
    </>
  )
}
