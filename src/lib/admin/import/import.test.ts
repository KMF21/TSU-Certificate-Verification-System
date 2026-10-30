import { describe, expect, it } from 'vitest'
import { guessMapping, headingScore } from './fields'
import { buildRows, choiceKey, findHeadingRow, type BuildInput } from './build'
import { findClass, programmeIndex, type ClassRef, type ProgrammeRef } from './match'
import { parseCsv, readCgpa, readDate, readSession, toCell } from './values'

const P: ProgrammeRef[] = [
  { id: 'p1', code: 'MSC-CS', name: 'Computer Science', award_title: 'Master of Science (M.Sc.)', level: 'masters' },
  { id: 'p2', code: 'PHD-CS', name: 'Computer Science', award_title: 'Doctor of Philosophy (Ph.D.)', level: 'phd' },
  { id: 'p3', code: 'MED-GC', name: 'Guidance and Counselling', award_title: 'Master of Education (M.Ed.)', level: 'masters' },
  { id: 'p4', code: 'PGD-ED', name: 'Education', award_title: 'Postgraduate Diploma (PGD)', level: 'pgd' },
  { id: 'p5', code: 'MA-HIS', name: 'History and International Studies', award_title: 'Master of Arts (M.A.)', level: 'masters' },
]
const C: ClassRef[] = [
  { id: 'c1', label: 'Distinction', level: null },
  { id: 'c2', label: 'Merit', level: null },
  { id: 'c3', label: 'Credit', level: null },
  { id: 'c4', label: 'Pass', level: null },
]

describe('reading values', () => {
  it('reads CSV with quotes, semicolons and CRLF', () => {
    expect(parseCsv('a;b\r\n"x; y";"say ""hi"""\r\n')).toEqual([['a', 'b'], ['x; y', 'say "hi"']])
  })
  it('reads Excel cell shapes', () => {
    expect(toCell({ richText: [{ text: 'BAKO ' }, { text: 'Ruth' }] })).toBe('BAKO Ruth')
    expect(toCell({ formula: 'A1', result: 4.5 })).toBe(4.5)
    expect(toCell('  ')).toBeNull()
  })
  it('reads CGPAs, sessions and dates', () => {
    expect(readCgpa('4,50/5.00').value).toBe(4.5)
    expect(readCgpa('').value).toBeNull()
    expect(readCgpa(5.2).error).toMatch(/outside/)
    expect(readSession('2023/24').value).toBe('2023/2024')
    expect(readSession('2023-2024').value).toBe('2023/2024')
    expect(readSession('2024').error).toBeTruthy()
    expect(readSession('2023/2025').error).toMatch(/consecutive/)
    const today = '2026-10-30'
    expect(readDate('12/06/2024', today).value).toBe('2024-06-12')
    expect(readDate('12-Jun-2024', today).value).toBe('2024-06-12')
    expect(readDate('June 12th, 2024', today).value).toBe('2024-06-12')
    expect(readDate(45455, today).value).toBe('2024-06-12')
    expect(readDate(new Date('2024-06-12T00:00:00Z'), today).value).toBe('2024-06-12')
    expect(readDate('31/02/2024', today).error).toBeTruthy()
    expect(readDate('2027-01-01', today).error).toMatch(/future/)
  })
})

describe('headings', () => {
  it('maps common headings and finds the heading row under a title', () => {
    expect(guessMapping(['S/N', 'Name of Student', 'Matric No.', 'Course of Study', 'CGPA', 'Class of Degree', 'Session'])).toEqual([
      null, 'full_name', 'reg_number', 'programme', 'cgpa', 'class', 'graduation_session',
    ])
    const rows = [['TARABA STATE UNIVERSITY'], ['LIST OF GRADUATES 2024'], [], ['S/N', 'Surname', 'Other Names', 'Reg No'], ['1', 'BAKO', 'Ruth', 'X/1']]
    expect(findHeadingRow(rows, headingScore)).toBe(3)
  })
})

describe('matching', () => {
  const idx = programmeIndex(P)
  it('matches clear programme names with the award', () => {
    expect(idx.find('Msc Computer Sciences').match?.id).toBe('p1')
    expect(idx.find('COMPUTER SCIENCE (PH.D)').match?.id).toBe('p2')
    expect(idx.find('Computer Science', 'M.Sc').match?.id).toBe('p1')
    expect(idx.find('M.Ed Guidance & Counselling').match?.id).toBe('p3')
    expect(idx.find('PGD-ED').match?.id).toBe('p4')
    expect(idx.find('M. Ed. Guidance and Counseling').match?.id).toBe('p3')
  })
  it('asks when the award is missing or the wording is loose', () => {
    const r = idx.find('Computer Science')
    expect(r.match).toBeNull()
    expect(r.suggestions.map((s) => s.item.id).sort()).toEqual(['p1', 'p2'])
    const h = idx.find('MA History')
    expect(h.match).toBeNull()
    expect(h.suggestions[0].item.id).toBe('p5')
  })
  it('matches classes', () => {
    expect(findClass('DIST.', C).match?.id).toBe('c1')
    expect(findClass('merit', C).match?.id).toBe('c2')
    expect(findClass('Second Class Upper', C).match).toBeNull()
  })
})

describe('building rows', () => {
  const base: BuildInput = {
    rows: [
      ['Name', 'Reg No', 'Programme', 'CGPA', 'Class', 'Session', 'Senate date'],
      ['BAKO Ruth', 'tsu/pg/1', 'M.Sc Computer Science', '4.5', 'Distinction', '2023/24', '12/06/2024'],
      ['AUDU John', 'TSU/PG/2', 'Computer Science', '', 'Upper credit', '2023/2024', ''],
      [null, null, null, null, null, null, null],
      ['DANJUMA Ali', 'TSU/PG/3', 'M.Ed Guidance and Counselling', '6', 'Pass', '2023/2024', ''],
      ['EZRA Musa', 'TSU/PG/4', 'M.Sc Computer Science', '', '', '2023/2024', ''],
      ['EZRA Musa', 'tsu/pg/4', 'M.Sc Computer Science', '', '', '2023/2024', ''],
      ['FATI Grace', 'TSU/PG/5', 'M.Sc Computer Science', '', '', '', ''],
      ['GANI Paul', 'TSU/PG/6', 'M.Sc Computer Science', '', '', '', ''],
      ['Signed: Secretary, CPGS', null, null, null, null, null, null],
    ],
    headingRow: 0,
    mapping: ['full_name', 'reg_number', 'programme', 'cgpa', 'class', 'graduation_session', 'senate_approval_date'],
    shared: {},
    programmes: P,
    classes: C,
    programmeChoices: {},
    classChoices: {},
    existing: {
      'TSU/PG/5': { id: 'g5', full_name: 'FATI Grace', status: 'pending' },
      'TSU/PG/6': { id: 'g6', full_name: 'GANI Paul', status: 'approved' },
    },
    duplicates: 'skip',
    today: '2026-10-30',
  }

  it('sorts rows into create, skip and reject with reasons', () => {
    const r = buildRows(base)
    expect(r.blank).toBe(2)
    expect(r.rows.map((x) => [x.row, x.action])).toEqual([
      [2, 'create'], [3, 'reject'], [5, 'reject'], [6, 'reject'], [7, 'reject'], [8, 'skip'], [9, 'skip'],
    ])
    expect(r.rows[0]).toMatchObject({ reg_number: 'TSU/PG/1', programme_id: 'p1', cgpa: 4.5, class_id: 'c1', graduation_session: '2023/2024', senate_approval_date: '2024-06-12' })
    expect(r.rows[1].problems.join(' ')).toMatch(/needs matching/)
    expect(r.rows[2].problems.join(' ')).toMatch(/outside/)
    expect(r.rows[3].problems.join(' ')).toMatch(/more than once in the file \(rows 6, 7\)/)
    expect(r.unresolvedProgrammes.map((u) => u.text)).toEqual(['Computer Science'])
    expect(r.unresolvedClasses.map((u) => u.text)).toEqual(['Upper credit'])
    expect(r.counts).toEqual({ create: 1, update: 0, skip: 2, reject: 4 })
  })

  it('applies staff choices, shared values and the update policy', () => {
    const r = buildRows({
      ...base,
      programmeChoices: { [choiceKey('Computer Science')]: 'p1' },
      classChoices: { [choiceKey('Upper credit')]: '' },
      shared: { senate_approval_date: '2024-06-12' },
      duplicates: 'update',
    })
    expect(r.rows[1]).toMatchObject({ action: 'create', programme_id: 'p1', class_id: null, senate_approval_date: '2024-06-12' })
    expect(r.rows.find((x) => x.reg_number === 'TSU/PG/5')?.action).toBe('update')
    expect(r.rows.find((x) => x.reg_number === 'TSU/PG/6')?.action).toBe('skip')
    // Chosen values stay listed so staff can review them.
    expect(r.unresolvedProgrammes.map((u) => u.text)).toEqual(['Computer Science'])
    expect(r.unresolvedClasses.map((u) => u.text)).toEqual(['Upper credit'])
  })
})
