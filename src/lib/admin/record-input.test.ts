import { describe, expect, it } from 'vitest'
import { normaliseReg, validateRecord, type RecordInput } from './record-input'

const base: RecordInput = {
  full_name: '  BAKO   Ruth Adi ',
  reg_number: 'tsu/pg/22/cs 0001',
  programme_id: '7b0f9c4e-2a1d-4e3b-9c55-0a1b2c3d4e5f',
  cgpa: '4.5',
  class_id: '',
  remark: ' ',
  graduation_session: '2023/2024',
  senate_approval_date: '2024-06-12',
  source: 'live',
}

describe('single record validation', () => {
  it('cleans a good record', () => {
    const { values, errors } = validateRecord(base, '2026-10-30')
    expect(errors).toEqual({})
    expect(values).toMatchObject({ full_name: 'BAKO Ruth Adi', reg_number: 'TSU/PG/22/CS0001', cgpa: 4.5, class_id: null, remark: null })
  })

  it('rejects CGPA outside 0–5 or with too many decimals', () => {
    expect(validateRecord({ ...base, cgpa: '5.01' }, '2026-10-30').errors.cgpa).toMatch(/between/)
    expect(validateRecord({ ...base, cgpa: '4.555' }, '2026-10-30').errors.cgpa).toMatch(/two decimal/)
    expect(validateRecord({ ...base, cgpa: '' }, '2026-10-30').errors.cgpa).toBeUndefined()
  })

  it('rejects bad sessions, future dates and missing programme', () => {
    const { errors } = validateRecord({ ...base, graduation_session: '2023/2025', senate_approval_date: '2027-01-01', programme_id: '' }, '2026-10-30')
    expect(Object.keys(errors).sort()).toEqual(['graduation_session', 'programme_id', 'senate_approval_date'])
  })

  it('normalises registration numbers like the database does', () => {
    expect(normaliseReg(' tsu\\pg/22 cs/1 ')).toBe('TSU/PG/22CS/1')
  })
})
