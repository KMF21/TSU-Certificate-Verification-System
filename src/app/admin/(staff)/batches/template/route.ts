import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireStaff } from '@/lib/admin/session'
import { DEGREE_CLASSES, POSTGRADUATE_GRADES, type AwardLevel } from '@/lib/admin/roles'
import { TEMPLATE_COLUMNS } from '@/lib/admin/import-rows'

/** Excel template for one award level, with the valid programme codes and classes on a second sheet. */
export async function GET(request: Request) {
  const { supabase, profile } = await requireStaff()
  if (!profile) return new NextResponse('Forbidden', { status: 403 })
  const level: AwardLevel = new URL(request.url).searchParams.get('level') === 'postgraduate' ? 'postgraduate' : 'undergraduate'

  const { data: programmes } = await supabase
    .from('programmes')
    .select('code, name, award_title')
    .eq('award_level', level)
    .eq('active', true)
    .order('code')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TSU Certificate Verification'
  const sheet = wb.addWorksheet('Records', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 6) }))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1F3D' } }
  sheet.getColumn('matric_no').numFmt = '@'
  sheet.getColumn('date_of_award').numFmt = 'yyyy-mm-dd'
  sheet.getColumn('date_of_birth').numFmt = 'yyyy-mm-dd'

  const classes = level === 'undergraduate' ? DEGREE_CLASSES : POSTGRADUATE_GRADES
  const codes = (programmes ?? []).map((p) => p.code)
  const help = wb.addWorksheet('Lists')
  help.columns = [
    { header: 'Programme code', key: 'code', width: 18 },
    { header: 'Award', key: 'award', width: 60 },
    { header: '', key: 'gap', width: 4 },
    { header: level === 'undergraduate' ? 'Class of degree' : 'Grade (optional)', key: 'cls', width: 40 },
  ]
  help.getRow(1).font = { bold: true }
  ;(programmes ?? []).forEach((p, i) => {
    help.getCell(i + 2, 1).value = p.code
    help.getCell(i + 2, 2).value = `${p.award_title} ${p.name}`
  })
  classes.forEach((c, i) => (help.getCell(i + 2, 4).value = c))

  // Dropdowns for the two fields people most often mistype.
  for (let r = 2; r <= 3001; r++) {
    if (codes.length) {
      sheet.getCell(r, 4).dataValidation = {
        type: 'list', allowBlank: false, formulae: [`Lists!$A$2:$A$${codes.length + 1}`],
        showErrorMessage: true, errorTitle: 'Unknown programme', error: 'Pick a code from the Lists sheet.',
      }
    }
    sheet.getCell(r, 5).dataValidation = {
      type: 'list', allowBlank: level === 'postgraduate', formulae: [`Lists!$D$2:$D$${classes.length + 1}`],
      showErrorMessage: true, errorTitle: 'Unknown class', error: 'Pick a value from the list.',
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="TSU-${level}-records-template.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
