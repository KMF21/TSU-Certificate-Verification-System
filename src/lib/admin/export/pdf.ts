import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Heading } from './excel'
import { cellValue, effectiveColumns, groupRows, type ExportOptions, type ExportRow } from './options'

const NAVY = rgb(0.059, 0.122, 0.239)
const CRIMSON = rgb(0.549, 0.094, 0.153)
const GREY = rgb(0.36, 0.39, 0.47)
const LINE = rgb(0.75, 0.77, 0.82)
const BAND1 = rgb(0.863, 0.886, 0.925)
const BAND2 = rgb(0.933, 0.945, 0.965)

/** The standard PDF Times fonts only cover Western European characters. */
function clean(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?'))
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(next, size) <= width) line = next
    else {
      if (line) lines.push(line)
      // A single word wider than the cell is cut across lines.
      let rest = w
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let n = rest.length
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > width) n--
        lines.push(rest.slice(0, n))
        rest = rest.slice(n)
      }
      line = rest
    }
  }
  if (line || !lines.length) lines.push(line)
  return lines
}

export async function buildPdf(rows: ExportRow[], options: ExportOptions, h: Heading): Promise<Uint8Array> {
  const cols = effectiveColumns(options)
  const doc = await PDFDocument.create()
  doc.setTitle(h.title)
  doc.setCreator('CPGS Graduation Register')
  const regular = await doc.embedFont(StandardFonts.TimesRoman)
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic)

  const totalWidth = cols.reduce((n, c) => n + c.width, 0)
  const landscape = totalWidth > 120
  const [W, H] = landscape ? [841.89, 595.28] : [595.28, 841.89]
  const M = 36
  const usable = W - 2 * M
  const widths = cols.map((c) => (c.width / totalWidth) * usable)
  const SIZE = 9.5
  const PAD = 3
  const LH = SIZE * 1.2

  let page: PDFPage = doc.addPage([W, H])
  let y = H - M

  const centre = (text: string, font: PDFFont, size: number, color = NAVY) => {
    for (const line of wrap(text, font, size, usable)) {
      page.drawText(line, { x: (W - font.widthOfTextAtSize(line, size)) / 2, y: y - size, size, font, color })
      y -= size * 1.25
    }
  }

  const headerRow = () => {
    const heights = cols.map((c, i) => wrap(c.label, bold, SIZE, widths[i] - 2 * PAD).length)
    const hgt = Math.max(...heights) * LH + 2 * PAD
    page.drawRectangle({ x: M, y: y - hgt, width: usable, height: hgt, color: NAVY })
    let x = M
    cols.forEach((c, i) => {
      wrap(c.label, bold, SIZE, widths[i] - 2 * PAD).forEach((line, li) =>
        page.drawText(line, { x: x + PAD, y: y - PAD - SIZE - li * LH + 1.5, size: SIZE, font: bold, color: rgb(1, 1, 1) }),
      )
      x += widths[i]
    })
    y -= hgt
  }

  const newPage = () => {
    page = doc.addPage([W, H])
    y = H - M
    headerRow()
  }
  const ensure = (needed: number) => {
    if (y - needed < M + 20) newPage()
  }

  // Title block on the first page.
  centre('TARABA STATE UNIVERSITY, JALINGO', bold, 14)
  centre('COLLEGE OF POSTGRADUATE STUDIES', bold, 12)
  y -= 2
  centre(h.title.toUpperCase(), bold, 11, CRIMSON)
  centre(h.filters, italic, 9, GREY)
  y -= 6
  headerRow()

  const band = (text: string, font: PDFFont, size: number, fill: ReturnType<typeof rgb> | null, color = NAVY, indent = 0) => {
    const lines = wrap(text, font, size, usable - 2 * PAD - indent)
    const hgt = lines.length * size * 1.2 + 2 * PAD + 1
    // Keep a heading with at least one row under it.
    ensure(hgt + LH + 2 * PAD)
    if (fill) page.drawRectangle({ x: M, y: y - hgt, width: usable, height: hgt, color: fill })
    lines.forEach((line, li) => page.drawText(line, { x: M + PAD + indent, y: y - PAD - size - li * size * 1.2 + 1.5, size, font, color }))
    y -= hgt
  }

  const dataRow = (r: ExportRow, sn: number) => {
    const cells = cols.map((c, i) => {
      const v = cellValue(r, c.key, sn)
      const text = typeof v === 'number' ? (c.key === 'cgpa' ? v.toFixed(2) : String(v)) : v
      return wrap(text, regular, SIZE, widths[i] - 2 * PAD)
    })
    const hgt = Math.max(...cells.map((l) => l.length)) * LH + 2 * PAD
    ensure(hgt)
    let x = M
    cols.forEach((c, i) => {
      cells[i].forEach((line, li) => {
        const w = regular.widthOfTextAtSize(line, SIZE)
        const tx = c.align === 'right' ? x + widths[i] - PAD - w : x + PAD
        page.drawText(line, { x: tx, y: y - PAD - SIZE - li * LH + 1.5, size: SIZE, font: regular, color: rgb(0.1, 0.1, 0.1) })
      })
      x += widths[i]
    })
    page.drawLine({ start: { x: M, y: y - hgt }, end: { x: M + usable, y: y - hgt }, thickness: 0.4, color: LINE })
    y -= hgt
  }

  if (options.grouped) {
    for (const g of groupRows(rows)) {
      y -= 4
      band(g.faculty.toUpperCase(), bold, 10.5, BAND1)
      for (const d of g.departments) {
        band(d.department, bold, 10, BAND2, NAVY, 6)
        for (const p of d.programmes) {
          band(`${p.programme} (${p.rows.length})`, bold, 9.5, null, CRIMSON, 12)
          p.rows.forEach((r, i) => dataRow(r, i + 1))
        }
      }
    }
  } else {
    ;[...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, 'en-GB')).forEach((r, i) => dataRow(r, i + 1))
  }
  ensure(40)
  y -= 10
  page.drawText(clean(`Total: ${rows.length.toLocaleString('en-GB')} graduate${rows.length === 1 ? '' : 's'}`), { x: M, y: y - 10, size: 10, font: bold, color: NAVY })
  y -= 16
  page.drawText(clean(`Generated from the CPGS Graduation Register by ${h.generatedBy}, ${h.generatedAt}.`), { x: M, y: y - 9, size: 8, font: italic, color: GREY })

  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const text = clean(`${h.title} - page ${i + 1} of ${pages.length}`)
    p.drawText(text, { x: (W - italic.widthOfTextAtSize(text, 8)) / 2, y: 18, size: 8, font: italic, color: GREY })
  })
  return doc.save()
}
