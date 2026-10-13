import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, QrCode, Trash2 } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { canDecide, editableLevel, LEVEL_LABEL, type AwardLevel, type BatchStatus, type CredentialStatus } from '@/lib/admin/roles'
import { BatchBadge, CredentialBadge, Empty, formatDateTime, formatDay, Notice, PageHeader } from '@/components/admin/ui'
import { ImportPanel } from '@/components/admin/import-panel'
import { DecisionPanel, SubmitPanel } from '@/components/admin/batch-panels'
import { deleteBatchAction, removeRecordAction } from '../actions'

export const metadata = { title: 'Batch' }

interface Batch {
  id: string
  title: string
  award_level: AwardLevel
  session: string
  status: BatchStatus
  created_by: string
  submitted_by: string | null
  submitted_at: string | null
  decided_by: string | null
  decided_at: string | null
  decision_reason: string | null
  created_at: string
}

interface Record {
  id: string
  status: CredentialStatus
  class_of_degree: string | null
  date_of_award: string
  serial_no: string | null
  verify_code: string | null
  graduates: { surname: string; other_names: string; matric_no: string }
  programmes: { code: string; name: string; award_title: string }
}

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const { supabase, profile } = await requireStaff()
  if (!profile) return null

  const [{ data: batch }, { data: records }] = await Promise.all([
    supabase.from('batches').select('*').eq('id', id).maybeSingle<Batch>(),
    supabase
      .from('credentials')
      .select('id, status, class_of_degree, date_of_award, serial_no, verify_code, graduates(surname, other_names, matric_no), programmes(code, name, award_title)')
      .eq('batch_id', id)
      .returns<Record[]>(),
  ])
  if (!batch) notFound()

  const peopleIds = [batch.created_by, batch.submitted_by, batch.decided_by].filter(Boolean) as string[]
  const { data: people } = await supabase.from('profiles').select('user_id, full_name').in('user_id', peopleIds)
  const nameOf = (uid: string | null, fallback: string) => people?.find((p) => p.user_id === uid)?.full_name ?? fallback

  const rows = (records ?? []).slice().sort((a, b) =>
    (a.serial_no ?? '').localeCompare(b.serial_no ?? '') ||
    a.graduates.surname.localeCompare(b.graduates.surname) ||
    a.graduates.other_names.localeCompare(b.graduates.other_names),
  )
  const canEdit = editableLevel(profile.role) === batch.award_level && (batch.status === 'draft' || batch.status === 'rejected')
  const canApprove = canDecide(profile.role) && batch.status === 'pending'
  const issued = batch.status === 'approved'

  return (
    <>
      <Link href="/admin/batches" className="text-sm font-medium text-ink-muted hover:text-navy">All batches</Link>
      <div className="mt-3">
        <PageHeader
          title={batch.title}
          intro={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <BatchBadge status={batch.status} />
              <span>{LEVEL_LABEL[batch.award_level]}</span>
              <span>{batch.session} session</span>
              <span>{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
            </span>
          }
        />
      </div>

      <div className="space-y-4">
        {batch.status === 'rejected' && batch.decision_reason && (
          <Notice tone="warn">
            <strong className="font-semibold">Returned by {nameOf(batch.decided_by, 'the Registrar')}</strong> on {formatDateTime(batch.decided_at)}:{' '}
            {batch.decision_reason}
          </Notice>
        )}
        {batch.status === 'pending' && !canApprove && (
          <Notice tone="info">
            Sent for approval by {nameOf(batch.submitted_by, 'a Records Officer')} on {formatDateTime(batch.submitted_at)}. It can’t be
            changed while the Registrar reviews it.
          </Notice>
        )}
        {issued && (
          <Notice tone="good">
            Approved by {nameOf(batch.decided_by, 'the Registrar')} on {formatDateTime(batch.decided_at)}. These certificates are now
            verifiable on the public site.
          </Notice>
        )}
      </div>

      {canEdit && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <ImportPanel batchId={batch.id} level={batch.award_level} />
          <SubmitPanel batchId={batch.id} count={rows.length} />
        </div>
      )}

      {canApprove && (
        <div className="mt-6">
          <DecisionPanel
            batchId={batch.id}
            count={rows.length}
            submittedBy={nameOf(batch.submitted_by, 'a Records Officer')}
            submittedAt={formatDateTime(batch.submitted_at)}
            ownSubmission={batch.submitted_by === profile.user_id}
          />
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Records</h2>
        {rows.length ? (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-ink-muted">
                <tr>
                  {issued && <th scope="col" className="px-4 py-3 font-medium">Serial</th>}
                  <th scope="col" className="px-4 py-3 font-medium">Graduate</th>
                  <th scope="col" className="px-4 py-3 font-medium">Matric number</th>
                  <th scope="col" className="px-4 py-3 font-medium">Award</th>
                  <th scope="col" className="px-4 py-3 font-medium">{batch.award_level === 'undergraduate' ? 'Class' : 'Grade'}</th>
                  <th scope="col" className="px-4 py-3 font-medium">Date of award</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    {issued && <td className="whitespace-nowrap px-4 py-3 font-display text-[13px] tracking-wide text-navy">{r.serial_no}</td>}
                    <td className="px-4 py-3 font-medium text-navy">
                      {r.graduates.surname.toUpperCase()}, {r.graduates.other_names}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-display text-[13px] tracking-wide">{r.graduates.matric_no}</td>
                    <td className="px-4 py-3">
                      {r.programmes.award_title} {r.programmes.name}
                      <span className="block text-xs text-ink-faint">{r.programmes.code}</span>
                    </td>
                    <td className="px-4 py-3">{r.class_of_degree ?? <span className="text-ink-faint">None</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDay(r.date_of_award)}</td>
                    <td className="px-4 py-3"><CredentialBadge status={r.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {canEdit && (
                        <form action={removeRecordAction}>
                          <input type="hidden" name="batch_id" value={batch.id} />
                          <input type="hidden" name="credential_id" value={r.id} />
                          <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-medium text-status-revoked hover:underline">
                            <Trash2 className="h-4 w-4" aria-hidden /> Remove
                          </button>
                        </form>
                      )}
                      {r.verify_code && (
                        <span className="inline-flex gap-4">
                          <a href={`/admin/credentials/${r.id}/qr`} className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline">
                            <QrCode className="h-4 w-4" aria-hidden /> QR
                          </a>
                          <a href={`/admin/credentials/${r.id}/open`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-medium text-navy hover:underline">
                            <ExternalLink className="h-4 w-4" aria-hidden /> Public page
                          </a>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No records yet">{canEdit ? 'Download the template, fill in the graduating list and upload it above.' : null}</Empty>
        )}
      </section>

      {canEdit && (
        <form action={deleteBatchAction} className="mt-10 border-t border-line pt-6">
          <input type="hidden" name="batch_id" value={batch.id} />
          <button type="submit" className="inline-flex items-center gap-2 text-sm font-medium text-status-revoked hover:underline">
            <Trash2 className="h-4 w-4" aria-hidden /> Delete this draft batch
          </button>
        </form>
      )}
    </>
  )
}
