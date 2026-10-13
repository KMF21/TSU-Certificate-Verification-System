'use server'

import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { canManageReference } from '@/lib/admin/roles'
import { MAX_UPLOAD_BYTES, readTable } from '@/lib/admin/spreadsheet'
import { validateReference } from '@/lib/admin/reference-rows'
import type { ImportState } from '../batches/actions'

export async function importReferenceAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !canManageReference(profile.role)) return { error: 'Only a Super Admin can load programmes.' }
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose the completed programme list to upload.' }
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'That file is over 5 MB.' }

  let table
  try {
    table = await readTable(file)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The file could not be read.', fileName: file.name }
  }
  const { rows, problems } = validateReference(table)
  if (problems.length) {
    return { fileName: file.name, problems, error: `Nothing was saved. Fix the ${problems.length === 1 ? 'problem' : `${problems.length} problems`} below and upload again.` }
  }
  const { data, error } = await supabase.rpc('import_reference_rows', { p_rows: rows })
  if (error) return { fileName: file.name, error: `Nothing was saved. ${friendlyDbError(error)}` }
  revalidatePath('/admin/programmes')
  return { ok: `Loaded ${data} ${data === 1 ? 'programme' : 'programmes'} from ${file.name}.` }
}
