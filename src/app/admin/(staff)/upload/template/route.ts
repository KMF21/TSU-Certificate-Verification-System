import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin/session'
import { loadReference } from '@/lib/admin/reference'
import { LEVEL_LABEL } from '@/lib/admin/roles'

export const dynamic = 'force-dynamic'

const NAVY = 'FF0F1F3D'

/** An Excel template with the register's columns and pick-lists of programmes and classes. */
export async function GET() {
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('Not signed in', { status: 401 })
  const ref = await loadReference(supabase)
  const dept = new Map(ref.departments.map((d) => [d.id, d]))
  const fac = new Map(ref.faculties.map((f) => [f.id, f]))
  const programmes = ref.programmes
    .filter((p) => p.active)
    .map((p) => {
      const d = dept.get(p.department_id)
      return { label: `${p.award_title} ${p.name}`, code: p.code, level: LEVEL_LABEL[p.level], department: d?.name ?? '', faculty: fac.get(d?.faculty_id ?? '')?.name ?? '' }
    })
    .sort((a, b) => a.faculty.localeCompare(b.faculty) || a.department.localeCompare(b.department) || a.label.localeCompare(b.label))
  const classes = ref.classes.filter((c) => c.active)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CPGS Graduation Register'
  const sheet = wb.addWorksheet('Graduates', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Full name (surname first)', key: 'name', width: 34 },
    { header: 'Registration number', key: 'reg', width: 24 },
    { header: 'Programme', key: 'programme', width: 52 },
    { header: 'CGPA (optional)', key: 'cgpa', width: 14 },
    { header: 'Class of degree (optional)', key: 'class', width: 22 },
    { header: 'Graduation session', key: 'session', width: 18 },
    { header: 'Senate approval date', key: 'date', width: 20 },
    { header: 'Remark (optional)', key: 'remark', width: 30 },
  ]
  const head = sheet.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Times New Roman' }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  head.height = 22
  sheet.addRow({ name: 'EXAMPLE Ruth Adi (delete this row)', reg: 'TSU/PG/22/CS/0001', programme: programmes[0]?.label ?? '', cgpa: 4.25, class: classes[0]?.label ?? '', session: '2024/2025', date: new Date(Date.UTC(2025, 10, 20)) })
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF8A93A6' } }
  sheet.getColumn('date').numFmt = 'dd/mm/yyyy'
  sheet.getColumn('reg').numFmt = '@'

  const plist = wb.addWorksheet('Programmes')
  plist.columns = [
    { header: 'Programme (copy exactly)', key: 'label', width: 60 },
    { header: 'Code', key: 'code', width: 16 },
    { header: 'Level', key: 'level', width: 14 },
    { header: 'Department', key: 'department', width: 44 },
    { header: 'Faculty', key: 'faculty', width: 36 },
  ]
  plist.getRow(1).font = { bold: true }
  programmes.forEach((p) => plist.addRow(p))
  const clist = wb.addWorksheet('Classes')
  clist.columns = [{ header: 'Class of degree', key: 'label', width: 24 }, { header: 'Applies to', key: 'level', width: 16 }]
  clist.getRow(1).font = { bold: true }
  classes.forEach((c) => clist.addRow({ label: c.label, level: c.level ? LEVEL_LABEL[c.level] : 'All levels' }))

  // Drop-downs on the first 5,000 data rows.
  for (let r = 2; r <= 5001; r++) {
    sheet.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Programmes!$A$2:$A$${programmes.length + 1}`], showErrorMessage: false }
    sheet.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Classes!$A$2:$A$${classes.length + 1}`], showErrorMessage: false }
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="CPGS-graduation-register-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
