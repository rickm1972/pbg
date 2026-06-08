/**
 * Human-readable material phrasing for public product UI and descriptions.
 * Does not change stored taxonomy IDs or Gate 2 option labels.
 */

import type { WhyThisScoreFields } from './whyThisScoreApi'

const MATERIAL_PROSE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstainless steel \(grade unspecified\)/gi, 'stainless steel of unspecified grade'],
  [/\bstainless steel grade unspecified\b/gi, 'stainless steel of unspecified grade'],
  [/\bglass type unspecified\b/gi, 'glass of unspecified type'],
  [/\bplastic resin unspecified\b/gi, 'plastic resin of unspecified type'],
  [
    /\bBPA-free plastic resin unspecified\b/gi,
    'BPA-free plastic resin of unspecified type',
  ],
  [
    /\bhandle material unspecified\b/gi,
    'handle material that is not specified',
  ],
  [/\bwood finishing unspecified\b/gi, 'wood finish that is not specified'],
]

/** Title-case public label for UI rows (Why This Score, contact material). */
export function humanizePublicMaterialLabel(label: string): string {
  const t = String(label ?? '').trim()
  if (!t) return t

  const lower = t.toLowerCase()
  if (
    lower === 'stainless steel grade unspecified' ||
    lower === 'stainless steel (grade unspecified)'
  ) {
    return 'Stainless steel of unspecified grade'
  }
  if (lower === 'glass type unspecified') return 'Glass of unspecified type'
  if (lower === 'plastic lid resin unspecified') return 'Plastic lid resin of unspecified type'
  if (lower === 'bpa-free plastic resin unspecified') {
    return 'BPA-free plastic resin of unspecified type'
  }
  if (lower === 'stay-cool handle material unspecified') {
    return 'Stay-cool handle material not specified'
  }
  if (lower === 'wood finishing unspecified') return 'Wood finish not specified'

  return t
}

export function humanizePublicMaterialLabels(labels: string[]): string[] {
  return labels.map(humanizePublicMaterialLabel)
}

export function humanizePublicMaterialProse(text: string): string {
  if (!text?.trim()) return text
  let out = text
  for (const [pattern, replacement] of MATERIAL_PROSE_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

/** Humanize contact-material line built from component labels. */
export function humanizePublicContactMaterialDisplay(display: string | null): string | null {
  if (!display?.trim()) return display
  return display
    .split(',')
    .map((part) => humanizePublicMaterialLabel(part.trim()))
    .join(', ')
}

export function applyPublicMaterialLabelsToWhyThisScore(
  fields: WhyThisScoreFields,
): WhyThisScoreFields {
  return {
    ...fields,
    primary_material_options: humanizePublicMaterialLabels(fields.primary_material_options),
    secondary_materials_options: humanizePublicMaterialLabels(fields.secondary_materials_options),
  }
}
