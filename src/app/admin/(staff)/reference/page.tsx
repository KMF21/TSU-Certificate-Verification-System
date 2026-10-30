import { requireStaff } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { Notice, PageHeader } from '@/components/admin/ui'
import { ClassesEditor, ProgrammeList } from '@/components/admin/reference-panels'

export const metadata = { title: 'Programmes & classes' }

export default async function ReferencePage() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const reference = await loadReference(supabase)
  const admin = profile.role === 'admin'
  const sample = reference.programmes.filter((p) => p.is_sample).length

  return (
    <>
      <PageHeader title="Programmes & classes" intro="The lists that the entry form, bulk upload and filters choose from." />
      {sample > 0 && (
        <div className="mb-6">
          <Notice tone="warn">
            {sample} of {reference.programmes.length} programmes come from the CPGS 2025/2026 list and are marked as a sample until CPGS confirms the final list.
          </Notice>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <ProgrammeList reference={reference} admin={admin} />
        <ClassesEditor classes={reference.classes} admin={admin} />
      </div>
    </>
  )
}
