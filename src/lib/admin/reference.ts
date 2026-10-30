import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProgrammeLevel } from './roles'

export interface Faculty { id: string; name: string; code: string; active: boolean }
export interface Department { id: string; faculty_id: string; name: string; code: string; active: boolean }
export interface Programme {
  id: string
  department_id: string
  code: string
  name: string
  award_title: string
  level: ProgrammeLevel
  is_sample: boolean
  active: boolean
}
export interface DegreeClass { id: string; label: string; level: ProgrammeLevel | null; sort_order: number; active: boolean }

export interface Reference {
  faculties: Faculty[]
  departments: Department[]
  programmes: Programme[]
  classes: DegreeClass[]
}

/** Faculties, departments, programmes and classes for pickers and filters. */
export async function loadReference(supabase: SupabaseClient): Promise<Reference> {
  const [f, d, p, c] = await Promise.all([
    supabase.from('faculties').select('id, name, code, active').order('name'),
    supabase.from('departments').select('id, faculty_id, name, code, active').order('name'),
    supabase.from('programmes').select('id, department_id, code, name, award_title, level, is_sample, active').order('name').limit(5000),
    supabase.from('degree_classes').select('id, label, level, sort_order, active').order('sort_order'),
  ])
  const err = f.error ?? d.error ?? p.error ?? c.error
  if (err) throw new Error(`Reference data could not be loaded: ${err.message}`)
  return {
    faculties: (f.data ?? []) as Faculty[],
    departments: (d.data ?? []) as Department[],
    programmes: (p.data ?? []) as Programme[],
    classes: (c.data ?? []) as DegreeClass[],
  }
}
