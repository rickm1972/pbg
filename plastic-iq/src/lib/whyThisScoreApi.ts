import { supabase } from './supabaseClient'
import { isPacRelevant } from './certificationTaxonomy'

export type WhyThisScoreFields = {
  primary_material_options: string[]
  secondary_materials_options: string[]
  coatings_finishes_options: string[]
  use_conditions_options: string[]
  disclosure_quality_options: string[]
  certifications_options: string[]
}

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

export function displayOptions(options: string[]): string[] {
  if (!options.length) return []
  if (options.length === 1 && options[0] === 'None') return []
  return options.filter((o) => o !== 'None')
}

/** Same rule as CertificationBadges — only PAC-relevant certs in Why This Score display. */
export function filterPacRelevantCertificationOptions(options: string[]): string[] {
  const absent = 'Third-party verification absent'
  const filtered = options.filter((o) => o === absent || isPacRelevant(o))
  if (filtered.length === 0 && options.some((o) => o !== absent && o !== 'None')) {
    return [absent]
  }
  return filtered
}

export async function fetchWhyThisScore(productId: string): Promise<WhyThisScoreFields | null> {
  const { data, error } = await supabase.rpc('get_why_this_score', {
    p_product_id: productId,
  })

  if (error) throw error
  if (!data || typeof data !== 'object') return null

  const row = data as Record<string, unknown>
  const fields: WhyThisScoreFields = {
    primary_material_options: parseOptions(row.primary_material_options),
    secondary_materials_options: parseOptions(row.secondary_materials_options),
    coatings_finishes_options: parseOptions(row.coatings_finishes_options),
    use_conditions_options: parseOptions(row.use_conditions_options),
    disclosure_quality_options: parseOptions(row.disclosure_quality_options),
    certifications_options: filterPacRelevantCertificationOptions(
      parseOptions(row.certifications_options),
    ),
  }

  const hasAny = Object.values(fields).some((arr) => arr.length > 0)
  return hasAny ? fields : null
}
