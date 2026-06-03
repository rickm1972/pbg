/**
 * Product description copy — preserve acronyms and proper nouns in prose.
 */

/** Canonical casing (longest matched first per token). */
export const PRESERVED_CASE_TERMS = [
  'MADE SAFE',
  'OEKO-TEX',
  'OEKO TEX',
  'PTFE',
  'PFAS',
  'PFOA',
  'PFOS',
  'PVC',
  'HDPE',
  'LDPE',
  'PET',
  'BPA',
  'BPS',
  'BPF',
  'NSF',
  'EWG',
  'GOTS',
  'Teflon',
]

const PRESERVED_BY_LOWER = new Map(
  PRESERVED_CASE_TERMS.map((term) => [term.toLowerCase(), term]),
)

const PRESERVED_SORTED = [...PRESERVED_CASE_TERMS].sort((a, b) => b.length - a.length)

/**
 * Map a single token (letters/digits/hyphens) to canonical acronym casing if known.
 * @param {string} token
 */
function canonicalToken(token) {
  const bare = token.replace(/[^A-Za-z0-9-]/g, '')
  if (!bare) return token
  const hit = PRESERVED_BY_LOWER.get(bare.toLowerCase())
  if (hit) return token.replace(bare, hit)
  return token.toLowerCase()
}

/**
 * Lowercase description prose word-by-word; acronyms stay canonical (PTFE, PFAS, …).
 * Avoids "lowercase everything then regex" — that missed PTFE in some Node/V8 paths.
 * @param {string} text
 */
export function formatDescriptionText(text) {
  const s = String(text ?? '').trim()
  if (!s) return s

  return s
    .split(/(\s+|(?=[(),;])|(?<=[(),;]))/g)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || /^[(),;]$/.test(part)) return part
      return canonicalToken(part)
    })
    .join('')
}

/**
 * Phrase-level pass for multi-word preserved terms (MADE SAFE, OEKO-TEX).
 * @param {string} text
 */
export function formatDescriptionPhrase(text) {
  let out = formatDescriptionText(text)
  for (const term of PRESERVED_SORTED) {
    if (!/\s|-/.test(term)) continue
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const flexible = escaped.replace(/\s+/g, '[\\s-]+')
    out = out.replace(new RegExp(flexible, 'gi'), term)
  }
  return out
}
