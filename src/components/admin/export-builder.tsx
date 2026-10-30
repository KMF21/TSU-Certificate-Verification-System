'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, Bookmark, Download, FileSpreadsheet, FileText, Share2, X } from 'lucide-react'
import {
  cellValue,
  COLUMNS,
  COLUMN_BY_KEY,
  DEFAULT_COLUMNS,
  effectiveColumns,
  groupRows,
  optionsToParams,
  type ExportColumn,
  type ExportOptions,
  type ExportRow,
} from '@/lib/admin/export/options'
import { deletePresetAction, savePresetAction } from '@/app/admin/(staff)/export/actions'
import { Notice } from './ui'

export interface Preset {
  id: string
  name: string
  shared: boolean
  mine: boolean
  query: string
}

const MAX = 20000
const fmt = (n: number) => n.toLocaleString('en-GB')

export function ExportBuilder({
  count,
  preview,
  filterQuery,
  filterSummary,
  initial,
  presets,
}: {
  count: number
  preview: ExportRow[]
  filterQuery: string
  filterSummary: string
  initial: ExportOptions
  presets: Preset[]
}) {
  const router = useRouter()
  const [columns, setColumns] = useState<ExportColumn[]>(initial.columns)
  const [grouped, setGrouped] = useState(initial.grouped)
  const [format, setFormat] = useState(initial.format)
  const [title, setTitle] = useState(initial.title)
  const [presetName, setPresetName] = useState('')
  const [shareIt, setShareIt] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()

  const options: ExportOptions = { columns, grouped, format, title }
  const optionQuery = optionsToParams(options).toString()
  const query = [filterQuery, optionQuery].filter(Boolean).join('&')

  // Keep the address bar in step, so filters applied later keep these choices.
  useEffect(() => {
    window.history.replaceState(null, '', `/admin/export?${query}`)
  }, [query])

  const shown = effectiveColumns(options)
  const toggle = (k: ExportColumn) => setColumns((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))
  const move = (k: ExportColumn, dir: -1 | 1) =>
    setColumns((c) => {
      const i = c.indexOf(k)
      const j = i + dir
      if (i < 0 || j < 0 || j >= c.length) return c
      const next = [...c]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const unselected = COLUMNS.filter((c) => !columns.includes(c.key))
  const groups = useMemo(() => (grouped ? groupRows(preview) : null), [grouped, preview])
  const tooMany = count > MAX

  return (
    <div className="mt-6 space-y-6">
      {presets.length > 0 && (
        <section aria-label="Saved presets" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Presets:</span>
          {presets.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1.5 text-sm ring-1 ring-line">
              <Link href={`/admin/export?${p.query}`} className="font-medium text-navy hover:underline">{p.name}</Link>
              {p.shared && <Share2 className="h-3.5 w-3.5 text-ink-faint" aria-label="Shared with staff" />}
              {p.mine && (
                <button
                  type="button"
                  aria-label={`Delete preset ${p.name}`}
                  className="rounded-full p-0.5 text-ink-faint hover:bg-canvas hover:text-status-revoked"
                  onClick={() =>
                    start(async () => {
                      const res = await deletePresetAction(p.id)
                      setMessage(res.error ? { tone: 'bad', text: res.error } : { tone: 'good', text: res.ok! })
                      router.refresh()
                    })
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <section className="card h-fit space-y-6 p-5">
          <div>
            <h2 className="font-display text-base font-semibold text-navy">Columns</h2>
            <p className="mt-1 text-xs text-ink-muted">Ticked columns appear in this order. Use the arrows to reorder.</p>
            <ul className="mt-3 space-y-1">
              {columns.map((k, i) => {
                const c = COLUMN_BY_KEY.get(k)!
                const hidden = grouped && c.groupedAway
                return (
                  <li key={k} className="flex items-center gap-2 rounded-md bg-navy-50/60 px-2 py-1.5 text-sm">
                    <input type="checkbox" checked onChange={() => toggle(k)} className="h-4 w-4 accent-navy" aria-label={`Remove ${c.label}`} />
                    <span className={clsx('flex-1', hidden && 'text-ink-faint line-through')}>{c.label}</span>
                    {hidden && <span className="text-[11px] text-ink-faint">in headings</span>}
                    <button type="button" disabled={i === 0} onClick={() => move(k, -1)} className="rounded p-0.5 text-ink-muted hover:text-navy disabled:opacity-30" aria-label={`Move ${c.label} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === columns.length - 1} onClick={() => move(k, 1)} className="rounded p-0.5 text-ink-muted hover:text-navy disabled:opacity-30" aria-label={`Move ${c.label} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
              {unselected.map((c) => (
                <li key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink-muted">
                  <input type="checkbox" checked={false} onChange={() => toggle(c.key)} className="h-4 w-4 accent-navy" aria-label={`Add ${c.label}`} />
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="mt-2 text-xs text-navy underline-offset-2 hover:underline" onClick={() => setColumns(DEFAULT_COLUMNS)}>
              Reset to the usual columns
            </button>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="mt-0.5 h-4 w-4 accent-navy" />
            <span>
              <span className="font-medium">Group by faculty, department and programme</span>
              <span className="block text-xs text-ink-muted">Numbering restarts for each programme. Untick for one list sorted by name.</span>
            </span>
          </label>

          <label className="block">
            <span className="label">Title on the document</span>
            <input className="field-sm" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Graduation register" />
          </label>

          <fieldset>
            <legend className="label">Format</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['xlsx', 'Excel', FileSpreadsheet],
                ['pdf', 'PDF', FileText],
              ] as const).map(([v, label, Icon]) => (
                <label key={v} className={clsx('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium', format === v ? 'border-navy bg-navy-50 text-navy' : 'border-line text-ink-muted')}>
                  <input type="radio" name="format" className="sr-only" checked={format === v} onChange={() => setFormat(v)} />
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="border-t border-line pt-5">
            {tooMany ? (
              <Notice tone="warn">{fmt(count)} records is more than the {fmt(MAX)} that fit in one export. Narrow the filters, for example by session or faculty.</Notice>
            ) : (
              <a
                href={count ? `/admin/export/file?${query}` : undefined}
                aria-disabled={!count || !shown.length}
                className={clsx('btn-primary w-full', (!count || !shown.length) && 'pointer-events-none opacity-50')}
              >
                <Download className="h-4 w-4" aria-hidden /> Download {fmt(count)} record{count === 1 ? '' : 's'} as {format === 'pdf' ? 'PDF' : 'Excel'}
              </a>
            )}
            {count > 3000 && !tooMany && <p className="mt-2 text-xs text-ink-muted">Large lists can take up to half a minute to prepare.</p>}
          </div>

          <form
            className="space-y-2 border-t border-line pt-5"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const res = await savePresetAction({ name: presetName, query, shared: shareIt })
                setMessage(res.error ? { tone: 'bad', text: res.error } : { tone: 'good', text: res.ok! })
                if (!res.error) {
                  setPresetName('')
                  router.refresh()
                }
              })
            }}
          >
            <label className="block">
              <span className="label">Save these choices as a preset</span>
              <input className="field-sm" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="e.g. Convocation list by faculty" maxLength={80} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" checked={shareIt} onChange={(e) => setShareIt(e.target.checked)} className="h-4 w-4 accent-navy" /> Share with other staff
            </label>
            <button type="submit" className="btn-outline btn-sm" disabled={pending || presetName.trim().length < 2}>
              <Bookmark className="h-4 w-4" aria-hidden /> Save preset
            </button>
          </form>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
        </section>

        <section className="card h-fit min-w-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <p className="font-display text-2xl font-semibold tabular-nums text-navy">{fmt(count)}</p>
            <p className="text-sm text-ink-muted">record{count === 1 ? '' : 's'} · {filterSummary}</p>
          </div>
          <div className="bg-canvas/60 px-4 py-5 sm:px-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Preview of the first rows</p>
            <div className="overflow-x-auto rounded-md bg-white p-4 shadow-card" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
              <p className="text-center text-[15px] font-bold">TARABA STATE UNIVERSITY, JALINGO</p>
              <p className="text-center text-[13px] font-bold">COLLEGE OF POSTGRADUATE STUDIES</p>
              <p className="mt-0.5 text-center text-[12px] font-bold uppercase text-crimson-700">{title || 'Graduation register'}</p>
              <p className="text-center text-[11px] italic text-ink-muted">{filterSummary}</p>
              {count === 0 ? (
                <p className="mt-6 text-center text-sm text-ink-muted">No records match these filters.</p>
              ) : (
                <table className="mt-3 w-full min-w-[520px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-navy text-left text-white">
                      {shown.map((c) => <th key={c.key} className="px-2 py-1.5 font-bold">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups
                      ? groups.map((g) => (
                          <GroupRows key={g.faculty} g={g} cols={shown} />
                        ))
                      : [...preview].sort((a, b) => a.full_name.localeCompare(b.full_name)).map((r, i) => <DataRow key={r.id} r={r} sn={i + 1} cols={shown} />)}
                  </tbody>
                </table>
              )}
              {count > preview.length && <p className="mt-2 text-center text-[11px] italic text-ink-muted">… and {fmt(count - preview.length)} more in the download</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

type Cols = ReturnType<typeof effectiveColumns>

function DataRow({ r, sn, cols }: { r: ExportRow; sn: number; cols: Cols }) {
  return (
    <tr className="border-b border-line">
      {cols.map((c) => {
        const v = cellValue(r, c.key, sn)
        return (
          <td key={c.key} className={clsx('px-2 py-1 align-top', c.align === 'right' && 'text-right tabular-nums')}>
            {typeof v === 'number' && c.key === 'cgpa' ? v.toFixed(2) : v}
          </td>
        )
      })}
    </tr>
  )
}

function GroupRows({ g, cols }: { g: ReturnType<typeof groupRows>[number]; cols: Cols }) {
  return (
    <>
      <tr className="bg-navy-100"><td colSpan={cols.length} className="px-2 py-1 font-bold">{g.faculty.toUpperCase()}</td></tr>
      {g.departments.map((d) => (
        <FragmentRows key={d.department} d={d} cols={cols} />
      ))}
    </>
  )
}

function FragmentRows({ d, cols }: { d: ReturnType<typeof groupRows>[number]['departments'][number]; cols: Cols }) {
  return (
    <>
      <tr className="bg-navy-50"><td colSpan={cols.length} className="px-2 py-1 pl-4 font-bold">{d.department}</td></tr>
      {d.programmes.map((p) => (
        <ProgrammeRows key={p.programme} p={p} cols={cols} />
      ))}
    </>
  )
}

function ProgrammeRows({ p, cols }: { p: { programme: string; rows: ExportRow[] }; cols: Cols }) {
  return (
    <>
      <tr><td colSpan={cols.length} className="px-2 py-1 pl-6 font-bold text-crimson-700">{p.programme}</td></tr>
      {p.rows.map((r, i) => <DataRow key={r.id} r={r} sn={i + 1} cols={cols} />)}
    </>
  )
}
