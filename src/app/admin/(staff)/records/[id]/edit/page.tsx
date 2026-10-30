import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { sessionOptions } from '@/lib/admin/roles'
import { PageHeader } from '@/components/admin/ui'
import { RecordForm } from '@/components/admin/record-form'

export const metadata = { title: 'Edit record' }

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { supabase } = await requireRole(['admin', 'records_officer'])
  const [{ data: r }, reference] = await Promise.all([
    supabase
      .from('graduates')
      .select('id, full_name, reg_number, programme_id, cgpa, class_id, remark, graduation_session, senate_approval_date, source, status')
      .eq('id', id)
      .maybeSingle(),
    loadReference(supabase),
  ])
  if (!r) notFound()
  return (
    <>
      <Link href={`/admin/records/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the record
      </Link>
      <PageHeader title={r.status === 'approved' ? 'Correct an approved record' : 'Edit record'} intro={`${r.full_name} · ${r.reg_number}`} />
      <RecordForm
        reference={reference}
        sessions={sessionOptions()}
        recordId={id}
        approved={r.status === 'approved'}
        initial={{
          full_name: r.full_name,
          reg_number: r.reg_number,
          programme_id: r.programme_id,
          cgpa: r.cgpa == null ? '' : Number(r.cgpa).toFixed(2),
          class_id: r.class_id ?? '',
          remark: r.remark ?? '',
          graduation_session: r.graduation_session ?? '',
          senate_approval_date: r.senate_approval_date ?? '',
          source: r.source,
        }}
      />
    </>
  )
}
