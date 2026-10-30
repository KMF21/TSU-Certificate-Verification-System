import { parseCsv, toCell, type Cell } from './values'

export interface SheetData {
  name: string
  rows: Cell[][]
}

const MAX_BYTES = 15 * 1024 * 1024

/** Reads an .xlsx or .csv file in the browser into sheets of cells. */
export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  if (file.size > MAX_BYTES) throw new Error('That file is larger than 15 MB. Save only the sheet you need, or split it.')
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || file.type === 'text/csv') {
    const text = await file.text()
    return [{ name: file.name.replace(/\.[^.]+$/, ''), rows: parseCsv(text).map((r) => r.map(toCell)) }]
  }
  if (lower.endsWith('.xls')) throw new Error('Old .xls files can’t be read. Open it in Excel and “Save As” .xlsx, then upload again.')
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) throw new Error('Upload an Excel (.xlsx) or CSV file.')

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new Error('That Excel file couldn’t be opened. It may be password-protected or damaged. Try saving it again as .xlsx.')
  }
  const sheets: SheetData[] = []
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== 'visible') return
    const rows: Cell[][] = []
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: Cell[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = toCell(cell.value)
      })
      rows[n - 1] = Array.from(cells, (c) => c ?? null)
    })
    sheets.push({ name: ws.name, rows: Array.from(rows, (r) => r ?? []) })
  })
  if (!sheets.length) throw new Error('That file has no visible sheets.')
  return sheets
}
