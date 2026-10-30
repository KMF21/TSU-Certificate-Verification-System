import Link from 'next/link'
import { Download } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { canWrite, sessionOptions } from '@/lib/admin/roles'
import { Badge, Empty, formatDateTime, PageHeader } from '@/components/admin/ui'
import { UploadWizard } from '@/components/admin/upload-wizard'

export const metadata = { title: 'Bulk upload' }

interface BatchRow {
  id: string
  file_name: string
  source: 'live' | 'legacy'
  uploaded_by: string
  uploaded_at: string
  accepted_count: number
  updated_count: number
  skipped_count: number
  rejected_count: number
  status: 'committed' | 'undone'
}

export default async function UploadPage() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const writer = canWrite(profile.role)
  const [reference, { data: batches }, { data: people }] = await Promise.all([
    writer ? loadReference(supabase) : Promise.resolve(null),
    supabase
      .from('import_batches')
      .select('id, file_name, source, uploaded_by, uploaded_at, accepted_count, updated_count, skipped_count, rejected_count, status')
      .order('uploaded_at', { ascending: false })
      .limit(25)
      .returns<BatchRow[]>(),
    supabase.rpc('staff_directory'),
  ])
  const names = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]))

  return (
    <>
      <PageHeader
        title="Bulk upload"
        intro="Add a whole list of graduates from Excel or CSV. Every row is checked before anything is saved, and all new records wait for approval."
        actions={
          <a href="/admin/upload/template" download className="btn-outline">
            <Download className="h-4 w-4" aria-hidden /> Download the template
          </a>
        }
      />
      {writer && reference ? (
        <UploadWizard reference={reference} sessions={sessionOptions()} />
      ) : (
        <Empty title="Viewers can’t upload">Ask a Records Officer or Admin to upload lists. You can still see past uploads below.</Empty>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-semibold text-navy">Recent uploads</h2>
        {batches?.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-navy-50/60 text-left text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 font-medium">Uploaded</th>
                  <th className="px-4 py-2.5 text-right font-medium">New</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                  <th className="px-4 py-2.5 text-right font-medium">Left out</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/upload/${b.id}`} className="font-medium text-navy underline-offset-2 hover:underline">{b.file_name}</Link>
                      <span className="ml-2 text-xs text-ink-muted">{b.source === 'live' ? 'Live' : 'Legacy'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(b.uploaded_at)} · {names.get(b.uploaded_by) ?? 'former staff'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.accepted_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.updated_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.skipped_count + b.rejected_count}</td>
                    <td className="px-4 py-2.5">{b.status === 'undone' ? <Badge tone="warn">Undone</Badge> : <Badge tone="good">Imported</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No uploads yet.</p>
        )}
      </section>
    </>
  )
}
