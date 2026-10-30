import { requireRole } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { sessionOptions } from '@/lib/admin/roles'
import { PageHeader } from '@/components/admin/ui'
import { RecordForm } from '@/components/admin/record-form'

export const metadata = { title: 'Add a record' }

export default async function NewRecordPage() {
  const { supabase } = await requireRole(['admin', 'records_officer'])
  const reference = await loadReference(supabase)
  return (
    <>
      <PageHeader title="Add a record" intro="Enter one graduate at a time. For a whole list, use Bulk upload instead." />
      <RecordForm reference={reference} sessions={sessionOptions()} />
    </>
  )
}
