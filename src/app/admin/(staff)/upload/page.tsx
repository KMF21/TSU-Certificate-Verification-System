import { requireStaff } from '@/lib/admin/session'
import { Empty, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Bulk upload' }

export default async function Page() {
  await requireStaff()
  return (
    <>
      <PageHeader title="Bulk upload" />
      <Empty title="Coming in stage 3">Upload an Excel or CSV list of graduates, map its columns, preview every row with its problems, then commit the whole file in one go.</Empty>
    </>
  )
}
