import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ListChecks } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { FIELD_LABEL, type ImportField } from '@/lib/admin/import/fields'
import { Badge, formatDateTime, formatDay, Notice, PageHeader } from '@/components/admin/ui'
import { BatchTools } from '@/components/admin/batch-tools'

export const metadata = { title: 'Upload report' }

interface Batch {
  id: string
  file_name: string
  source: 'live' | 'legacy'
  uploaded_by: string
  uploaded_at: string
  column_mapping: Record<string, ImportField>
  shared_values: Record<string, string>
  accepted_count: number
  updated_count: number
  skipped_count: number
  rejected_count: number
  report: { row: number; reg_number: string; full_name: string; outcome: 'skipped' | 'rejected'; reason: string }[]
  status: 'committed' | 'undone'
  undone_by: string | null
  undone_at: string | null
  undo_reason: string | null
}

export default async function BatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params
  const { new: fresh } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const [{ data: b }, { data: people }, { data: changes }] = await Promise.all([
    supabase.from('import_batches').select('*').eq('id', id).maybeSingle<Batch>(),
    supabase.rpc('staff_directory'),
    supabase.from('import_batch_changes').select('graduate_id, action').eq('batch_id', id).limit(10000),
  ])
  if (!b) notFound()
  const names = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]))
  const who = (u: string | null) => (u ? names.get(u) ?? 'a former staff member' : '')

  // Created records with their current state, for the report download.
  const createdIds = (changes ?? []).filter((c) => c.action === 'created').map((c) => c.graduate_id)
  const updatedIds = (changes ?? []).filter((c) => c.action === 'updated').map((c) => c.graduate_id)
  const imported: { row: number | null; reg_number: string; full_name: string; outcome: string; reason: string }[] = []
  for (let i = 0; i < createdIds.length + updatedIds.length; i += 300) {
    const ids = [...createdIds, ...updatedIds].slice(i, i + 300)
    const { data } = await supabase.from('graduates').select('id, reg_number, full_name, status').in('id', ids)
    for (const g of data ?? []) {
      imported.push({ row: null, reg_number: g.reg_number, full_name: g.full_name, outcome: createdIds.includes(g.id) ? 'added' : 'updated', reason: g.status === 'approved' ? 'Since approved' : 'Pending approval' })
    }
  }
  const sharedLabel: Record<string, string> = { programme_id: 'Programme', graduation_session: 'Session', senate_approval_date: 'Senate date', class_id: 'Class' }
  let sharedProgramme = ''
  if (b.shared_values.programme_id) {
    const { data: p } = await supabase.from('programmes').select('award_title, name').eq('id', b.shared_values.programme_id).maybeSingle()
    sharedProgramme = p ? `${p.award_title} ${p.name}` : ''
  }
  let sharedClass = ''
  if (b.shared_values.class_id) {
    const { data: c } = await supabase.from('degree_classes').select('label').eq('id', b.shared_values.class_id).maybeSingle()
    sharedClass = c?.label ?? ''
  }
  const sharedText = (k: string, v: string) =>
    k === 'programme_id' ? sharedProgramme : k === 'class_id' ? sharedClass : k === 'senate_approval_date' ? formatDay(v) : v

  return (
    <>
      <Link href="/admin/upload" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Bulk upload
      </Link>
      <PageHeader
        title={b.file_name}
        intro={`${b.source === 'live' ? 'Live' : 'Legacy'} records uploaded by ${who(b.uploaded_by)} on ${formatDateTime(b.uploaded_at)}`}
        actions={
          b.status === 'committed' && b.accepted_count + b.updated_count > 0 && (
            <Link href={`/admin/records?batch=${b.id}`} className="btn-primary">
              <ListChecks className="h-4 w-4" aria-hidden /> Review and approve these
            </Link>
          )
        }
      />
      {fresh && b.status === 'committed' && (
        <div className="mb-6">
          <Notice tone="good">
            Imported. {b.accepted_count} new record{b.accepted_count === 1 ? '' : 's'}
            {b.updated_count ? ` and ${b.updated_count} update${b.updated_count === 1 ? '' : 's'}` : ''} are now pending. Another officer can approve them.
          </Notice>
        </div>
      )}
      {b.status === 'undone' && (
        <div className="mb-6">
          <Notice tone="warn">Undone by {who(b.undone_by)} on {formatDateTime(b.undone_at)}. Reason: {b.undo_reason}</Notice>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['New records', b.accepted_count],
          ['Updated', b.updated_count],
          ['Skipped', b.skipped_count],
          ['Rejected', b.rejected_count],
        ].map(([label, n]) => (
          <div key={label as string} className="card p-4">
            <p className="text-xs text-ink-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{n}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 font-display text-base font-semibold text-navy">Rows left out</h2>
          {b.report.length ? (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-navy-50 text-left text-ink-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">Graduate</th>
                    <th className="px-4 py-2 font-medium">Outcome</th>
                    <th className="px-4 py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {b.report.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-4 py-2 tabular-nums text-ink-muted">{r.row}</td>
                      <td className="px-4 py-2">
                        {r.full_name || <span className="text-ink-faint">No name</span>}
                        <span className="block font-mono text-xs text-ink-muted">{r.reg_number}</span>
                      </td>
                      <td className="px-4 py-2">{r.outcome === 'rejected' ? <Badge tone="bad">Rejected</Badge> : <Badge tone="neutral">Skipped</Badge>}</td>
                      <td className="px-4 py-2 text-ink-muted">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-muted">Nothing was left out. Every row was imported.</p>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card p-5 text-sm">
            <h2 className="font-display text-base font-semibold text-navy">How the file was read</h2>
            <dl className="mt-3 space-y-1.5">
              {Object.entries(b.column_mapping).map(([col, f]) => (
                <div key={col} className="flex justify-between gap-3">
                  <dt className="truncate text-ink-muted">{col}</dt>
                  <dd className="shrink-0">{FIELD_LABEL[f] ?? f}</dd>
                </div>
              ))}
              {Object.entries(b.shared_values).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-t border-line pt-1.5">
                  <dt className="text-ink-muted">{sharedLabel[k] ?? k} (whole file)</dt>
                  <dd className="text-right">{sharedText(k, v)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <BatchTools
            batchId={b.id}
            fileName={b.file_name}
            canUndo={profile.role === 'admin' && b.status === 'committed'}
            rows={[...imported, ...b.report.map((r) => ({ ...r, outcome: r.outcome as string }))]}
          />
        </aside>
      </div>
    </>
  )
}
