import { requireStaff } from '@/lib/admin/session'
import { canManageReference, LEVEL_LABEL, type AwardLevel } from '@/lib/admin/roles'
import { Badge, Empty, PageHeader } from '@/components/admin/ui'
import { ReferenceImportPanel } from '@/components/admin/reference-import-panel'

export const metadata = { title: 'Programmes' }

interface Faculty {
  id: string
  code: string
  name: string
  departments: {
    id: string
    code: string
    name: string
    programmes: { id: string; code: string; name: string; award_title: string; award_level: AwardLevel; active: boolean }[]
  }[]
}

export default async function ProgrammesPage() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return null
  const { data } = await supabase
    .from('faculties')
    .select('id, code, name, departments(id, code, name, programmes(id, code, name, award_title, award_level, active))')
    .order('name')
    .returns<Faculty[]>()
  const faculties = data ?? []
  const total = faculties.reduce((n, f) => n + f.departments.reduce((m, d) => m + d.programmes.length, 0), 0)

  return (
    <>
      <PageHeader
        title="Programmes"
        intro={`The awards TSU can issue. Every imported record must use one of these programme codes. ${total} programmes in ${faculties.length} faculties.`}
      />
      {canManageReference(profile.role) && (
        <div className="mb-8">
          <ReferenceImportPanel />
        </div>
      )}

      {faculties.length ? (
        <div className="space-y-6">
          {faculties.map((f) => (
            <section key={f.id} className="card overflow-hidden">
              <header className="flex items-baseline justify-between gap-4 border-b border-line bg-canvas/60 px-5 py-3">
                <h2 className="font-display text-base font-semibold">{f.name}</h2>
                <span className="font-display text-xs tracking-wide text-ink-faint">{f.code}</span>
              </header>
              {f.departments.length ? (
                <div className="divide-y divide-line">
                  {f.departments
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((d) => (
                      <div key={d.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,240px)_1fr]">
                        <p className="text-sm font-medium text-navy">{d.name}</p>
                        <ul className="space-y-1.5">
                          {d.programmes
                            .slice()
                            .sort((a, b) => a.award_level.localeCompare(b.award_level) || a.award_title.localeCompare(b.award_title))
                            .map((p) => (
                              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                <span className="w-24 shrink-0 font-display text-xs tracking-wide text-ink-muted">{p.code}</span>
                                <span>{p.award_title} {p.name}</span>
                                <Badge tone={p.award_level === 'postgraduate' ? 'info' : 'neutral'}>{LEVEL_LABEL[p.award_level]}</Badge>
                                {!p.active && <Badge tone="warn">Inactive</Badge>}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="px-5 py-4 text-sm text-ink-muted">No departments yet.</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Empty title="No programmes yet">
          {canManageReference(profile.role)
            ? 'Download the programme list template, fill in every faculty, department and programme, and upload it.'
            : 'A Super Admin needs to load the programme list before records can be imported.'}
        </Empty>
      )}
    </>
  )
}
