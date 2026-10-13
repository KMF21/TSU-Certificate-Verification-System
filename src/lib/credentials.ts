import 'server-only'
import { SAMPLE_CREDENTIALS } from './sample-data'
import { fullNameOf } from './signing-core'
import { isProduction } from './signing'
import { isSupabaseConfigured } from './supabase/env'
import { registerByCode, registerBySerialAndMatric, registerFullBySerial } from './register'
import type { Credential, PublicCredential } from './types'

/**
 * Lookups for the public pages.
 *
 * With Supabase configured, the live register answers through two restricted database
 * functions. Previews (TSU_ENV not "production") also fall back to the sample records,
 * so the /demo test bench keeps working next to real data.
 */

const VERIFY_CODE_PATTERN = /^[a-z2-9]{16}$/
const useSamples = !isProduction

/** On previews, a register outage falls back to samples; in production it surfaces as an error page. */
async function live<T>(lookup: () => Promise<T | null>): Promise<T | null> {
  if (!isSupabaseConfigured) return null
  try {
    return await lookup()
  } catch (error) {
    if (isProduction) throw error
    console.error(error)
    return null
  }
}

export const normaliseSerial = (input: string) => input.trim().toUpperCase().replace(/\s+/g, '').replace(/\\/g, '/')
export const normaliseMatric = normaliseSerial

/** Keeps the first two segments (three for PG) and the last two characters: TSU/19/•••/••45. */
export function maskMatric(matric: string): string {
  const parts = matric.split('/')
  const keep = parts[1] === 'PG' ? 3 : 2
  if (parts.length <= keep) return matric.slice(0, -2).replace(/[^/]/g, '•') + matric.slice(-2)
  const rest = parts.slice(keep).join('/')
  return `${parts.slice(0, keep).join('/')}/${rest.slice(0, -2).replace(/[^/]/g, '•')}${rest.slice(-2)}`
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

export async function findPublicByCode(code: string): Promise<PublicCredential | null> {
  if (!VERIFY_CODE_PATTERN.test(code)) return null
  const found = await live(() => registerByCode(code))
  if (found) return found
  if (!useSamples) return null
  const sample = SAMPLE_CREDENTIALS.find((c) => c.verifyCode === code)
  return sample ? toPublic(sample) : null
}

export async function findPublicBySerialAndMatric(serial: string, matric: string): Promise<PublicCredential | null> {
  const found = await live(() => registerBySerialAndMatric(serial, matric))
  if (found) return found
  if (!useSamples) return null
  const s = normaliseSerial(serial)
  const m = normaliseMatric(matric)
  const sample = SAMPLE_CREDENTIALS.find((c) => c.serialNo === s && c.matricNo === m)
  return sample ? toPublic(sample) : null
}

/** Full record behind a serial number, for checking a QR token's signed details. Server only. */
export async function findFullBySerial(serial: string): Promise<Credential | null> {
  const s = normaliseSerial(serial)
  const found = await live(() => registerFullBySerial(s))
  if (found) return found
  if (!useSamples) return null
  return SAMPLE_CREDENTIALS.find((c) => c.serialNo === s) ?? null
}

export async function listSampleCredentials(): Promise<Credential[]> {
  return SAMPLE_CREDENTIALS
}
