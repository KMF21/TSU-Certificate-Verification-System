'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal } from 'lucide-react'
import { LEVEL_LABEL, type ProgrammeLevel } from '@/lib/admin/roles'
import { activeFilterCount, type RegisterFilters } from '@/lib/admin/register-query'
import type { Reference } from '@/lib/admin/reference'

/** Filters as a plain GET form, so they live in the URL and survive reloads and sharing. */
export function RecordFilters({
  filters,
  sort,
  reference,
  sessions,
  action = '/admin/records',
}: {
  filters: RegisterFilters
  sort?: string
  reference: Reference
  sessions: string[]
  action?: string
}) {
  const [faculty, setFaculty] = useState(filters.faculty ?? '')
  const [department, setDepartment] = useState(filters.department ?? '')
  const [programme, setProgramme] = useState(filters.programme ?? '')
  const [open, setOpen] = useState(activeFilterCount(filters) > 0)

  const departments = useMemo(
    () => reference.departments.filter((d) => !faculty || d.faculty_id === faculty),
    [reference.departments, faculty],
  )
  const programmes = useMemo(() => {
    const deptIds = new Set(departments.map((d) => d.id))
    return reference.programmes.filter((p) => (department ? p.department_id === department : deptIds.has(p.department_id)))
  }, [reference.programmes, departments, department])

  const count = activeFilterCount(filters)
  const chosenSessions = new Set(filters.sessions ?? [])

  return (
    <form
      method="get"
      action={action}
      className="card p-4 sm:p-5"
      role="search"
      onSubmit={(e) => {
        // Keep the URL short: leave out filters that aren't set.
        const emptied: (HTMLInputElement | HTMLSelectElement)[] = []
        for (const el of Array.from(e.currentTarget.elements)) {
          if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name && el.value === '') {
            el.disabled = true
            emptied.push(el)
          }
        }
        setTimeout(() => emptied.forEach((el) => (el.disabled = false)), 0)
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search by name or registration number</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input name="q" defaultValue={filters.q} placeholder="Search by name or registration number" className="field-sm pl-9" />
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn-outline btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters{count ? ` (${count})` : ''}
          </button>
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </div>
      </div>

      <div hidden={!open} className="mt-4 border-t border-line pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Faculty" name="faculty" value={faculty} onChange={(v) => { setFaculty(v); setDepartment(''); setProgramme('') }}>
            <option value="">All faculties</option>
            {reference.faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
          <Select label="Department" name="department" value={department} onChange={(v) => { setDepartment(v); setProgramme('') }}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select label="Programme" name="programme" value={programme} onChange={setProgramme}>
            <option value="">All programmes</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.award_title} {p.name}</option>)}
          </Select>
          <Select label="Level" name="level" defaultValue={filters.level ?? ''}>
            <option value="">All levels</option>
            {(Object.keys(LEVEL_LABEL) as ProgrammeLevel[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </Select>
          <Select label="Status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </Select>
          <Select label="Source" name="source" defaultValue={filters.source ?? ''}>
            <option value="">Live and legacy</option>
            <option value="live">Live</option>
            <option value="legacy">Legacy</option>
          </Select>
          <Select label="Verification" name="verification" defaultValue={filters.verification ?? ''}>
            <option value="">Any</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </Select>
          <label className="block">
            <span className="label">Senate approval from</span>
            <input type="date" name="from" defaultValue={filters.from} className="field-sm" />
          </label>
          <label className="block">
            <span className="label">Senate approval to</span>
            <input type="date" name="to" defaultValue={filters.to} className="field-sm" />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="label">Graduation session</legend>
          <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
            {sessions.map((s) => (
              <label key={s} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy-50">
                <input type="checkbox" name="session" value={s} defaultChecked={chosenSessions.has(s)} className="accent-navy" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          {sort !== undefined ? (
            <Select label="Sort by" name="sort" defaultValue={sort === 'updated' ? '' : sort} className="w-56">
              <option value="">Recently changed</option>
              <option value="name">Name (A–Z)</option>
              <option value="reg">Registration number</option>
              <option value="date">Senate approval date</option>
            </Select>
          ) : <span />}
          <div className="flex gap-2">
            <Link href={action} className="btn-outline btn-sm">Clear all</Link>
            <button type="submit" className="btn-primary btn-sm">Apply filters</button>
          </div>
        </div>
      </div>
      {filters.batch && <input type="hidden" name="batch" value={filters.batch} />}
    </form>
  )
}

function Select({
  label,
  name,
  value,
  defaultValue,
  onChange,
  children,
  className,
}: {
  label: string
  name: string
  value?: string
  defaultValue?: string
  onChange?: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="label">{label}</span>
      <select
        name={name}
        className="field-sm"
        {...(onChange ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue })}
      >
        {children}
      </select>
    </label>
  )
}
