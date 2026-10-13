import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/admin/session'
import { editableLevel, LEVEL_LABEL } from '@/lib/admin/roles'
import { PageHeader } from '@/components/admin/ui'
import { NewBatchForm } from '@/components/admin/new-batch-form'

export const metadata = { title: 'Start a batch' }

export default async function NewBatchPage() {
  const { profile } = await requireStaff()
  const level = profile ? editableLevel(profile.role) : null
  if (!level) redirect('/admin/batches')

  const year = new Date().getFullYear()
  return (
    <>
      <PageHeader
        title="Start a batch"
        intro={`A ${LEVEL_LABEL[level].toLowerCase()} batch for one graduating list. You'll import the records on the next screen.`}
      />
      <div className="card max-w-xl p-6 sm:p-8">
        <NewBatchForm defaultSession={`${year - 1}/${year}`} />
      </div>
    </>
  )
}
