'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import type { Reference } from '@/lib/admin/reference'
import { LEVEL_LABEL } from '@/lib/admin/roles'
import { lagosToday, normaliseReg, validateRecord, type FieldErrors, type RecordInput } from '@/lib/admin/record-input'
import { checkRegAction, saveRecordAction } from '@/app/admin/(staff)/records/actions'
import { Notice } from './ui'

const EMPTY: RecordInput = {
  full_name: '',
  reg_number: '',
  programme_id: '',
  cgpa: '',
  class_id: '',
  remark: '',
  graduation_session: '',
  senate_approval_date: '',
  source: 'live',
}

export function RecordForm({
  reference,
  sessions,
  recordId,
  initial,
  approved = false,
}: {
  reference: Reference
  sessions: string[]
  recordId?: string
  initial?: RecordInput
  approved?: boolean
}) {
  const router = useRouter()
  const editing = !!recordId
  const startProgramme = reference.programmes.find((p) => p.id === initial?.programme_id)
  const startDepartment = reference.departments.find((d) => d.id === startProgramme?.department_id)

  const [form, setForm] = useState<RecordInput>(initial ?? EMPTY)
  const [faculty, setFaculty] = useState(startDepartment?.faculty_id ?? '')
  const [department, setDepartment] = useState(startDepartment?.id ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [regTaken, setRegTaken] = useState<{ id: string; full_name: string } | null>(null)
  const [checkingReg, setCheckingReg] = useState(false)
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [added, setAdded] = useState<{ id: string; label: string }[]>([])
  const [pending, start] = useTransition()
  const nameRef = useRef<HTMLInputElement>(null)
  const today = lagosToday()

  const set = <K extends keyof RecordInput>(k: K, v: RecordInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const faculties = reference.faculties.filter((f) => f.active || f.id === faculty)
  const departments = useMemo(
    () => reference.departments.filter((d) => d.faculty_id === faculty && (d.active || d.id === department)),
    [reference.departments, faculty, department],
  )
  const programmes = useMemo(
    () => reference.programmes.filter((p) => p.department_id === department && (p.active || p.id === form.programme_id)),
    [reference.programmes, department, form.programme_id],
  )
  const programme = reference.programmes.find((p) => p.id === form.programme_id)
  const classes = reference.classes.filter(
    (c) => (c.active || c.id === form.class_id) && (!c.level || !programme || c.level === programme.level),
  )

  // If the programme's level rules out the chosen class, clear it.
  useEffect(() => {
    if (form.class_id && !classes.some((c) => c.id === form.class_id)) setForm((f) => ({ ...f, class_id: '' }))
  }, [classes, form.class_id])

  // Check the registration number shortly after typing stops.
  useEffect(() => {
    const reg = normaliseReg(form.reg_number)
    if (reg.length < 3 || (editing && reg === normaliseReg(initial?.reg_number ?? ''))) {
      setRegTaken(null)
      return
    }
    setCheckingReg(true)
    const t = setTimeout(async () => {
      const { taken } = await checkRegAction(reg, recordId)
      setRegTaken(taken)
      setCheckingReg(false)
    }, 400)
    return () => clearTimeout(t)
  }, [form.reg_number, editing, initial?.reg_number, recordId])

  const submit = (another: boolean) => {
    const local = validateRecord(form, today)
    const errs = { ...local.errors }
    if (regTaken) errs.reg_number = `Already in the register for ${regTaken.full_name}.`
    if (Object.keys(errs).length) {
      setErrors(errs)
      setNotice({ tone: 'bad', text: 'Check the highlighted fields.' })
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (approved && reason.trim().length < 5) {
      setNotice({ tone: 'bad', text: 'Give a reason for changing an approved record (at least 5 characters).' })
      document.getElementById('change-reason')?.focus()
      return
    }
    start(async () => {
      const res = await saveRecordAction({ id: recordId, record: form, reason })
      if (res.errors && Object.keys(res.errors).length) setErrors(res.errors)
      if (!res.ok) {
        setNotice({ tone: 'bad', text: res.error ?? 'Check the highlighted fields.' })
        return
      }
      if (editing) {
        router.push(`/admin/records/${recordId}?saved=1`)
        router.refresh()
        return
      }
      if (another) {
        // Keep the shared values so the next graduate of the same programme is quick to enter.
        setForm((f) => ({ ...EMPTY, programme_id: f.programme_id, graduation_session: f.graduation_session, senate_approval_date: f.senate_approval_date, source: f.source }))
        setAdded((a) => [{ id: res.id!, label: `${form.full_name.trim()} · ${normaliseReg(form.reg_number)}` }, ...a].slice(0, 20))
        setNotice({ tone: 'good', text: res.message ?? 'Saved.' })
        setRegTaken(null)
        nameRef.current?.focus()
      } else {
        router.push(`/admin/records/${res.id}?saved=1`)
      }
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <form
        className="card p-5 sm:p-7"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit(!editing)
        }}
      >
        {approved && (
          <div className="mb-6">
            <Notice tone="warn">
              This record is approved. Changes are allowed, but you must give a reason, and the old and new values are kept in the record’s history.
            </Notice>
          </div>
        )}

        <fieldset>
          <legend className="font-display text-base font-semibold text-navy">Programme</legend>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Faculty" error={undefined}>
              <select
                className="field-sm"
                value={faculty}
                onChange={(e) => { setFaculty(e.target.value); setDepartment(''); set('programme_id', '') }}
              >
                <option value="">Choose a faculty</option>
                {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select
                className="field-sm"
                value={department}
                disabled={!faculty}
                onChange={(e) => { setDepartment(e.target.value); set('programme_id', '') }}
              >
                <option value="">{faculty ? 'Choose a department' : 'Choose a faculty first'}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Programme" error={errors.programme_id} id="programme_id">
              <select
                id="programme_id"
                className="field-sm"
                value={form.programme_id}
                disabled={!department}
                aria-invalid={!!errors.programme_id}
                onChange={(e) => set('programme_id', e.target.value)}
              >
                <option value="">{department ? 'Choose a programme' : 'Choose a department first'}</option>
                {programmes.map((p) => <option key={p.id} value={p.id}>{p.award_title} {p.name}</option>)}
              </select>
            </Field>
          </div>
          {programme && (
            <p className="mt-2 text-xs text-ink-muted">
              {LEVEL_LABEL[programme.level]} · {programme.award_title} · code {programme.code}
              {programme.is_sample && ' · sample programme list, awaiting CPGS confirmation'}
            </p>
          )}
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-6">
          <legend className="sr-only">Graduate</legend>
          <p className="font-display text-base font-semibold text-navy">Graduate</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Field label="Full name (surname first)" error={errors.full_name} id="full_name">
              <input
                id="full_name"
                ref={nameRef}
                className="field-sm"
                value={form.full_name}
                autoComplete="off"
                placeholder="e.g. BAKO Ruth Adi"
                aria-invalid={!!errors.full_name}
                onChange={(e) => set('full_name', e.target.value)}
              />
            </Field>
            <Field
              label="Registration number"
              error={errors.reg_number ?? (regTaken ? `Already in the register for ${regTaken.full_name}.` : undefined)}
              id="reg_number"
              extra={
                regTaken ? (
                  <Link href={`/admin/records/${regTaken.id}`} className="text-xs text-navy underline">Open that record</Link>
                ) : checkingReg ? (
                  <span className="flex items-center gap-1 text-xs text-ink-faint"><Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking</span>
                ) : form.reg_number.trim().length >= 3 && !errors.reg_number ? (
                  <span className="flex items-center gap-1 text-xs text-status-valid"><CheckCircle2 className="h-3 w-3" aria-hidden /> Not yet in the register</span>
                ) : null
              }
            >
              <input
                id="reg_number"
                className="field-sm font-mono uppercase placeholder:font-sans placeholder:normal-case"
                value={form.reg_number}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. TSU/PG/22/CS/0001"
                aria-invalid={!!errors.reg_number || !!regTaken}
                onChange={(e) => set('reg_number', e.target.value)}
              />
            </Field>
            <Field label="CGPA (optional)" error={errors.cgpa} id="cgpa" hint="0.00 to 5.00">
              <input
                id="cgpa"
                className="field-sm tabular-nums"
                inputMode="decimal"
                value={form.cgpa}
                autoComplete="off"
                placeholder="e.g. 4.25"
                aria-invalid={!!errors.cgpa}
                onChange={(e) => set('cgpa', e.target.value)}
                onBlur={() => setErrors((er) => ({ ...er, cgpa: validateRecord(form, today).errors.cgpa }))}
              />
            </Field>
            <Field label="Class of degree (optional)" error={errors.class_id} id="class_id">
              <select id="class_id" className="field-sm" value={form.class_id} onChange={(e) => set('class_id', e.target.value)}>
                <option value="">Not stated</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Remark (optional)" error={errors.remark} id="remark" className="md:col-span-2">
              <input id="remark" className="field-sm" value={form.remark} maxLength={500} onChange={(e) => set('remark', e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-6">
          <legend className="sr-only">Graduation</legend>
          <p className="font-display text-base font-semibold text-navy">Graduation</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field label="Graduation session" error={errors.graduation_session} id="graduation_session" hint="Needed before approval">
              <select id="graduation_session" className="field-sm" value={form.graduation_session} onChange={(e) => set('graduation_session', e.target.value)}>
                <option value="">Not yet known</option>
                {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Senate approval date" error={errors.senate_approval_date} id="senate_approval_date" hint="Can also be set when approving">
              <input
                id="senate_approval_date"
                type="date"
                className="field-sm"
                max={today}
                min="2008-01-01"
                value={form.senate_approval_date}
                aria-invalid={!!errors.senate_approval_date}
                onChange={(e) => set('senate_approval_date', e.target.value)}
              />
            </Field>
            <Field label="Source" id="source" hint={editing ? 'Can’t be changed after entry' : 'Legacy = from older records'}>
              <select id="source" className="field-sm" value={form.source} disabled={editing} onChange={(e) => set('source', e.target.value as 'live' | 'legacy')}>
                <option value="live">Live (current graduation)</option>
                <option value="legacy">Legacy (older record)</option>
              </select>
            </Field>
          </div>
        </fieldset>

        {approved && (
          <div className="mt-7 border-t border-line pt-6">
            <Field label="Reason for this change" id="change-reason" hint="Kept permanently in the record’s history">
              <textarea id="change-reason" rows={2} className="field-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Name spelling corrected per Senate list of 12 June 2024" />
            </Field>
          </div>
        )}

        {notice && (
          <div className="mt-6">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3 border-t border-line pt-6">
          {editing ? (
            <>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save changes
              </button>
              <Link href={`/admin/records/${recordId}`} className="btn-outline">Cancel</Link>
            </>
          ) : (
            <>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save &amp; add another
              </button>
              <button type="button" className="btn-outline" disabled={pending} onClick={() => submit(false)}>Save and open</button>
            </>
          )}
        </div>
        {!editing && (
          <p className="mt-3 text-xs text-ink-muted">
            “Save &amp; add another” keeps the programme, session, Senate date and source, and clears the graduate’s details. New records are saved as pending until another officer approves them.
          </p>
        )}
      </form>

      {!editing && (
        <aside className="card h-fit p-5" aria-live="polite">
          <h2 className="font-display text-sm font-semibold text-navy">Added in this sitting</h2>
          {added.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Records you save here will be listed so you can check them.</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {added.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/records/${a.id}`} className="text-navy underline-offset-2 hover:underline">{a.label}</Link>
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}
    </div>
  )
}

function Field({
  label,
  error,
  hint,
  id,
  extra,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  id?: string
  extra?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label">{label}</label>
        {extra}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs text-status-revoked" id={id ? `${id}-error` : undefined}>
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  )
}
