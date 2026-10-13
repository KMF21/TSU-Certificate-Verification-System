import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireStaff } from '@/lib/admin/session'
import { headerStyle } from '@/lib/admin/spreadsheet'
import { REFERENCE_COLUMNS } from '@/lib/admin/reference-rows'

/** Programme list template, pre-filled with whatever is already in the register so it can be edited and re-uploaded. */
export async function GET() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('Forbidden', { status: 403 })
  const { data } = await supabase
    .from('programmes')
    .select('code, name, award_title, award_level, departments(code, name, faculties(code, name))')
    .order('code')
    .returns<{ code: string; name: string; award_title: string; award_level: string; departments: { code: string; name: string; faculties: { code: string; name: string } } }[]>()

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Programmes', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = REFERENCE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.key.endsWith('name') || c.key === 'award_title' ? 40 : 18 }))
  headerStyle(sheet)
  const rows = data?.length
    ? data.map((p) => ({
        faculty_code: p.departments.faculties.code,
        faculty_name: p.departments.faculties.name,
        department_code: p.departments.code,
        department_name: p.departments.name,
        programme_code: p.code,
        programme_name: p.name,
        award_title: p.award_title,
        award_level: p.award_level === 'postgraduate' ? 'Postgraduate' : 'Undergraduate',
      }))
    : [Object.fromEntries(REFERENCE_COLUMNS.map((c) => [c.key, c.example]))]
  sheet.addRows(rows)
  for (let r = 2; r <= 2000; r++) {
    sheet.getCell(r, 8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Undergraduate,Postgraduate"'] }
  }
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="TSU-programme-list.xlsx"',
      'Cache-Control': 'private, no-store',
    },
  })
}
