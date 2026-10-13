export type AppRole = 'records_officer' | 'cpgs_records_officer' | 'registrar' | 'auditor' | 'super_admin'
export type AwardLevel = 'undergraduate' | 'postgraduate'
export type BatchStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type CredentialStatus = 'draft' | 'pending' | 'approved' | 'revoked' | 'superseded'

export const ROLE_LABEL: Record<AppRole, string> = {
  records_officer: 'Records Officer (Exams & Records)',
  cpgs_records_officer: 'Records Officer (CPGS)',
  registrar: 'Registrar',
  auditor: 'Auditor',
  super_admin: 'Super Admin',
}

export const ROLE_SHORT: Record<AppRole, string> = {
  records_officer: 'Records Officer',
  cpgs_records_officer: 'CPGS Records Officer',
  registrar: 'Registrar',
  auditor: 'Auditor',
  super_admin: 'Super Admin',
}

export const LEVEL_LABEL: Record<AwardLevel, string> = { undergraduate: 'Undergraduate', postgraduate: 'Postgraduate' }

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'Draft',
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Returned for changes',
}

export const CREDENTIAL_STATUS_LABEL: Record<CredentialStatus, string> = {
  draft: 'Draft',
  pending: 'Awaiting approval',
  approved: 'Issued',
  revoked: 'Revoked',
  superseded: 'Replaced',
}

/** Which award level a role prepares, if any. */
export function editableLevel(role: AppRole): AwardLevel | null {
  if (role === 'records_officer') return 'undergraduate'
  if (role === 'cpgs_records_officer') return 'postgraduate'
  return null
}

export const canSeeAudit = (role: AppRole) => role === 'registrar' || role === 'auditor' || role === 'super_admin'
export const canManageUsers = (role: AppRole) => role === 'super_admin'
export const canManageReference = (role: AppRole) => role === 'super_admin'
export const canDecide = (role: AppRole) => role === 'registrar'

export const DEGREE_CLASSES = [
  'First Class Honours',
  'Second Class Honours (Upper Division)',
  'Second Class Honours (Lower Division)',
  'Third Class Honours',
  'Pass',
] as const

export const POSTGRADUATE_GRADES = ['Distinction', 'Merit', 'Pass'] as const
