export type AwardLevel = 'undergraduate' | 'postgraduate'

/** Lifecycle status of an issued credential. Drafts and pending records never reach the public site. */
export type CredentialStatus = 'approved' | 'revoked' | 'superseded'

export interface Credential {
  id: string
  /** Unguessable code printed inside the QR link. */
  verifyCode: string
  /** Printed certificate serial, e.g. TSU/2025/000123 or TSU/PG/2025/000045. */
  serialNo: string
  surname: string
  otherNames: string
  matricNo: string
  faculty: string
  department: string
  programme: string
  /** Award title as printed, e.g. "Bachelor of Science (B.Sc.)". */
  award: string
  awardLevel: AwardLevel
  /** Class of degree for first degrees, or null where not applicable (most postgraduate awards). */
  classOfDegree: string | null
  /** Academic session of graduation, e.g. "2024/2025". */
  session: string
  /** Senate approval date, ISO yyyy-mm-dd. */
  dateOfAward: string
  status: CredentialStatus
  revokedAt?: string
  /** verifyCode of the credential that replaced this one. */
  supersededBy?: string
  /** Signing key that signed this credential's QR token. */
  keyId: string
  isSample?: boolean
}

/** The fields shown to an anonymous verifier — only what is printed on the certificate. */
export interface PublicCredential {
  verifyCode: string
  serialNo: string
  fullName: string
  matricNoMasked: string
  faculty: string
  department: string
  programme: string
  award: string
  awardLevel: AwardLevel
  classOfDegree: string | null
  session: string
  dateOfAward: string
  status: CredentialStatus
  revokedAt?: string
  supersededBy?: string
  isSample?: boolean
}

/** Compact claims carried inside the signed QR token. Short keys keep the QR code small. */
export interface CertificateClaims {
  /** serial number */
  s: string
  /** matric number */
  m: string
  /** full name as printed */
  n: string
  /** award + programme as printed */
  a: string
  /** class of degree, empty when not applicable */
  c: string
  /** date of award, yyyy-mm-dd */
  d: string
}

export type SignatureCheckResult =
  | { state: 'valid'; matchesRecord: boolean; verifyCode: string | null; keyId: string }
  | { state: 'invalid'; reason: string }
  | { state: 'unknown-key'; keyId: string }
