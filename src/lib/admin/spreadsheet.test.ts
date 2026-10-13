import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { readTable } from './spreadsheet'
import { TEMPLATE_COLUMNS, validateSheet } from './import-rows'

async function xlsxFile(rows: unknown[][]): Promise<File> {
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Records')
  sheet.addRow(TEMPLATE_COLUMNS.map((c) => c.header))
  rows.forEach((r) => sheet.addRow(r))
  const buffer = await wb.xlsx.writeBuffer()
  return new File([buffer as ArrayBuffer], 'records.xlsx')
}

describe('spreadsheet import', () => {
  it('reads an Excel template with real date cells and rich text', async () => {
    const file = await xlsxFile([
      ['Ibrahim', { richText: [{ text: 'Aisha ' }, { text: 'Ladi' }] }, 'TSU/19/CSC/1045', 'BSC-CSC', 'First Class Honours', new Date(Date.UTC(2025, 10, 20))],
      [],
      ['Okoro', 'Chidi', 'TSU/19/CSC/1046', 'BSC-CSC', '2:2', '20/11/2025', null, 'chidi@example.com'],
    ])
    const table = await readTable(file)
    const { rows, problems } = validateSheet(table, { level: 'undergraduate', programmeCodes: new Set(['BSC-CSC']), today: '2026-10-13' })
    expect(problems).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ other_names: 'Aisha Ladi', date_of_award: '2025-11-20' })
    expect(rows[1]).toMatchObject({ class_of_degree: 'Second Class Honours (Lower Division)', date_of_award: '2025-11-20', email: 'chidi@example.com' })
  })

  it('refuses other file types', async () => {
    await expect(readTable(new File(['x'], 'list.pdf'))).rejects.toThrow('Excel (.xlsx) or CSV')
  })
})
