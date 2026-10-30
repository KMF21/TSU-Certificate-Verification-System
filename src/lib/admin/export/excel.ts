import ExcelJS from 'exceljs'
import { cellValue, effectiveColumns, groupRows, type ExportOptions, type ExportRow } from './options'

const FONT = 'Times New Roman'
const NAVY = 'FF0F1F3D'

export interface Heading {
  title: string
  filters: string
  generatedBy: string
  generatedAt: string
}

/** The register as an Excel workbook, Times New Roman throughout. */
export async function buildWorkbook(rows: ExportRow[], options: ExportOptions, h: Heading): Promise<ArrayBuffer> {
  const cols = effectiveColumns(options)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CPGS Graduation Register'
  wb.created = new Date()
  const ws = wb.addWorksheet('Register', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: cols.reduce((n, c) => n + c.width, 0) > 120 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: `&"${FONT}"&8${h.title.replace(/&/g, '&&')} — page &P of &N` },
  })
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }))
  const last = cols.length
  const font = (size = 11, bold = false, italic = false, color?: string): Partial<ExcelJS.Font> => ({
    name: FONT, size, bold, italic, ...(color ? { color: { argb: color } } : {}),
  })

  const titleRow = (text: string, size: number, bold: boolean, italic = false) => {
    const r = ws.addRow([text])
    ws.mergeCells(r.number, 1, r.number, last)
    r.getCell(1).font = font(size, bold, italic)
    r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    r.height = size + 8
    return r
  }
  titleRow('TARABA STATE UNIVERSITY, JALINGO', 15, true)
  titleRow('COLLEGE OF POSTGRADUATE STUDIES', 13, true)
  titleRow(h.title.toUpperCase(), 12, true)
  titleRow(h.filters, 10, false, true)
  ws.addRow([])

  const head = ws.addRow(cols.map((c) => c.label))
  head.height = 20
  head.eachCell((cell) => {
    cell.font = font(11, true, false, 'FFFFFFFF')
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'thin' } }
  })
  ws.views = [{ state: 'frozen', ySplit: head.number }]
  // Repeat the column headings at the top of every printed page.
  ws.pageSetup.printTitlesRow = `${head.number}:${head.number}`

  const thin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFBFC5D2' } },
    bottom: { style: 'thin', color: { argb: 'FFBFC5D2' } },
    left: { style: 'thin', color: { argb: 'FFBFC5D2' } },
    right: { style: 'thin', color: { argb: 'FFBFC5D2' } },
  }
  const dataRow = (r: ExportRow, sn: number) => {
    const row = ws.addRow(cols.map((c) => cellValue(r, c.key, sn)))
    row.eachCell({ includeEmpty: true }, (cell, i) => {
      const c = cols[i - 1]
      cell.font = font(11)
      cell.border = thin
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c.align ?? 'left' }
      if (c.key === 'cgpa') cell.numFmt = '0.00'
      if (c.key === 'reg_number') cell.numFmt = '@'
    })
  }
  const groupRow = (text: string, size: number, fill: string, color = 'FF000000', indent = 0) => {
    const r = ws.addRow([text])
    ws.mergeCells(r.number, 1, r.number, last)
    const cell = r.getCell(1)
    cell.font = font(size, true, false, color)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { vertical: 'middle', indent }
    r.height = size + 9
  }

  if (options.grouped) {
    for (const g of groupRows(rows)) {
      groupRow(g.faculty.toUpperCase(), 12, 'FFDCE2EC')
      for (const d of g.departments) {
        groupRow(d.department, 11.5, 'FFEEF1F6', 'FF000000', 1)
        for (const p of d.programmes) {
          groupRow(`${p.programme} (${p.rows.length})`, 11, 'FFFFFFFF', 'FF8C1827', 2)
          p.rows.forEach((r, i) => dataRow(r, i + 1))
        }
      }
    }
  } else {
    ;[...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, 'en-GB')).forEach((r, i) => dataRow(r, i + 1))
  }

  ws.addRow([])
  const total = ws.addRow([`Total: ${rows.length.toLocaleString('en-GB')} graduate${rows.length === 1 ? '' : 's'}`])
  total.getCell(1).font = font(11, true)
  const foot = ws.addRow([`Generated from the CPGS Graduation Register by ${h.generatedBy}, ${h.generatedAt}.`])
  ws.mergeCells(foot.number, 1, foot.number, last)
  foot.getCell(1).font = font(9, false, true, 'FF5B6478')

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
