'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import type { DegreeClass, Reference } from '@/lib/admin/reference'
import { LEVEL_LABEL, type ProgrammeLevel } from '@/lib/admin/roles'
import { saveClassAction, setProgrammeActiveAction } from '@/app/admin/(staff)/reference/actions'
import { Badge, Notice } from './ui'

export function ProgrammeList({ reference, admin }: { reference: Reference; admin: boolean }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [faculty, setFaculty] = useState('')
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    return reference.faculties
      .filter((f) => !faculty || f.id === faculty)
      .map((f) => ({
        faculty: f,
        departments: reference.departments
          .filter((d) => d.faculty_id === f.id)
          .map((d) => ({
            department: d,
            programmes: reference.programmes.filter(
              (p) => p.department_id === d.id && (!term || `${p.award_title} ${p.name} ${p.code} ${d.name}`.toLowerCase().includes(term)),
            ),
          }))
          .filter((d) => d.programmes.length),
      }))
      .filter((g) => g.departments.length)
  }, [reference, q, faculty])
  const shown = groups.reduce((n, g) => n + g.departments.reduce((m, d) => m + d.programmes.length, 0), 0)

  return (
    <section className="card min-w-0 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <h2 className="flex-1 whitespace-nowrap font-display text-lg font-semibold text-navy">Programmes <span className="text-sm font-normal text-ink-muted">({shown})</span></h2>
        <label className="relative sm:w-64">
          <span className="sr-only">Search programmes</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input className="field-sm pl-9" placeholder="Search programmes" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field-sm sm:w-56" value={faculty} onChange={(e) => setFaculty(e.target.value)} aria-label="Faculty">
          <option value="">All faculties</option>
          {reference.faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      {message && <div className="mt-4"><Notice tone={message.tone}>{message.text}</Notice></div>}
      <div className="mt-5 space-y-6">
        {groups.map((g) => (
          <div key={g.faculty.id}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-crimson">{g.faculty.name}</h3>
            {g.departments.map((d) => (
              <div key={d.department.id} className="mt-3">
                <h4 className="text-sm font-semibold text-navy">{d.department.name}</h4>
                <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                  {d.programmes.map((p) => (
                    <li key={p.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm ${p.active ? '' : 'bg-canvas text-ink-faint'}`}>
                      <span className="min-w-0 flex-1">{p.award_title} {p.name}</span>
                      <span className="font-mono text-xs text-ink-muted">{p.code}</span>
                      <Badge tone="neutral">{LEVEL_LABEL[p.level]}</Badge>
                      {!p.active && <Badge tone="warn">Hidden</Badge>}
                      {admin && (
                        <button
                          type="button"
                          disabled={pending}
                          className="text-xs font-medium text-navy hover:underline"
                          onClick={() =>
                            start(async () => {
                              const res = await setProgrammeActiveAction({ id: p.id, active: !p.active })
                              setMessage(res.error ? { tone: 'bad', text: res.error } : { tone: 'good', text: res.ok! })
                              router.refresh()
                            })
                          }
                        >
                          {p.active ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        {!groups.length && <p className="text-sm text-ink-muted">No programmes match.</p>}
      </div>
    </section>
  )
}

export function ClassesEditor({ classes, admin }: { classes: DegreeClass[]; admin: boolean }) {
  const [adding, setAdding] = useState(false)
  return (
    <section className="card h-fit min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-navy">Degree classes</h2>
        {admin && !adding && (
          <button type="button" className="btn-outline btn-sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-muted">Classes with a level only appear for programmes at that level.</p>
      <ul className="mt-4 space-y-2">
        {adding && <ClassRow admin onDone={() => setAdding(false)} />}
        {classes.map((c) => <ClassRow key={c.id} cls={c} admin={admin} />)}
      </ul>
    </section>
  )
}

function ClassRow({ cls, admin, onDone }: { cls?: DegreeClass; admin: boolean; onDone?: () => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!cls)
  const [label, setLabel] = useState(cls?.label ?? '')
  const [level, setLevel] = useState<string>(cls?.level ?? '')
  const [order, setOrder] = useState(String(cls?.sort_order ?? 100))
  const [active, setActive] = useState(cls?.active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!editing && cls) {
    return (
      <li className={`flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm ${cls.active ? '' : 'bg-canvas text-ink-faint'}`}>
        <span className="flex-1">{cls.label}</span>
        <span className="text-xs text-ink-muted">{cls.level ? LEVEL_LABEL[cls.level] : 'All levels'}</span>
        {!cls.active && <Badge tone="warn">Hidden</Badge>}
        {admin && <button type="button" className="text-xs font-medium text-navy hover:underline" onClick={() => setEditing(true)}>Edit</button>}
      </li>
    )
  }
  return (
    <li className="rounded-lg border border-navy/20 bg-navy-50/40 p-3">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const res = await saveClassAction({ id: cls?.id, label, level, sort_order: order, active })
            if (res.error) return setError(res.error)
            setError(null)
            setEditing(false)
            onDone?.()
            router.refresh()
          })
        }}
      >
        <label className="block">
          <span className="label">Class</span>
          <input className="field-sm" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Distinction" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Level</span>
            <select className="field-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {(Object.keys(LEVEL_LABEL) as ProgrammeLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Order</span>
            <input className="field-sm" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-navy" /> Show in pickers
        </label>
        {error && <Notice tone="bad">{error}</Notice>}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary btn-sm" disabled={pending}>Save</button>
          <button type="button" className="btn-outline btn-sm" onClick={() => { setEditing(false); onDone?.() }}>Cancel</button>
        </div>
      </form>
    </li>
  )
}
