/** Register fields a spreadsheet column can be mapped to. */
export type ImportField =
  | 'full_name'
  | 'surname'
  | 'other_names'
  | 'reg_number'
  | 'programme'
  | 'award'
  | 'cgpa'
  | 'class'
  | 'graduation_session'
  | 'senate_approval_date'
  | 'remark'

export const FIELD_LABEL: Record<ImportField, string> = {
  full_name: 'Full name',
  surname: 'Surname only',
  other_names: 'Other names only',
  reg_number: 'Registration number',
  programme: 'Programme',
  award: 'Degree / award (if separate)',
  cgpa: 'CGPA',
  class: 'Class of degree',
  graduation_session: 'Graduation session',
  senate_approval_date: 'Senate approval date',
  remark: 'Remark',
}

export const FIELD_ORDER: ImportField[] = [
  'full_name',
  'surname',
  'other_names',
  'reg_number',
  'programme',
  'award',
  'cgpa',
  'class',
  'graduation_session',
  'senate_approval_date',
  'remark',
]

/** Headings people actually use, normalised (lower case, letters and digits only). */
const SYNONYMS: Record<ImportField, string[]> = {
  full_name: ['fullname', 'name', 'names', 'nameofstudent', 'studentname', 'nameofcandidate', 'candidatename', 'nameofgraduate', 'graduatename', 'studentsname', 'fullnamesurnamefirst', 'nameinfull'],
  surname: ['surname', 'lastname', 'familyname'],
  other_names: ['othernames', 'othername', 'firstname', 'firstnames', 'givennames', 'forenames', 'firstandmiddlename', 'middlename'],
  reg_number: ['regnumber', 'regno', 'registrationnumber', 'registrationno', 'matricnumber', 'matricno', 'matriculationnumber', 'matno', 'studentid', 'regnos', 'regnum'],
  programme: ['programme', 'program', 'course', 'courseofstudy', 'programmeofstudy', 'programofstudy', 'degreeprogramme', 'specialization', 'specialisation', 'discipline', 'area', 'fieldofstudy'],
  award: ['degree', 'award', 'degreeawarded', 'awardtitle', 'qualification', 'certificate'],
  cgpa: ['cgpa', 'gpa', 'cumulativegpa', 'cumulativegradepointaverage', 'gradepoint', 'cgp'],
  class: ['class', 'classofdegree', 'degreeclass', 'grade', 'classification', 'classofaward', 'result'],
  graduation_session: ['session', 'graduationsession', 'academicsession', 'yearofgraduation', 'graduationyear', 'sessionofgraduation'],
  senate_approval_date: ['senateapprovaldate', 'senatedate', 'dateofsenateapproval', 'approvaldate', 'dateofapproval', 'senateapproval', 'dateapproved', 'dateofaward', 'datesenateapproved'],
  remark: ['remark', 'remarks', 'comment', 'comments', 'note', 'notes', 'status'],
}

export const headingKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Best field for a heading, or null. Exact synonyms first, then "contains" for longer headings. */
export function guessField(heading: string): ImportField | null {
  const k = headingKey(heading)
  if (!k) return null
  for (const f of FIELD_ORDER) if (SYNONYMS[f].includes(k)) return f
  // "Reg. No. of Student", "Programme (Course)", "CGPA (5.0 scale)"
  const contains: [ImportField, RegExp][] = [
    ['reg_number', /^(reg|matric|registration)/],
    ['cgpa', /cgpa|^gpa/],
    ['senate_approval_date', /senate/],
    ['graduation_session', /session/],
    ['surname', /^surname/],
    ['other_names', /^othername|^firstname/],
    ['full_name', /^name|fullname|studentname/],
    ['class', /^classof|degreeclass/],
    ['programme', /^programme|^program|^course/],
    ['remark', /^remark/],
  ]
  for (const [f, re] of contains) if (re.test(k)) return f
  return null
}

/** Suggests a mapping for all headings, using each field at most once. */
export function guessMapping(headings: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>()
  return headings.map((h) => {
    const f = guessField(h)
    if (!f || used.has(f)) return null
    used.add(f)
    return f
  })
}

/** Counts how many cells in a row look like known headings; used to find the heading row. */
export function headingScore(cells: string[]): number {
  return cells.filter((c) => c && guessField(c)).length
}
