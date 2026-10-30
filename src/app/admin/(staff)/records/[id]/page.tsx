import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react'
import { requireStaff } from '@/lib/admin/session'
import { canWrite, LEVEL_LABEL, SOURCE_LABEL, sessionOptions, type ProgrammeLevel, type RecordSource, type RecordStatus, type VerificationState } from '@/lib/admin/roles'
import { actionLabel, changedFields, type AuditEntry } from '@/lib/admin/audit'
import { formatDateTime, formatDay, Notice, PageHeader, RecordBadge, SampleBadge, SourceBadge } from '@/components/admin/ui'
import { RecordActions } from '@/components/admin/record-actions'

export const metadata = { title: 'Record' }

interface Detail {
  id: string
  full_name: string
  reg_number: string
  cgpa: number | null
  remark: string | null
  graduation_session: string | null
  senate_approval_date: string | null
  status: RecordStatus
  source: RecordSource
  verification_status: VerificationState
  is_sample: boolean
  certificate_serial: string | null
  verify_code: string | null
  import_batch_id: string | null
  class_of_degree: string | null
  programme_name: string
  programme_code: string
  award_title: string
  level: ProgrammeLevel
  department_name: string
  faculty_name: string
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
  approved_by: string | null
  approved_at: string | null
  verified_by: string | null
  verified_at: string | null
}

export default async function RecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  const { saved } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase, profile, user } = await requireStaff()
  if (!profile) return null

  const [{ data: r }, { data: history }, { data: people }, { data: programmes }, { data: classes }] = await Promise.all([
    supabase.from('register_view').select('*').eq('id', id).maybeSingle<Detail>(),
    supabase.from('audit_log').select('*').eq('table_name', 'graduates').eq('row_id', id).order('id', { ascending: false }).limit(100).returns<AuditEntry[]>(),
    supabase.rpc('staff_directory'),
    supabase.from('programmes').select('id, award_title, name'),
    supabase.from('degree_classes').select('id, label'),
  ])
  if (!r) notFound()

  const names = new Map(((people ?? []) as { user_id: string; full_name: string }[]).map((p) => [p.user_id, p.full_name]))
  const who = (uid: string | null) => (uid ? names.get(uid) ?? 'a former staff member' : 'the system')
  const programmeName = new Map((programmes ?? []).map((p) => [p.id, `${p.award_title} ${p.name}`]))
  const className = new Map((classes ?? []).map((c) => [c.id, c.label]))
  const nameValue = (field: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return 'empty'
    if (field === 'programme_id') return programmeName.get(String(v)) ?? 'another programme'
    if (field === 'class_id') return className.get(String(v)) ?? 'another class'
    return String(v)
  }

  const writer = canWrite(profile.role)
  const own = r.created_by === user.id || r.updated_by === user.id

  return (
    <>
      <Link href="/admin/records" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All records
      </Link>
      <PageHeader
        title={r.full_name}
        intro={<span className="font-mono text-sm">{r.reg_number}</span>}
        actions={
          writer && (
            <Link href={`/admin/records/${r.id}/edit`} className="btn-outline">
              <Pencil className="h-4 w-4" aria-hidden /> {r.status === 'approved' ? 'Correct this record' : 'Edit'}
            </Link>
          )
        }
      />
      {saved && (
        <div className="mb-6">
          <Notice tone="good">Saved.</Notice>
        </div>
      )}
      {r.source === 'legacy' && r.verification_status === 'unverified' && (
        <div className="mb-6">
          <Notice tone="warn">
            This legacy record has not been verified against official documents. Until it is, public checks show “Record under review, contact the College of Postgraduate Studies”.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex flex-wrap gap-1.5">
              <RecordBadge status={r.status} source={r.source} verification={r.verification_status} />
              <SourceBadge source={r.source} />
              {r.is_sample && <SampleBadge />}
            </div>
            <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <Item label="Programme" value={`${r.award_title} ${r.programme_name}`} />
              <Item label="Level" value={LEVEL_LABEL[r.level]} />
              <Item label="Department" value={r.department_name} />
              <Item label="Faculty" value={r.faculty_name} />
              <Item label="Class of degree" value={r.class_of_degree} />
              <Item label="CGPA" value={r.cgpa != null ? Number(r.cgpa).toFixed(2) : null} />
              <Item label="Graduation session" value={r.graduation_session} />
              <Item label="Senate approval date" value={r.senate_approval_date ? formatDay(r.senate_approval_date) : null} />
              <Item label="Source" value={SOURCE_LABEL[r.source]} />
              <Item label="Remark" value={r.remark} />
            </dl>
          </section>

          {r.certificate_serial && (
            <section className="card p-6">
              <h2 className="font-display text-base font-semibold text-navy">Certificate</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <Item label="Serial number" value={<span className="font-mono">{r.certificate_serial}</span>} />
                <Item
                  label="Verification code"
                  value={
                    r.verify_code && (
                      <Link href={`/c/${r.verify_code}`} target="_blank" className="inline-flex items-center gap-1 font-mono text-navy underline-offset-2 hover:underline">
                        {r.verify_code} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    )
                  }
                />
              </dl>
              <p className="mt-3 text-xs text-ink-muted">The QR code on the printed certificate points to this verification code.</p>
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-display text-base font-semibold text-navy">History</h2>
            {!history?.length ? (
              <p className="mt-3 text-sm text-ink-muted">No history recorded.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
                {history.map((e) => {
                  const changes = e.action === 'update' || e.action === 'edit_approved' ? changedFields(e, nameValue) : []
                  return (
                    <li key={e.id} className="relative text-sm">
                      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-navy" aria-hidden />
                      <p>
                        <span className="font-medium">{e.action === 'insert' && r.import_batch_id ? 'Uploaded' : actionLabel(e.action)}</span>{' '}
                        by {who(e.actor_id)} <span className="text-ink-muted">· {formatDateTime(e.at)}</span>
                      </p>
                      {e.reason && <p className="mt-0.5 text-ink-muted">Reason: {e.reason}</p>}
                      {changes.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-ink-muted">
                          {changes.map(([f, b, a]) => (
                            <li key={f}>
                              {f}: <s className="decoration-ink-faint">{b}</s> → <span className="text-ink">{a}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6 text-sm">
            <h2 className="font-display text-base font-semibold text-navy">Sign-off</h2>
            <dl className="mt-4 space-y-3">
              <Item label="Entered" value={`${who(r.created_by)}, ${formatDateTime(r.created_at)}`} />
              <Item label="Last edited" value={`${who(r.updated_by)}, ${formatDateTime(r.updated_at)}`} />
              <Item label="Approved" value={r.approved_at ? `${who(r.approved_by)}, ${formatDateTime(r.approved_at)}` : 'Not yet'} />
              {r.source === 'legacy' && <Item label="Verified" value={r.verified_at ? `${who(r.verified_by)}, ${formatDateTime(r.verified_at)}` : 'Not yet'} />}
            </dl>
          </section>
          {writer && (
            <RecordActions
              id={r.id}
              status={r.status}
              needsVerify={r.source === 'legacy' && r.verification_status === 'unverified'}
              own={own}
              session={r.graduation_session}
              senateDate={r.senate_approval_date}
              isAdmin={profile.role === 'admin'}
              sessions={sessionOptions()}
            />
          )}
        </aside>
      </div>
    </>
  )
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value ?? <span className="text-ink-faint">Not stated</span>}</dd>
    </div>
  )
}
