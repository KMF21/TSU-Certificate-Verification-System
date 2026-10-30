import { isValidSession } from './roles'

/** What the single-entry form sends. Everything is a string, as typed. */
export interface RecordInput {
  full_name: string
  reg_number: string
  programme_id: string
  cgpa: string
  class_id: string
  remark: string
  graduation_session: string
  senate_approval_date: string
  source: 'live' | 'legacy'
}

/** The cleaned values, ready for the database. */
export interface RecordValues {
  full_name: string
  reg_number: string
  programme_id: string
  cgpa: number | null
  class_id: string | null
  remark: string | null
  graduation_session: string | null
  senate_approval_date: string | null
  source: 'live' | 'legacy'
}

export type FieldErrors = Partial<Record<keyof RecordInput, string>>

const UUID = /^[0-9a-f-]{36}$/i

/** Same rule as private.normalise_reg: backslashes to slashes, no spaces, upper case. */
export const normaliseReg = (s: string) => s.replace(/\\/g, '/').replace(/\s/g, '').toUpperCase()
export const tidyName = (s: string) => s.trim().replace(/\s+/g, ' ')

export function validateRecord(input: RecordInput, today: string): { values?: RecordValues; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const full_name = tidyName(input.full_name ?? '')
  if (full_name.length < 3) errors.full_name = 'Enter the graduate’s full name, surname first.'
  else if (full_name.length > 200) errors.full_name = 'That name is too long.'

  const reg_number = normaliseReg(input.reg_number ?? '')
  if (!reg_number) errors.reg_number = 'Enter the registration number.'
  else if (!/^[A-Z0-9][A-Z0-9/.-]{2,39}$/.test(reg_number)) errors.reg_number = 'Use letters, numbers, / . or - only (3 to 40 characters).'

  if (!UUID.test(input.programme_id ?? '')) errors.programme_id = 'Choose the programme.'

  let cgpa: number | null = null
  const rawCgpa = (input.cgpa ?? '').trim()
  if (rawCgpa) {
    if (!/^\d(\.\d{1,2})?$/.test(rawCgpa)) errors.cgpa = 'Enter the CGPA as a number like 4.25 (up to two decimal places).'
    else {
      cgpa = Number(rawCgpa)
      if (cgpa < 0 || cgpa > 5) errors.cgpa = 'CGPA must be between 0.00 and 5.00.'
    }
  }

  const class_id = input.class_id ? (UUID.test(input.class_id) ? input.class_id : (errors.class_id = 'Choose a class from the list.', null)) : null

  const remark = (input.remark ?? '').trim() || null
  if (remark && remark.length > 500) errors.remark = 'Keep the remark under 500 characters.'

  const graduation_session = (input.graduation_session ?? '').trim() || null
  if (graduation_session && !isValidSession(graduation_session)) errors.graduation_session = 'Write it as two consecutive years, like 2024/2025.'

  const senate_approval_date = (input.senate_approval_date ?? '').trim() || null
  if (senate_approval_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(senate_approval_date)) errors.senate_approval_date = 'Enter a valid date.'
    else if (senate_approval_date > today) errors.senate_approval_date = 'The Senate approval date can’t be in the future.'
    else if (senate_approval_date < '2008-01-01') errors.senate_approval_date = 'The date is before the University’s first graduations.'
  }

  const source = input.source === 'legacy' ? 'legacy' : 'live'
  if (Object.keys(errors).length) return { errors }
  return { values: { full_name, reg_number, programme_id: input.programme_id, cgpa, class_id, remark, graduation_session, senate_approval_date, source }, errors }
}

export const lagosToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
