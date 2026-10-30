import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegisterFilters } from '../register-query'
import { LEVEL_LABEL, SOURCE_LABEL, STATUS_LABEL, VERIFICATION_LABEL } from '../roles'

const day = (iso: string) => iso.split('-').reverse().join('/')

/** Plain-language description of the filters, e.g. "Faculty of Science · Session 2023/2024 · Approved". */
export async function describeFilterParts(supabase: SupabaseClient, f: RegisterFilters): Promise<string[]> {
  const parts: string[] = []
  const name = async (table: string, id: string | undefined, cols = 'name') => {
    if (!id) return null
    const { data } = await supabase.from(table).select(cols).eq('id', id).maybeSingle()
    return data as Record<string, string> | null
  }
  const [fac, dep, prog] = await Promise.all([
    name('faculties', f.faculty),
    name('departments', f.department),
    name('programmes', f.programme, 'award_title, name'),
  ])
  if (fac) parts.push(fac.name)
  if (dep) parts.push(dep.name)
  if (prog) parts.push(`${prog.award_title} ${prog.name}`)
  if (f.level) parts.push(LEVEL_LABEL[f.level])
  if (f.sessions?.length) parts.push(`Session ${f.sessions.join(', ')}`)
  if (f.from && f.to) parts.push(`Senate approval ${day(f.from)} to ${day(f.to)}`)
  else if (f.from) parts.push(`Senate approval from ${day(f.from)}`)
  else if (f.to) parts.push(`Senate approval up to ${day(f.to)}`)
  if (f.status) parts.push(STATUS_LABEL[f.status])
  if (f.source) parts.push(`${SOURCE_LABEL[f.source]} records`)
  if (f.verification) parts.push(VERIFICATION_LABEL[f.verification])
  if (f.q) parts.push(`Matching “${f.q}”`)
  if (f.batch) parts.push('One upload')
  return parts
}
