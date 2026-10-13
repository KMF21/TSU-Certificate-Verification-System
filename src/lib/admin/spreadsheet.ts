import 'server-only'
import ExcelJS from 'exceljs'
import { parseCsv, type Cell } from './import-rows'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Reads the first sheet of an .xlsx file, or a .csv file, into rows of cells. */
export async function readTable(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())
  if (name.endsWith('.csv')) return parseCsv(buffer.toString('utf8'))
  if (!name.endsWith('.xlsx')) throw new Error('Upload an Excel (.xlsx) or CSV file.')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('The workbook has no sheets.')
  const table: Cell[][] = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: Cell[] = []
    for (let c = 1; c <= sheet.columnCount; c++) {
      const v = row.getCell(c).value
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        // Rich text, hyperlinks and formulas: take what the cell shows.
        const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] }
        cells.push(o.richText ? o.richText.map((t) => t.text).join('') : ((o.result ?? o.text ?? '') as Cell))
      } else cells.push(v as Cell)
    }
    table[rowNumber - 1] = cells
  })
  return Array.from(table, (r) => r ?? [])
}

export function headerStyle(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1F3D' } }
}
