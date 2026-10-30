import ExcelJS from 'exceljs'
import { PDFDocument } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWorkbook } from './excel'
import { buildPdf } from './pdf'
import { effectiveColumns, groupRows, parseOptions, type ExportRow } from './options'

const make = (i: number, faculty: string, dept: string, prog: string): ExportRow => ({
  id: `id${i}`,
  full_name: `PERSON${String(i).padStart(3, '0')} Grace “Ada” Ọlá`,
  reg_number: `TSU/PG/22/X/${i}`,
  cgpa: i % 3 ? 4.123 : null,
  remark: null,
  graduation_session: '2023/2024',
  senate_approval_date: '2024-06-12',
  status: 'approved',
  source: 'live',
  verification_status: 'verified',
  is_sample: true,
  certificate_serial: `TSU/PG/2024/${String(i).padStart(6, '0')}`,
  class_of_degree: 'Merit',
  programme_name: prog,
  award_title: 'Master of Science (M.Sc.)',
  level: 'masters',
  department_name: dept,
  faculty_name: faculty,
  created_by: null,
  updated_by: null,
})

const rows = Array.from({ length: 240 }, (_, i) =>
  i % 2 ? make(i, 'Faculty of Science', 'Department of Computer Science', 'Computer Science') : make(i, 'Faculty of Arts', 'Department of History', 'History'),
)
const heading = { title: 'Graduands 2023/2024', filters: 'Session 2023/2024', generatedBy: 'Test Officer', generatedAt: '30 Oct 2026' }

describe('export', () => {
  it('reads options and drops grouped columns', () => {
    const o = parseOptions({ cols: 'sn,full_name,programme,cgpa,bogus', fmt: 'pdf' })
    expect(o).toMatchObject({ columns: ['sn', 'full_name', 'programme', 'cgpa'], format: 'pdf', grouped: true })
    expect(effectiveColumns(o).map((c) => c.key)).toEqual(['sn', 'full_name', 'cgpa'])
    expect(parseOptions({}).columns).not.toContain('cgpa')
  })

  it('groups by faculty, department and programme, names sorted', () => {
    const g = groupRows(rows)
    expect(g.map((x) => x.faculty)).toEqual(['Faculty of Arts', 'Faculty of Science'])
    const list = g[0].departments[0].programmes[0].rows
    expect(list[0].full_name < list[1].full_name).toBe(true)
  })

  it('builds an Excel file in Times New Roman with group headings', async () => {
    const buf = await buildWorkbook(rows, parseOptions({ cols: 'sn,full_name,reg_number,class,cgpa' }), heading)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('Register')!
    expect(ws.getCell('A1').value).toBe('TARABA STATE UNIVERSITY, JALINGO')
    const fonts = new Set<string>()
    ws.eachRow((r) => r.eachCell((c) => c.font?.name && fonts.add(c.font.name)))
    expect([...fonts]).toEqual(['Times New Roman'])
    const values = ws.getSheetValues().flat().filter((v) => typeof v === 'string') as string[]
    expect(values).toContain('FACULTY OF ARTS')
    expect(values).toContain('Master of Science (M.Sc.) History (120)')
    expect(values.some((v) => v.startsWith('Total: 240'))).toBe(true)
    if (process.env.EXPORT_SAMPLE_DIR) writeFileSync(`${process.env.EXPORT_SAMPLE_DIR}/sample.xlsx`, Buffer.from(buf))
  })

  it('builds a multi-page PDF, coping with characters outside the Times font', async () => {
    const pdf = await buildPdf(rows, parseOptions({ cols: 'sn,full_name,reg_number,class,certificate_serial,remark' }), heading)
    expect(pdf.byteLength).toBeGreaterThan(5000)
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(3)
    if (process.env.EXPORT_SAMPLE_DIR) writeFileSync(`${process.env.EXPORT_SAMPLE_DIR}/sample.pdf`, pdf)
  })
})
