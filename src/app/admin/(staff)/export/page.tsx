import { requireStaff } from '@/lib/admin/session'
import { Empty, PageHeader } from '@/components/admin/ui'

export const metadata = { title: 'Export' }

export default async function Page() {
  await requireStaff()
  return (
    <>
      <PageHeader title="Export" />
      <Empty title="Coming in stage 4">Choose filters and columns, preview the count, and download Excel (Times New Roman, grouped by faculty, department and programme) or PDF.</Empty>
    </>
  )
}
