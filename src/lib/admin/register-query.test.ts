import { describe, expect, it } from 'vitest'
import { activeFilterCount, applyFilters, filtersToParams, parseFilters, searchPattern } from './register-query'

const id = '7b0f9c4e-2a1d-4e3b-9c55-0a1b2c3d4e5f'

describe('register filters', () => {
  it('reads valid filters and drops malformed ones', () => {
    const f = parseFilters({
      q: '  bako ',
      faculty: id,
      department: 'not-a-uuid',
      level: 'phd',
      session: ['2023/2024', 'bad', '2022/2023'],
      from: '2024-01-01',
      to: '01/02/2024',
      status: 'approved',
      source: 'other',
    })
    expect(f).toMatchObject({ q: 'bako', faculty: id, level: 'phd', sessions: ['2023/2024', '2022/2023'], from: '2024-01-01', status: 'approved' })
    expect(f.department).toBeUndefined()
    expect(f.to).toBeUndefined()
    expect(f.source).toBeUndefined()
    expect(activeFilterCount(f)).toBe(5)
  })

  it('round-trips through URL params', () => {
    const f = parseFilters({ session: '2023/2024,2024/2025', status: 'pending', verification: 'unverified' })
    expect(parseFilters(Object.fromEntries([...filtersToParams(f).entries()].reduce((m, [k, v]) => {
      m.set(k, [...(m.get(k) ?? []), v])
      return m
    }, new Map<string, string[]>())))).toEqual(f)
  })

  it('escapes search terms so they cannot inject filters', () => {
    expect(searchPattern('50%_off')).toBe('%50\\%\\_off%')
    expect(searchPattern('a,status.eq.approved)')).toBe('%a status.eq.approved%')
  })

  it('applies only the filters that are set', () => {
    const calls: string[] = []
    const q = {
      eq: (c: string, v: unknown) => (calls.push(`eq ${c}=${v}`), q),
      in: (c: string, v: unknown[]) => (calls.push(`in ${c}=${v.join('|')}`), q),
      gte: (c: string, v: unknown) => (calls.push(`gte ${c}=${v}`), q),
      lte: (c: string, v: unknown) => (calls.push(`lte ${c}=${v}`), q),
      or: (s: string) => (calls.push(`or ${s}`), q),
    }
    applyFilters(q, { q: 'TSU/PG', sessions: ['2023/2024'], from: '2024-01-01', source: 'legacy' })
    expect(calls).toEqual([
      'or full_name.ilike.%TSU/PG%,reg_number.ilike.%TSU/PG%',
      'in graduation_session=2023/2024',
      'gte senate_approval_date=2024-01-01',
      'eq source=legacy',
    ])
  })
})
