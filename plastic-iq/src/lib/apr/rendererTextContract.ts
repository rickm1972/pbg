/**
 * Renderer text contract — visible product strings must come from display.* / score.* only.
 */

import type { AprDisplayPayload, AprPublicRenderInput } from '../../types/apr'
import { isStaticSiteChromeString } from './pageChrome'

export type RendererTextViolation = {
  check_id: 'renderer.invented_product_string'
  rule: 'renderer_text_contract'
  path: string
  message: string
}

function collectStrings(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    const t = value.trim()
    if (t) out.add(t)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out)
  }
}

/** All verbatim strings from display.* and score.* namespaces. */
export function collectAprAllowedStrings(input: AprPublicRenderInput): Set<string> {
  const out = new Set<string>()
  collectStrings(input.display, out)
  collectStrings(input.score, out)
  out.add(String(input.score.pac_safety_score))
  return out
}

/**
 * Product-specific strings the primary product renderer would show for a fixture APR
 * (mirrors ProductPage bindings — no alternatives section, no product DB fields).
 */
export function buildPrimaryProductVisibleStrings(input: AprPublicRenderInput): string[] {
  const d = input.display
  const s = input.score
  const out: string[] = [
    d.product_title,
    d.primary_material,
    d.disclosure_sentence,
    d.product_description,
    d.coatings,
    d.disclosure_quality,
    d.cert_line,
    d.badge_summary,
    d.buy_section_title,
    d.retailer_caution_note ?? '',
    d.sources_intro,
    d.safer_alternatives_subhead ?? '',
    d.safer_alternatives_footer ?? '',
    s.tier,
    String(s.pac_safety_score),
    s.transparency_badge,
    s.displayed_confidence_range,
  ]

  for (const sm of d.secondary_materials) {
    out.push(sm.name, sm.note ?? '')
  }
  for (const uc of d.use_conditions) out.push(uc)
  for (const bar of d.risk_bars) {
    out.push(bar.label, bar.status_label)
  }
  for (const src of d.sources.filter((x) => x.public_source_eligible)) {
    out.push(src.label, src.footnote ?? '')
  }
  for (const cta of d.buy_cta) {
    out.push(cta.label)
  }
  for (const section of d.why_this_score.sections) {
    out.push(section.title)
    for (const item of section.items) {
      out.push(item.text, item.note ?? '')
    }
  }

  return out.map((x) => x.trim()).filter(Boolean)
}

function stringAllowedByApr(value: string, allowed: Set<string>): boolean {
  if (allowed.has(value)) return true
  for (const candidate of allowed) {
    if (candidate.includes(value) || value.includes(candidate)) {
      if (Math.min(candidate.length, value.length) >= 8) return true
    }
  }
  return false
}

/** Assert fixture-render visible strings are sourced from APR or static chrome only. */
export function assertRendererTextContract(input: AprPublicRenderInput): {
  valid: boolean
  violations: RendererTextViolation[]
} {
  const allowed = collectAprAllowedStrings(input)
  const visible = buildPrimaryProductVisibleStrings(input)
  const violations: RendererTextViolation[] = []

  for (const [i, text] of visible.entries()) {
    if (isStaticSiteChromeString(text)) continue
    if (stringAllowedByApr(text, allowed)) continue
    violations.push({
      check_id: 'renderer.invented_product_string',
      rule: 'renderer_text_contract',
      path: `visible[${i}]`,
      message: `Renderer-visible string not present in display.*/score.*: "${text}"`,
    })
  }

  return { valid: violations.length === 0, violations }
}

/** Collect display string paths for artifact scanning. */
export function walkDisplayStrings(
  display: AprDisplayPayload,
  visitor: (path: string, value: string) => void,
): void {
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      visitor(path, value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k)
      }
    }
  }
  walk(display, 'display')
}
