'use server'

import { revalidatePath } from 'next/cache'
import { friendlyDbError, requireStaff } from '@/lib/admin/session'
import { parseOptions } from '@/lib/admin/export/options'
import { filtersToParams, parseFilters } from '@/lib/admin/register-query'

export async function savePresetAction(input: { name: string; query: string; shared: boolean }): Promise<{ ok?: string; error?: string }> {
  const { supabase, profile } = await requireStaff()
  if (!profile) return { error: 'No staff access.' }
  const name = (input.name ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) return { error: 'Give the preset a name of 2 to 80 characters.' }
  // Store only what we understand, cleaned.
  const sp = Object.fromEntries(new URLSearchParams(input.query ?? '').entries())
  const multi = new URLSearchParams(input.query ?? '').getAll('session')
  const filters = parseFilters({ ...sp, session: multi })
  const options = parseOptions(sp)
  const { error } = await supabase.from('export_presets').upsert(
    {
      owner_id: profile.user_id,
      name,
      filters: { params: filtersToParams(filters).toString(), format: options.format, grouped: options.grouped, title: options.title },
      columns: options.columns,
      shared: !!input.shared,
    },
    { onConflict: 'owner_id,name' },
  )
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin/export')
  return { ok: `Saved “${name}”.` }
}

export async function deletePresetAction(id: string): Promise<{ ok?: string; error?: string }> {
  const { supabase, profile } = await requireStaff()
  if (!profile) return { error: 'No staff access.' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Preset not found.' }
  const { error } = await supabase.from('export_presets').delete().eq('id', id).eq('owner_id', profile.user_id)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath('/admin/export')
  return { ok: 'Preset deleted.' }
}
