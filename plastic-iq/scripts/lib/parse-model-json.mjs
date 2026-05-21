import { jsonrepair } from 'jsonrepair'

/**
 * Extract and parse a JSON object from Claude model text (fences, prose wrappers, minor syntax errors).
 */
export function extractJsonObject(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) throw new Error('Model response was empty')

  const candidates = []
  if (trimmed.startsWith('{')) candidates.push(trimmed)

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1].trim())

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1))
  }

  if (!candidates.length) {
    throw new Error('Model response did not contain JSON object')
  }

  const errors = []
  for (const raw of candidates) {
    for (const normalized of [raw, normalizeJsonText(raw)]) {
      try {
        return JSON.parse(normalized)
      } catch (e) {
        errors.push(e.message)
      }
      try {
        return JSON.parse(jsonrepair(normalized))
      } catch (e) {
        errors.push(`repair: ${e.message}`)
      }
    }
  }

  throw new Error(
    `Could not parse model JSON (${errors[0] ?? 'unknown'}${errors.length > 1 ? `; also ${errors.length - 1} other attempts` : ''})`,
  )
}

function normalizeJsonText(s) {
  return s
    .replace(/\u201c|\u201d|\u00ab|\u00bb/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
}

export function isJsonParseError(err) {
  if (err instanceof SyntaxError) return true
  const msg = String(err?.message ?? err)
  return /JSON|did not contain JSON|Could not parse model JSON/i.test(msg)
}
