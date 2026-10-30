import { NextResponse, type NextRequest } from 'next/server'
import { requireStaff } from '@/lib/admin/session'
import { applyFilters, parseFilters, REGISTER_COLUMNS } from '@/lib/admin/register-query'
import { describeFilters, effectiveColumns, fileName, parseOptions, type ExportRow } from '@/lib/admin/export/options'
import { describeFilterParts } from '@/lib/admin/export/describe'
import { buildWorkbook } from '@/lib/admin/export/excel'
import { buildPdf } from '@/lib/admin/export/pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ROWS = 20000
const CHUNK = 1000

export async function GET(req: NextRequest) {
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('No staff access', { status: 403 })
  const sp = Object.fromEntries([...new Set(req.nextUrl.searchParams.keys())].map((k) => {
    const all = req.nextUrl.searchParams.getAll(k)
    return [k, all.length > 1 ? all : all[0]]
  }))
  const filters = parseFilters(sp)
  const options = parseOptions(sp)

  const rows: ExportRow[] = []
  for (let from = 0; from < MAX_ROWS + 1; from += CHUNK) {
    const { data, error } = await applyFilters(supabase.from('register_view').select(REGISTER_COLUMNS), filters)
      .order('faculty_name')
      .order('department_name')
      .order('programme_name')
      .order('full_name')
      .order('id')
      .range(from, from + CHUNK - 1)
    if (error) return new NextResponse(`The records couldn’t be loaded: ${error.message}`, { status: 500 })
    rows.push(...((data ?? []) as unknown as ExportRow[]))
    if (!data || data.length < CHUNK) break
  }
  if (rows.length > MAX_ROWS) {
    return new NextResponse(`That is more than ${MAX_ROWS.toLocaleString('en-GB')} records. Narrow the filters (for example one session or faculty at a time).`, { status: 413 })
  }
  if (!rows.length) return new NextResponse('No records match these filters.', { status: 404 })

  const parts = await describeFilterParts(supabase, filters)
  const now = new Date()
  const heading = {
    title: options.title || 'Graduation register',
    filters: describeFilters(parts),
    generatedBy: profile.full_name,
    generatedAt: new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(now),
  }

  const body = options.format === 'pdf' ? await buildPdf(rows, options, heading) : await buildWorkbook(rows, options, heading)

  const { error: logError } = await supabase.rpc('log_export', {
    p_filters: { ...filters, title: heading.title, grouped: options.grouped },
    p_columns: effectiveColumns(options).map((c) => c.key),
    p_format: options.format,
    p_row_count: rows.length,
  })
  if (logError) return new NextResponse(`The export couldn’t be recorded, so it wasn’t released: ${logError.message}`, { status: 500 })

  const name = fileName(heading.title, options.format, now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }))
  return new NextResponse(body as BodyInit, {
    headers: {
      'Content-Type': options.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
