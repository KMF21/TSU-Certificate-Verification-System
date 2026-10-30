export type AppRole = 'admin' | 'records_officer' | 'viewer'
export type ProgrammeLevel = 'pgd' | 'masters' | 'phd' | 'undergraduate'
export type RecordStatus = 'pending' | 'approved'
export type RecordSource = 'live' | 'legacy'
export type VerificationState = 'verified' | 'unverified'

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  records_officer: 'Records Officer',
  viewer: 'Viewer',
}

export const ROLE_HELP: Record<AppRole, string> = {
  admin: 'Everything, including staff accounts, programmes, deleting records and undoing imports.',
  records_officer: 'Add, edit, upload, approve and verify records, and export lists.',
  viewer: 'Search records and export lists. Can’t change anything.',
}

export const LEVEL_LABEL: Record<ProgrammeLevel, string> = {
  pgd: 'PGD',
  masters: 'Masters',
  phd: 'PhD',
  undergraduate: 'Undergraduate',
}

export const STATUS_LABEL: Record<RecordStatus, string> = { pending: 'Pending', approved: 'Approved' }
export const SOURCE_LABEL: Record<RecordSource, string> = { live: 'Live', legacy: 'Legacy' }
export const VERIFICATION_LABEL: Record<VerificationState, string> = { verified: 'Verified', unverified: 'Unverified' }

export const canWrite = (role: AppRole) => role === 'admin' || role === 'records_officer'
export const isAdmin = (role: AppRole) => role === 'admin'

/** Sessions offered in pickers: the current one back to TSU's first graduating sets. */
export function sessionOptions(now = new Date()): string[] {
  const end = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
  const out: string[] = []
  for (let y = end; y >= 2010; y--) out.push(`${y - 1}/${y}`)
  return out
}

export function isValidSession(s: string): boolean {
  const m = s.match(/^(\d{4})\/(\d{4})$/)
  return !!m && Number(m[2]) === Number(m[1]) + 1
}
