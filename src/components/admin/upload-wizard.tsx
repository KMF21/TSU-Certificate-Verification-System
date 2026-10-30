'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import type { Reference } from '@/lib/admin/reference'
import { LEVEL_LABEL } from '@/lib/admin/roles'
import { FIELD_LABEL, FIELD_ORDER, guessMapping, headingScore, type ImportField } from '@/lib/admin/import/fields'
import { buildRows, choiceKey, findHeadingRow, type BuiltRow, type Existing, type RowAction, type SharedValues } from '@/lib/admin/import/build'
import type { ProgrammeRef } from '@/lib/admin/import/match'
import { readSpreadsheet, type SheetData } from '@/lib/admin/import/read-file'
import { cellText, normaliseReg } from '@/lib/admin/import/values'
import { lagosToday } from '@/lib/admin/record-input'
import { commitImportAction, lookupExistingAction } from '@/app/admin/(staff)/upload/actions'
import { Badge, Notice } from './ui'

type Step = 'file' | 'columns' | 'review'
const PAGE = 100

export function UploadWizard({
  reference,
  sessions,
  lookupExisting = lookupExistingAction,
  commitImport = commitImportAction,
}: {
  reference: Reference
  sessions: string[]
  lookupExisting?: typeof lookupExistingAction
  commitImport?: typeof commitImportAction
}) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headingRow, setHeadingRow] = useState(0)
  const [mapping, setMapping] = useState<(ImportField | null)[]>([])
  const [source, setSource] = useState<'live' | 'legacy' | ''>('')
  const [shared, setShared] = useState<SharedValues>({})
  const [duplicates, setDuplicates] = useState<'skip' | 'update'>('skip')
  const [programmeChoices, setProgrammeChoices] = useState<Record<string, string>>({})
  const [classChoices, setClassChoices] = useState<Record<string, string>>({})
  const [existing, setExisting] = useState<Record<string, Existing>>({})
  const [checking, setChecking] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [committing, startCommit] = useTransition()
  const [dragging, setDragging] = useState(false)
  const [tab, setTab] = useState<RowAction | 'all'>('all')
  const [page, setPage] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = lagosToday()

  const programmes: ProgrammeRef[] = useMemo(() => {
    const dept = new Map(reference.departments.map((d) => [d.id, d.name]))
    return reference.programmes
      .filter((p) => p.active)
      .map((p) => ({ id: p.id, code: p.code, name: p.name, award_title: p.award_title, level: p.level, department_name: dept.get(p.department_id) ?? '' }))
  }, [reference])
  const classes = useMemo(() => reference.classes.filter((c) => c.active), [reference.classes])

  const sheet = sheets[sheetIndex]
  const headings = useMemo(() => (sheet?.rows[headingRow] ?? []).map(cellText), [sheet, headingRow])
  const width = useMemo(() => Math.max(headings.length, ...(sheet?.rows.slice(headingRow, headingRow + 50).map((r) => r.length) ?? [0])), [sheet, headingRow, headings])

  // Read the file.
  const load = async (f: File) => {
    setReadError(null)
    setReading(true)
    try {
      const data = await readSpreadsheet(f)
      const withRows = data.filter((s) => s.rows.some((r) => r.some((c) => c !== null)))
      if (!withRows.length) throw new Error('That file has no data in it.')
      setFile(f)
      setSheets(withRows)
      chooseSheet(withRows, 0)
    } catch (e) {
      setReadError((e as Error).message)
    } finally {
      setReading(false)
    }
  }
  const chooseSheet = (list: SheetData[], i: number) => {
    setSheetIndex(i)
    const h = findHeadingRow(list[i].rows, headingScore)
    setHeadingRow(h)
    setMapping(guessMapping((list[i].rows[h] ?? []).map(cellText)))
    setProgrammeChoices({})
    setClassChoices({})
  }
  const changeHeadingRow = (h: number) => {
    setHeadingRow(h)
    setMapping(guessMapping((sheet?.rows[h] ?? []).map(cellText)))
  }

  const regCol = mapping.indexOf('reg_number')
  // Look up registration numbers already in the register.
  const regs = useMemo(() => {
    if (!sheet || regCol < 0) return []
    return [...new Set(sheet.rows.slice(headingRow + 1).map((r) => normaliseReg(cellText(r[regCol] ?? null))).filter(Boolean))]
  }, [sheet, headingRow, regCol])
  useEffect(() => {
    if (step !== 'review' || !regs.length) return
    let live = true
    setChecking(true)
    lookupExisting(regs).then((res) => {
      if (!live) return
      setExisting(res.existing)
      if (res.error) setCommitError(res.error)
      setChecking(false)
    })
    return () => {
      live = false
    }
  }, [regs, step, lookupExisting])

  const result = useMemo(() => {
    if (!sheet || step !== 'review') return null
    return buildRows({
      rows: sheet.rows,
      headingRow,
      mapping,
      shared,
      programmes,
      classes,
      programmeChoices,
      classChoices,
      existing,
      duplicates,
      today,
    })
  }, [sheet, step, headingRow, mapping, shared, programmes, classes, programmeChoices, classChoices, existing, duplicates, today])

  const has = (f: ImportField) => mapping.includes(f)
  const missing: string[] = []
  if (!has('full_name') && !(has('surname') && has('other_names')) && !has('surname')) missing.push('the graduate’s name')
  if (!has('reg_number')) missing.push('the registration number')
  if (!has('programme') && !shared.programme_id) missing.push('the programme (map a column or choose one programme for the whole file)')
  const columnsReady = !missing.length && !!source

  const shown = useMemo(() => (result ? result.rows.filter((r) => tab === 'all' || r.action === tab) : []), [result, tab])
  const ready = result ? result.counts.create + result.counts.update : 0

  const commit = () => {
    if (!result || !file || !source) return
    setCommitError(null)
    startCommit(async () => {
      const rows = result.rows
        .filter((r) => r.action === 'create' || r.action === 'update')
        .map((r) => ({
          row: r.row,
          action: r.action as 'create' | 'update',
          full_name: r.full_name,
          reg_number: r.reg_number,
          programme_id: r.programme_id!,
          cgpa: r.cgpa,
          class_id: r.class_id,
          remark: r.remark,
          graduation_session: r.graduation_session,
          senate_approval_date: r.senate_approval_date,
        }))
      const report = result.rows
        .filter((r) => r.action === 'skip' || r.action === 'reject')
        .map((r) => ({
          row: r.row,
          reg_number: r.reg_number,
          full_name: r.full_name,
          outcome: (r.action === 'skip' ? 'skipped' : 'rejected') as 'skipped' | 'rejected',
          reason: r.action === 'skip' ? (r.note ?? 'Already in the register') : r.problems.join('; '),
        }))
      const mappingOut: Record<string, string> = {}
      mapping.forEach((f, i) => f && (mappingOut[headings[i] || `Column ${i + 1}`] = f))
      const sharedOut: Record<string, string> = {}
      for (const [k, v] of Object.entries(shared)) if (v) sharedOut[k] = v
      const res = await commitImport({ fileName: file.name, source, rows, mapping: mappingOut, shared: sharedOut, report })
      if (res.error) setCommitError(res.error)
      else router.push(`/admin/upload/${res.batchId}?new=1`)
    })
  }

  return (
    <div>
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
        {(['file', 'columns', 'review'] as Step[]).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-line" aria-hidden />}
            <span
              aria-current={step === s ? 'step' : undefined}
              className={clsx('rounded-full px-3 py-1 font-medium', step === s ? 'bg-navy text-white' : 'bg-white text-ink-muted ring-1 ring-line')}
            >
              {i + 1}. {s === 'file' ? 'Choose file' : s === 'columns' ? 'Match columns' : 'Check and import'}
            </span>
          </li>
        ))}
      </ol>

      {step === 'file' && (
        <section className="card p-5 sm:p-7">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) load(f)
            }}
            className={clsx(
              'flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors',
              dragging ? 'border-navy bg-navy-50' : 'border-line bg-canvas/50',
            )}
          >
            {reading ? (
              <Loader2 className="h-10 w-10 animate-spin text-navy" aria-hidden />
            ) : file ? (
              <FileSpreadsheet className="h-10 w-10 text-status-valid" aria-hidden />
            ) : (
              <UploadCloud className="h-10 w-10 text-ink-faint" aria-hidden />
            )}
            <p className="mt-3 font-display font-semibold text-navy">
              {reading ? 'Reading the file…' : file ? file.name : 'Drag an Excel or CSV file here'}
            </p>
            {file && sheet && (
              <p className="mt-1 text-sm text-ink-muted">
                {sheets.length} sheet{sheets.length === 1 ? '' : 's'} · {Math.max(0, sheet.rows.length - headingRow - 1).toLocaleString('en-GB')} rows on “{sheet.name}”
              </p>
            )}
            <button type="button" className="btn-outline btn-sm mt-4" onClick={() => inputRef.current?.click()} disabled={reading}>
              {file ? 'Choose a different file' : 'Choose a file'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) load(f)
                e.target.value = ''
              }}
            />
          </div>
          {readError && <div className="mt-4"><Notice tone="bad">{readError}</Notice></div>}

          {sheets.length > 1 && (
            <label className="mt-5 block max-w-sm">
              <span className="label">Which sheet?</span>
              <select className="field-sm" value={sheetIndex} onChange={(e) => chooseSheet(sheets, Number(e.target.value))}>
                {sheets.map((s, i) => <option key={s.name + i} value={i}>{s.name} ({s.rows.length.toLocaleString('en-GB')} rows)</option>)}
              </select>
            </label>
          )}

          <fieldset className="mt-6">
            <legend className="label">What kind of records are these?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['live', 'Live', 'Current graduates. They get a certificate serial and verification code when approved.'],
                ['legacy', 'Legacy', 'Older graduates from past records. They need to be verified against official documents before the public sees them.'],
              ] as const).map(([v, title, help]) => (
                <label key={v} className={clsx('flex cursor-pointer gap-3 rounded-lg border p-4 text-sm', source === v ? 'border-navy bg-navy-50' : 'border-line hover:border-navy/30')}>
                  <input type="radio" name="source" value={v} checked={source === v} onChange={() => setSource(v)} className="mt-0.5 accent-navy" />
                  <span>
                    <span className="block font-semibold text-navy">{title}</span>
                    <span className="text-ink-muted">{help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex justify-end">
            <button type="button" className="btn-primary" disabled={!sheet || !source} onClick={() => setStep('columns')}>
              Next: match columns <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {step === 'columns' && sheet && (
        <section className="space-y-6">
          <div className="card p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-navy">Match the columns</h2>
                <p className="mt-1 text-sm text-ink-muted">We’ve guessed from the headings. Change any that are wrong, and set columns you don’t need to “Ignore”.</p>
              </div>
              <label className="block shrink-0">
                <span className="label">Headings are on row</span>
                <select className="field-sm w-28" value={headingRow} onChange={(e) => changeHeadingRow(Number(e.target.value))}>
                  {Array.from({ length: Math.min(20, sheet.rows.length) }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-ink-muted">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Column in your file</th>
                    <th className="py-2 pr-4 font-medium">Examples</th>
                    <th className="py-2 font-medium">Goes into</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: width }, (_, i) => {
                    const samples = sheet.rows.slice(headingRow + 1).map((r) => cellText(r[i] ?? null)).filter(Boolean).slice(0, 3)
                    return (
                      <tr key={i} className="border-t border-line align-top">
                        <td className="py-2.5 pr-4 font-medium">{headings[i] || <span className="text-ink-faint">Column {i + 1}</span>}</td>
                        <td className="max-w-xs py-2.5 pr-4 text-ink-muted"><span className="line-clamp-2">{samples.join(' · ') || '—'}</span></td>
                        <td className="py-2.5">
                          <select
                            className={clsx('field-sm w-56', mapping[i] && 'border-navy/40 bg-navy-50/40')}
                            value={mapping[i] ?? ''}
                            aria-label={`Field for ${headings[i] || `column ${i + 1}`}`}
                            onChange={(e) => {
                              const f = (e.target.value || null) as ImportField | null
                              setMapping((m) => {
                                const next = Array.from({ length: Math.max(m.length, width) }, (_, j) => m[j] ?? null)
                                if (f) next.forEach((x, j) => x === f && (next[j] = null))
                                next[i] = f
                                return next
                              })
                            }}
                          >
                            <option value="">Ignore</option>
                            {FIELD_ORDER.map((f) => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5 sm:p-7">
            <h2 className="font-display text-lg font-semibold text-navy">Values for the whole file</h2>
            <p className="mt-1 text-sm text-ink-muted">Fill these in when the sheet doesn’t have the column, or when every row shares the same value. A value here overrides the column.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="label">Programme</span>
                <ProgrammeSelect reference={reference} value={shared.programme_id ?? ''} onChange={(v) => setShared((s) => ({ ...s, programme_id: v || undefined }))} emptyLabel={has('programme') ? 'Use the Programme column' : 'Choose a programme'} />
              </label>
              <label className="block">
                <span className="label">Graduation session</span>
                <select className="field-sm" value={shared.graduation_session ?? ''} onChange={(e) => setShared((s) => ({ ...s, graduation_session: e.target.value || undefined }))}>
                  <option value="">{has('graduation_session') ? 'Use the Session column' : 'Not set (can be added when approving)'}</option>
                  {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Senate approval date</span>
                <input type="date" className="field-sm" min="2008-01-01" max={today} value={shared.senate_approval_date ?? ''} onChange={(e) => setShared((s) => ({ ...s, senate_approval_date: e.target.value || undefined }))} />
              </label>
              <label className="block">
                <span className="label">Class of degree</span>
                <select className="field-sm" value={shared.class_id ?? ''} onChange={(e) => setShared((s) => ({ ...s, class_id: e.target.value || undefined }))}>
                  <option value="">{has('class') ? 'Use the Class column' : 'Not stated'}</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
            </div>
            <fieldset className="mt-5">
              <legend className="label">When a registration number is already in the register</legend>
              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
                <label className="flex items-center gap-2"><input type="radio" className="accent-navy" checked={duplicates === 'skip'} onChange={() => setDuplicates('skip')} /> Skip it (keep what’s in the register)</label>
                <label className="flex items-center gap-2"><input type="radio" className="accent-navy" checked={duplicates === 'update'} onChange={() => setDuplicates('update')} /> Update it with the file’s values</label>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">Approved records are always skipped. Correct those one at a time from their record page, with a reason.</p>
            </fieldset>
          </div>

          {missing.length > 0 && <Notice tone="warn">Still needed: {missing.join(', ')}.</Notice>}
          <div className="flex justify-between">
            <button type="button" className="btn-outline" onClick={() => setStep('file')}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
            <button type="button" className="btn-primary" disabled={!columnsReady} onClick={() => { setTab('all'); setPage(0); setStep('review') }}>
              Next: check rows <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </section>
      )}

      {step === 'review' && result && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Tally label="New records" value={result.counts.create} tone="good" />
            <Tally label="Updates to pending records" value={result.counts.update} tone="info" />
            <Tally label="Skipped (already in register)" value={result.counts.skip} tone="neutral" />
            <Tally label="Rows with problems" value={result.counts.reject} tone={result.counts.reject ? 'bad' : 'neutral'} />
          </div>
          {checking && <p className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking registration numbers against the register…</p>}

          {result.unresolvedProgrammes.length > 0 && (
            <div className="card border-status-superseded/30 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-navy">
                <AlertTriangle className="h-5 w-5 text-status-superseded" aria-hidden /> Confirm {result.unresolvedProgrammes.length} programme name{result.unresolvedProgrammes.length === 1 ? '' : 's'}
                <span className="text-sm font-normal text-ink-muted">({result.unresolvedProgrammes.filter((u) => programmeChoices[choiceKey(u.text)]).length} done)</span>
              </h2>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-muted">These don’t exactly match the programme list. Pick the right one once and it applies to every row with that wording.</p>
                {result.unresolvedProgrammes.some((u) => u.suggestions.length && !programmeChoices[choiceKey(u.text)]) && (
                  <button
                    type="button"
                    className="btn-outline btn-sm shrink-0"
                    onClick={() =>
                      setProgrammeChoices((c) => {
                        const next = { ...c }
                        for (const u of result.unresolvedProgrammes) {
                          const [best, second] = u.suggestions
                          // Only when one option is clearly ahead; ties ("Economics" with no degree) are left for staff.
                          if (best && !next[choiceKey(u.text)] && (!second || best.score - second.score >= 0.05)) next[choiceKey(u.text)] = best.item.id
                        }
                        return next
                      })
                    }
                  >
                    Fill in the closest matches
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">Check each one before importing; the closest match isn’t always right.</p>
              <ul className="mt-4 space-y-3">
                {result.unresolvedProgrammes.map((u) => (
                  <li key={u.text} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1.4fr] md:items-center">
                    <div>
                      <p className="font-medium">“{u.text}”</p>
                      <p className="text-xs text-ink-muted">{u.rows} row{u.rows === 1 ? '' : 's'}</p>
                    </div>
                    <ProgrammeSelect
                      reference={reference}
                      value={programmeChoices[choiceKey(u.text)] ?? ''}
                      suggested={u.suggestions.map((s) => s.item.id)}
                      emptyLabel={u.suggestions.length ? 'Choose the right programme' : 'No close match — choose one'}
                      onChange={(v) => setProgrammeChoices((c) => ({ ...c, [choiceKey(u.text)]: v }))}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.unresolvedClasses.length > 0 && (
            <div className="card p-5 sm:p-6">
              <h2 className="font-display text-base font-semibold text-navy">Confirm {result.unresolvedClasses.length} class name{result.unresolvedClasses.length === 1 ? '' : 's'}</h2>
              <ul className="mt-4 space-y-3">
                {result.unresolvedClasses.map((u) => (
                  <li key={u.text} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[1fr_1.4fr] md:items-center">
                    <div>
                      <p className="font-medium">“{u.text}”</p>
                      <p className="text-xs text-ink-muted">{u.rows} row{u.rows === 1 ? '' : 's'}</p>
                    </div>
                    <select
                      className="field-sm"
                      value={classChoices[choiceKey(u.text)] ?? 'unset'}
                      onChange={(e) => setClassChoices((c) => {
                        const next = { ...c }
                        if (e.target.value === 'unset') delete next[choiceKey(u.text)]
                        else next[choiceKey(u.text)] = e.target.value
                        return next
                      })}
                    >
                      <option value="unset">Choose…</option>
                      <option value="">Leave the class blank</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b border-line p-4">
              {([
                ['all', 'All rows', result.rows.length],
                ['create', 'New', result.counts.create],
                ['update', 'Updates', result.counts.update],
                ['skip', 'Skipped', result.counts.skip],
                ['reject', 'Problems', result.counts.reject],
              ] as const).map(([k, label, n]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setTab(k); setPage(0) }}
                  aria-pressed={tab === k}
                  className={clsx('rounded-full px-3 py-1.5 text-sm font-medium', tab === k ? 'bg-navy text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:text-navy')}
                >
                  {label} <span className="tabular-nums opacity-80">{n.toLocaleString('en-GB')}</span>
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-navy-50/60 text-left text-ink-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Row</th>
                    <th className="px-4 py-2.5 font-medium">Graduate</th>
                    <th className="px-4 py-2.5 font-medium">Programme</th>
                    <th className="px-4 py-2.5 font-medium">Class / CGPA</th>
                    <th className="px-4 py-2.5 font-medium">Session / Senate</th>
                    <th className="px-4 py-2.5 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(page * PAGE, (page + 1) * PAGE).map((r) => <ReviewRow key={r.row} r={r} />)}
                  {!shown.length && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">No rows here.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {shown.length > PAGE && (
              <div className="flex items-center justify-end gap-2 border-t border-line p-3 text-sm text-ink-muted">
                <button type="button" className="btn-outline btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page * PAGE + 1}–{Math.min(shown.length, (page + 1) * PAGE)} of {shown.length.toLocaleString('en-GB')}</span>
                <button type="button" className="btn-outline btn-sm" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </div>

          {commitError && <Notice tone="bad">{commitError}</Notice>}
          {ready > 10000 && <Notice tone="bad">There are {ready.toLocaleString('en-GB')} rows to import. Split the file so each upload has at most 10,000.</Notice>}

          <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-navy">
                {ready.toLocaleString('en-GB')} record{ready === 1 ? '' : 's'} ready as {source === 'live' ? 'Live' : 'Legacy'}, all saved as pending for approval.
              </p>
              <p className="text-ink-muted">
                {result.counts.reject + result.counts.skip > 0
                  ? `${(result.counts.reject + result.counts.skip).toLocaleString('en-GB')} row(s) will be left out and listed in the import report.`
                  : 'Every row in the file will be imported.'}
                {' '}The upload goes in all at once, or not at all.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-outline" onClick={() => setStep('columns')} disabled={committing}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
              <button type="button" className="btn-primary" onClick={commit} disabled={committing || checking || ready === 0 || ready > 10000}>
                {committing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                {committing ? 'Importing…' : `Import ${ready.toLocaleString('en-GB')}`}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function Tally({ label, value, tone }: { label: string; value: number; tone: 'good' | 'info' | 'neutral' | 'bad' }) {
  const color = { good: 'text-status-valid', info: 'text-[#1D4E89]', neutral: 'text-navy', bad: 'text-status-revoked' }[tone]
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={clsx('mt-1 font-display text-2xl font-semibold tabular-nums', color)}>{value.toLocaleString('en-GB')}</p>
    </div>
  )
}

const OUTCOME: Record<RowAction, { label: string; tone: 'good' | 'info' | 'neutral' | 'bad' }> = {
  create: { label: 'New', tone: 'good' },
  update: { label: 'Update', tone: 'info' },
  skip: { label: 'Skip', tone: 'neutral' },
  reject: { label: 'Problem', tone: 'bad' },
}

function ReviewRow({ r }: { r: BuiltRow }) {
  return (
    <tr className={clsx('border-t border-line align-top', r.action === 'reject' && 'bg-status-revoked-bg/40')}>
      <td className="px-4 py-2.5 tabular-nums text-ink-muted">{r.row}</td>
      <td className="px-4 py-2.5">
        <p className="font-medium">{r.full_name || <span className="text-ink-faint">No name</span>}</p>
        <p className="font-mono text-xs text-ink-muted">{r.reg_number || '—'}</p>
      </td>
      <td className="px-4 py-2.5">{r.programme_label || <span className="text-ink-faint">—</span>}</td>
      <td className="px-4 py-2.5">
        {r.class_label || <span className="text-ink-faint">—</span>}
        {r.cgpa != null && <span className="block text-xs tabular-nums text-ink-muted">{r.cgpa.toFixed(2)}</span>}
      </td>
      <td className="px-4 py-2.5">
        {r.graduation_session ?? <span className="text-ink-faint">—</span>}
        {r.senate_approval_date && <span className="block text-xs text-ink-muted">{r.senate_approval_date.split('-').reverse().join('/')}</span>}
      </td>
      <td className="px-4 py-2.5">
        <Badge tone={OUTCOME[r.action].tone}>{OUTCOME[r.action].label}</Badge>
        {r.problems.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-status-revoked">
            {r.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {r.note && <p className="mt-1 text-xs text-ink-muted">{r.note}</p>}
      </td>
    </tr>
  )
}

/** A programme picker grouped by faculty, with suggested matches first. */
function ProgrammeSelect({
  reference,
  value,
  onChange,
  suggested = [],
  emptyLabel,
}: {
  reference: Reference
  value: string
  onChange: (v: string) => void
  suggested?: string[]
  emptyLabel: string
}) {
  const groups = useMemo(() => {
    const dept = new Map(reference.departments.map((d) => [d.id, d]))
    return reference.faculties
      .map((f) => ({
        faculty: f.name,
        items: reference.programmes
          .filter((p) => p.active && dept.get(p.department_id)?.faculty_id === f.id)
          .sort((a, b) => `${a.name} ${a.award_title}`.localeCompare(`${b.name} ${b.award_title}`)),
      }))
      .filter((g) => g.items.length)
  }, [reference])
  const byId = useMemo(() => new Map(reference.programmes.map((p) => [p.id, p])), [reference.programmes])
  const label = (id: string) => {
    const p = byId.get(id)
    return p ? `${p.award_title} ${p.name} · ${LEVEL_LABEL[p.level]}` : id
  }
  return (
    <select className="field-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {suggested.length > 0 && (
        <optgroup label="Closest matches">
          {suggested.map((id) => <option key={`s-${id}`} value={id}>{label(id)}</option>)}
        </optgroup>
      )}
      {groups.map((g) => (
        <optgroup key={g.faculty} label={g.faculty}>
          {g.items.map((p) => <option key={p.id} value={p.id}>{p.award_title} {p.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}
