import { describe, expect, it } from 'vitest'
import { parseCsv, parseDate, validateSheet } from './import-rows'

const codes = new Set(['BSC-CSC', 'BSC-ECO'])
const header = ['Surname', 'Other names', 'Matric number', 'Programme code', 'Class of degree', 'Date of award']

describe('parseDate', () => {
  it('reads ISO, Nigerian day-first and Excel serial dates', () => {
    expect(parseDate('2025-11-20')).toBe('2025-11-20')
    expect(parseDate('20/11/2025')).toBe('2025-11-20')
    expect(parseDate(45981)).toBe('2025-11-20')
    expect(parseDate(new Date(Date.UTC(2025, 10, 20)))).toBe('2025-11-20')
  })
  it('rejects impossible dates', () => {
    expect(parseDate('31/02/2025')).toBeNull()
    expect(parseDate('next week')).toBeNull()
  })
})

describe('validateSheet', () => {
  it('accepts a clean sheet and normalises values', () => {
    const { rows, problems } = validateSheet(
      [header, ['Ibrahim', 'Aisha  Ladi', ' tsu/19/csc/1045 ', 'bsc-csc', '2:1', '20/11/2025']],
      { level: 'undergraduate', programmeCodes: codes, today: '2026-10-13' },
    )
    expect(problems).toEqual([])
    expect(rows[0]).toMatchObject({
      other_names: 'Aisha Ladi',
      matric_no: 'TSU/19/CSC/1045',
      programme_code: 'BSC-CSC',
      class_of_degree: 'Second Class Honours (Upper Division)',
      date_of_award: '2025-11-20',
    })
  })

  it('reports every problem with spreadsheet row numbers', () => {
    const { problems } = validateSheet(
      [
        header,
        ['', 'Aisha', 'TSU/19/CSC/1045', 'BSC-CSC', 'First Class Honours', '2025-11-20'],
        ['Okoro', 'Chidi', 'TSU/19/CSC/1046', 'NOPE', 'Excellent', '2030-01-01'],
        [],
        ['Musa', 'Daniel', 'TSU/19/CSC/1045', 'BSC-CSC', '', '2025-11-20'],
        ['Bello', 'Sani', 'TSU/19/CSC/1047', 'BSC-CSC', 'Pass', '2025-11-20'],
        ['Bello', 'Sani', 'TSU/19/CSC/1047', 'BSC-CSC', 'Pass', '2025-11-20'],
      ],
      { level: 'undergraduate', programmeCodes: codes, today: '2026-10-13' },
    )
    expect(problems).toEqual([
      { row: 2, message: 'Surname is empty.' },
      { row: 3, message: 'Programme code "NOPE" is not in the undergraduate programme list.' },
      { row: 3, message: '"Excellent" is not a recognised class of degree.' },
      { row: 3, message: "Date of award 2030-01-01 is outside TSU's history or in the future." },
      { row: 5, message: 'Class of degree is required for undergraduate awards.' },
      { row: 5, message: 'Same matric number and programme as row 2.' },
      { row: 7, message: 'Same matric number and programme as row 6.' },
    ])
  })

  it('lets postgraduate awards leave the grade empty', () => {
    const { problems, rows } = validateSheet(
      [header, ['Bako', 'Emmanuel', 'TSU/PG/21/GEO/0112', 'BSC-CSC', '', '2024-12-12']],
      { level: 'postgraduate', programmeCodes: codes, today: '2026-10-13' },
    )
    expect(problems).toEqual([])
    expect(rows[0].class_of_degree).toBeNull()
  })

  it('names missing columns', () => {
    const { problems } = validateSheet([['Surname', 'Matric']], { level: 'undergraduate', programmeCodes: codes })
    expect(problems[0].message).toBe('Missing columns: Other names, Programme code, Date of award. Use the template.')
  })
})

describe('parseCsv', () => {
  it('handles quotes, commas and CRLF', () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ])
  })
})
