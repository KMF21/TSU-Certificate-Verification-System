import clsx from 'clsx'
import { SOURCE_LABEL, type RecordSource, type RecordStatus, type VerificationState } from '@/lib/admin/roles'

const TONES = {
  neutral: 'bg-navy-50 text-navy',
  info: 'bg-[#EAF1FB] text-[#1D4E89]',
  good: 'bg-status-valid-bg text-status-valid',
  warn: 'bg-status-superseded-bg text-status-superseded',
  bad: 'bg-status-revoked-bg text-status-revoked',
} as const

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>
      {children}
    </span>
  )
}

/** One badge that sums up where a record stands. */
export function RecordBadge({ status, source, verification }: { status: RecordStatus; source: RecordSource; verification: VerificationState }) {
  if (status === 'pending') return <Badge tone="info">Pending</Badge>
  if (source === 'legacy' && verification === 'unverified') return <Badge tone="warn">Approved · unverified</Badge>
  return <Badge tone="good">Approved</Badge>
}

export const SourceBadge = ({ source }: { source: RecordSource }) => (
  <Badge tone={source === 'legacy' ? 'neutral' : 'info'}>{SOURCE_LABEL[source]}</Badge>
)

export const SampleBadge = () => <Badge tone="warn">Sample</Badge>

export function PageHeader({ title, intro, actions }: { title: string; intro?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
        {intro && <div className="mt-1.5 max-w-2xl text-ink-muted">{intro}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Notice({ tone, children }: { tone: 'good' | 'bad' | 'warn' | 'info'; children: React.ReactNode }) {
  const styles = {
    good: 'border-status-valid/20 bg-status-valid-bg text-status-valid',
    bad: 'border-status-revoked/20 bg-status-revoked-bg text-status-revoked',
    warn: 'border-status-superseded/20 bg-status-superseded-bg text-status-superseded',
    info: 'border-navy/10 bg-navy-50 text-navy',
  }[tone]
  return <div role={tone === 'bad' ? 'alert' : 'status'} className={clsx('rounded-lg border px-4 py-3 text-sm leading-relaxed', styles)}>{children}</div>
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-display font-semibold text-navy">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
    </div>
  )
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(iso))
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
}
