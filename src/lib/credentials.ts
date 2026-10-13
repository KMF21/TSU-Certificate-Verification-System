import 'server-only'
import { SAMPLE_CREDENTIALS } from './sample-data'
import { fullNameOf } from './signing-core'
import type { Credential, PublicCredential } from './types'

/**
 * Data access for the public verification pages.
 *
 * Slice 1 reads the in-memory sample register. When Supabase is wired in,
 * these functions call a single SECURITY DEFINER database function that returns
 * only approved/revoked/superseded credentials and only their public fields.
 */

const VERIFY_CODE_PATTERN = /^[a-z2-9]{16}$/

export function normaliseSerial(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '').replace(/\\/g, '/')
}

export function normaliseMatric(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '').replace(/\\/g, '/')
}

export async function findByVerifyCode(code: string): Promise<Credential | null> {
  if (!VERIFY_CODE_PATTERN.test(code)) return null
  return SAMPLE_CREDENTIALS.find((c) => c.verifyCode === code) ?? null
}

export async function findBySerial(serial: string): Promise<Credential | null> {
  const s = normaliseSerial(serial)
  return SAMPLE_CREDENTIALS.find((c) => c.serialNo === s) ?? null
}

/** Manual check: both the serial and the matric number must match the same record. */
export async function findBySerialAndMatric(serial: string, matric: string): Promise<Credential | null> {
  const record = await findBySerial(serial)
  return record && record.matricNo === normaliseMatric(matric) ? record : null
}

export async function listSampleCredentials(): Promise<Credential[]> {
  return SAMPLE_CREDENTIALS
}

/** Keeps the first two segments and the last two characters: TSU/19/•••/••45. */
export function maskMatric(matric: string): string {
  const parts = matric.split('/')
  const keep = parts.slice(0, parts[1] === 'PG' ? 3 : 2)
  const rest = parts.slice(keep.length).join('/')
  const tail = rest.slice(-2)
  const hidden = rest.slice(0, -2).replace(/[^/]/g, '•')
  return [...keep, `${hidden}${tail}`].join('/')
}

export function toPublic(c: Credential): PublicCredential {
  return {
    verifyCode: c.verifyCode,
    serialNo: c.serialNo,
    fullName: fullNameOf(c),
    matricNoMasked: maskMatric(c.matricNo),
    faculty: c.faculty,
    department: c.department,
    programme: c.programme,
    award: c.award,
    awardLevel: c.awardLevel,
    classOfDegree: c.classOfDegree,
    session: c.session,
    dateOfAward: c.dateOfAward,
    status: c.status,
    revokedAt: c.revokedAt,
    supersededBy: c.supersededBy,
    isSample: c.isSample,
  }
}
