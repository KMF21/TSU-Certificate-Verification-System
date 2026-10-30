/**
 * Closest-match lookup for programmes and degree classes, so spreadsheets with
 * slightly different wording ("Msc Computer Sci", "COMPUTER SCIENCE (M.SC)")
 * still find the right entry, and anything uncertain is shown to staff to confirm.
 */

export interface ProgrammeRef {
  id: string
  code: string
  name: string
  award_title: string
  level: string
  department_name?: string
}

export interface ClassRef {
  id: string
  label: string
  level: string | null
}

// Award abbreviations, longest first so "M.Phil" isn't read as "M".
const AWARDS: [string, RegExp][] = [
  ['pgde', /\b(pgde|post ?graduate diploma in education)\b/],
  ['pgd', /\b(pgd|p g d|post ?graduate diploma|postgraduate diploma)\b/],
  ['mphil', /\b(m ?phil|master of philosophy)\b/],
  ['phd', /\b(ph ?d|doctor of philosophy|doctorate)\b/],
  ['mba', /\b(mba|master of business administration)\b/],
  ['mpa', /\b(mpa|master of public administration)\b/],
  ['mph', /\b(mph|master of public health)\b/],
  ['llm', /\b(ll ?m|master of laws)\b/],
  ['med', /\b(m ?ed|master of education)\b/],
  ['msc', /\b(m ?sc|master of science)\b/],
  ['ma', /\b(m ?a|master of arts)\b/],
  ['mtech', /\b(m ?tech|master of technology)\b/],
  ['meng', /\b(m ?eng|master of engineering)\b/],
]

const STOP = new Set(['in', 'of', 'and', 'the', 'with', 'option', 'degree', 'programme', 'program', 'department'])

/** Lower case, punctuation to spaces, "&" to "and". */
export const flat = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.()[\],/\-–:'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Splits "M.Sc. Computer Science" into award "msc" and the subject words. */
export function splitAward(text: string): { award: string | null; words: string[] } {
  let t = ` ${flat(text)} `
  let award: string | null = null
  for (const [key, re] of AWARDS) {
    if (re.test(t)) {
      award = key
      t = t.replace(re, ' ')
      break
    }
  }
  const words = t
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map((w) => w.replace(/s$/, '')) // "studies" ~ "studie", "sciences" ~ "science"
  return { award, words }
}

/** Small spelling slips: "counseling" ~ "counselling". */
function closeSpelling(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 6) return false
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length] <= 2
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const A = new Set(a)
  const B = new Set(b)
  let hit = 0
  for (const w of A) {
    if (B.has(w)) hit += 1
    else if ([...B].some((x) => closeSpelling(w, x))) hit += 0.95
    else if ([...B].some((x) => (x.length >= 4 && w.length >= 4 && (x.startsWith(w) || w.startsWith(x))))) hit += 0.8
  }
  return (2 * hit) / (A.size + B.size)
}

export interface Suggestion<T> {
  item: T
  score: number
}

export interface ProgrammeIndex {
  find(text: string, awardText?: string): { match: ProgrammeRef | null; suggestions: Suggestion<ProgrammeRef>[] }
}

export function programmeIndex(programmes: ProgrammeRef[]): ProgrammeIndex {
  const entries = programmes.map((p) => {
    const a = splitAward(p.award_title)
    const n = splitAward(p.name)
    return { p, award: a.award, words: n.words, code: p.code.toLowerCase(), exact: flat(`${p.award_title} ${p.name}`) }
  })
  return {
    find(text, awardText) {
      const raw = `${awardText ?? ''} ${text}`.trim()
      if (!raw) return { match: null, suggestions: [] }
      const byCode = entries.find((e) => e.code === raw.toLowerCase())
      if (byCode) return { match: byCode.p, suggestions: [{ item: byCode.p, score: 1 }] }
      const { award, words } = splitAward(raw)
      const scored = entries
        .map((e) => {
          let s = similarity(words, e.words)
          if (award && e.award) s = award === e.award ? s + 0.15 : s - 0.5
          if (flat(raw) === e.exact) s = 2
          return { item: e.p, score: s }
        })
        .filter((x) => x.score > 0.35)
        .sort((x, y) => y.score - x.score)
        .slice(0, 5)
      const [best, next] = scored
      // Confident only when it's (near) exact on words, the award agrees, and nothing else is close.
      const sure =
        best &&
        best.score >= (award ? 1.1 : 1) &&
        (!next || best.score - next.score >= 0.1)
      return { match: sure ? best.item : null, suggestions: scored }
    },
  }
}

const CLASS_ALIASES: Record<string, string> = {
  dist: 'distinction',
  distinction: 'distinction',
  merit: 'merit',
  credit: 'credit',
  pass: 'pass',
  p: 'pass',
}

export function findClass(text: string, classes: ClassRef[], level?: string): { match: ClassRef | null; suggestions: ClassRef[] } {
  const t = flat(text)
  if (!t) return { match: null, suggestions: [] }
  const usable = classes.filter((c) => !c.level || !level || c.level === level)
  const key = CLASS_ALIASES[t] ?? t
  const exact = usable.find((c) => flat(c.label) === key)
  if (exact) return { match: exact, suggestions: [exact] }
  const starts = usable.filter((c) => flat(c.label).startsWith(key) || key.startsWith(flat(c.label)))
  if (starts.length === 1) return { match: starts[0], suggestions: starts }
  return { match: null, suggestions: starts.length ? starts : usable }
}
