import { supabase } from './supabaseClient'
import { isPacRelevant } from './certificationTaxonomy'
import { applyHazardSortToWhyThisScoreFields } from './whyThisScoreSort'
import {
  CERT_VERIFICATION_ABSENT,
  normalizeWhyThisScoreOption,
} from './whyThisScoreVocabulary'
import { isManufacturerLabTestingCertOption } from './publicDisclosureGapCopy'
import type { NormalizationComponent, ScoringInputRow } from '../types/agent'

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

/** Fallback when normalization components are unavailable (Why This Score option order). */
export function primaryContactMaterialDisplay(
  primaryMaterialOptions: string[] | undefined,
): string | null {
  const names = displayOptions(primaryMaterialOptions ?? [])
  if (!names.length) return null
  return names.join(', ')
}

/** Same rule as CertificationBadges — only PAC-relevant certs in Why This Score display. */
export function filterPacRelevantCertificationOptions(options: string[]): string[] {
  const filtered = options.filter((o) => {
    if (isManufacturerLabTestingCertOption(o)) return true
    const canonical = normalizeWhyThisScoreOption('certifications_options', o)
    return canonical === CERT_VERIFICATION_ABSENT || isPacRelevant(o)
  })
  if (
    filtered.length === 0 &&
    options.some((o) => {
      const c = normalizeWhyThisScoreOption('certifications_options', o)
      return c !== CERT_VERIFICATION_ABSENT && o !== 'None'
    })
  ) {
    return [CERT_VERIFICATION_ABSENT]
  }
  return filtered
}

/** Build sorted Why This Score fields from an approved scoring_inputs row (Gate 2 / Gate 3 / product page). */
export function whyFieldsFromScoringInput(
  row: ScoringInputRow,
  components?: NormalizationComponent[] | null,
): WhyThisScoreFields | null {
  const primary = row.primary_material_options ?? []
  if (!Array.isArray(primary) || primary.length === 0) return null
  const fields: WhyThisScoreFields = {
    primary_material_options: primary,
    secondary_materials_options: row.secondary_materials_options ?? ['None'],
    coatings_finishes_options: row.coatings_finishes_options ?? ['None'],
    use_conditions_options: row.use_conditions_options ?? ['None'],
    disclosure_quality_options: row.disclosure_quality_options ?? ['None'],
    certifications_options: row.certifications_options ?? [CERT_VERIFICATION_ABSENT],
  }
  return applyHazardSortToWhyThisScoreFields(fields, components)
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

export { shapePublicWhyThisScoreFields } from './whyThisScorePublicDisplay'
