import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase/env'
import { createServiceClient, hasServiceRole } from './supabase/service'
import type { AwardLevel, Credential, CredentialStatus, PublicCredential } from './types'

/** Row shape returned by public.verify_by_code and public.verify_by_serial_and_matric. */
interface PublicRow {
  verify_code: string
  serial_no: string
  full_name: string
  matric_masked: string
  faculty: string
  department: string
  programme: string
  award_title: string
  award_level: AwardLevel
  class_of_degree: string | null
  session: string
  date_of_award: string
  status: CredentialStatus
  revoked_at: string | null
  superseded_by_code: string | null
}

let anonClient: SupabaseClient | null = null
function anon() {
  anonClient ??= createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return anonClient
}

function toPublic(r: PublicRow): PublicCredential {
  return {
    verifyCode: r.verify_code,
    serialNo: r.serial_no,
    fullName: r.full_name,
    matricNoMasked: r.matric_masked,
    faculty: r.faculty,
    department: r.department,
    programme: r.programme,
    award: r.award_title,
    awardLevel: r.award_level,
    classOfDegree: r.class_of_degree,
    session: r.session,
    dateOfAward: r.date_of_award,
    status: r.status,
    revokedAt: r.revoked_at?.slice(0, 10),
    supersededBy: r.superseded_by_code ?? undefined,
  }
}

export async function registerByCode(code: string): Promise<PublicCredential | null> {
  const { data, error } = await anon().rpc('verify_by_code', { p_code: code })
  if (error) throw new Error(`Register lookup failed: ${error.message}`)
  const row = (data as PublicRow[] | null)?.[0]
  return row ? toPublic(row) : null
}

export async function registerBySerialAndMatric(serial: string, matric: string): Promise<PublicCredential | null> {
  const { data, error } = await anon().rpc('verify_by_serial_and_matric', { p_serial: serial, p_matric: matric })
  if (error) throw new Error(`Register lookup failed: ${error.message}`)
  const row = (data as PublicRow[] | null)?.[0]
  return row ? toPublic(row) : null
}

/** Full record, including the unmasked matric number, for comparing a QR token's signed details. */
const FULL_SELECT =
  'id, verify_code, serial_no, status, class_of_degree, date_of_award, revoked_at, key_id, superseded_by, ' +
  'graduates(surname, other_names, matric_no), ' +
  'programmes(name, award_title, award_level, departments(name, faculties(name))), ' +
  'batches(session), successor:superseded_by(verify_code)'

interface FullRow {
  id: string
  verify_code: string | null
  serial_no: string | null
  status: CredentialStatus | 'draft' | 'pending'
  class_of_degree: string | null
  date_of_award: string
  revoked_at: string | null
  key_id: string | null
  graduates: { surname: string; other_names: string; matric_no: string }
  programmes: { name: string; award_title: string; award_level: AwardLevel; departments: { name: string; faculties: { name: string } } }
  batches: { session: string }
  successor: { verify_code: string | null } | null
}

function toCredential(r: FullRow): Credential | null {
  if (!r.verify_code || !r.serial_no || r.status === 'draft' || r.status === 'pending') return null
  return {
    id: r.id,
    verifyCode: r.verify_code,
    serialNo: r.serial_no,
    surname: r.graduates.surname,
    otherNames: r.graduates.other_names,
    matricNo: r.graduates.matric_no,
    faculty: r.programmes.departments.faculties.name,
    department: r.programmes.departments.name,
    programme: r.programmes.name,
    award: r.programmes.award_title,
    awardLevel: r.programmes.award_level,
    classOfDegree: r.class_of_degree,
    session: r.batches.session,
    dateOfAward: r.date_of_award,
    status: r.status,
    revokedAt: r.revoked_at?.slice(0, 10),
    supersededBy: r.successor?.verify_code ?? undefined,
    keyId: r.key_id ?? '',
  }
}

export async function registerFullBySerial(serial: string): Promise<Credential | null> {
  if (!hasServiceRole()) return null
  const { data, error } = await createServiceClient()
    .from('credentials')
    .select(FULL_SELECT)
    .eq('serial_no', serial)
    .maybeSingle<FullRow>()
  if (error) throw new Error(`Register lookup failed: ${error.message}`)
  return data ? toCredential(data) : null
}

/** An issued credential, read as the signed-in staff member (row-level security applies). */
export async function registerFullForStaff(supabase: SupabaseClient, id: string): Promise<Credential | null> {
  const { data } = await supabase.from('credentials').select(FULL_SELECT).eq('id', id).maybeSingle<FullRow>()
  return data ? toCredential(data) : null
}
