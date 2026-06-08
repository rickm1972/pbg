import { isExpansionRequired } from '../canonical-taxonomy/constants.mjs'
import {
  isCeramicNonstickMaterialText,
  isCeramicNonstickPrimary,
} from '../canonical-taxonomy/ceramic-nonstick-structural.mjs'
import {
  isInertFoodContactPrimary,
  isPtfeFamilyPrimary,
  PTFE_FAMILY_PRIMARY_IDS,
} from '../canonical-taxonomy/inert-cookware-structural.mjs'

/**
 * @param {object} structured
 * @param {import('../canonical-taxonomy/types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 */
/**
 * @param {object} structured
 * @param {import('../canonical-taxonomy/types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {object[]} [sources]
 */
export function detectPatternTriggers(structured, mappings, sources = []) {
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const pcmRaw = String(structured?.primary_contact_material?.material_identity ?? '').toLowerCase()
  const undisclosed = structured?.primary_contact_material?.undisclosed_code ?? null
  const pfasStatusId = mappings?.pfas_status_id?.canonical_id ?? ''

  const triggers = new Set()

  if (isCeramicNonstickPrimary(primaryId) || isCeramicNonstickMaterialText(pcmRaw)) {
    triggers.add('ceramic_nonstick_coating')
  }

  if (
    isPtfeFamilyPrimary(primaryId) ||
    (!isInertFoodContactPrimary(primaryId) &&
      !isCeramicNonstickPrimary(primaryId) &&
      !isCeramicNonstickMaterialText(pcmRaw) &&
      /\bptfe\b/i.test(pcmRaw))
  ) {
    triggers.add('ptfe_primary_contact')
  }

  if (detectPfoaPfasDistinctionPattern(structured, mappings, sources, { primaryId, pfasStatusId, pcmRaw })) {
    triggers.add('pfoa_pfas_distinction')
  }

  const ceramicDisclosed =
    isCeramicNonstickPrimary(primaryId) ||
    isCeramicNonstickMaterialText(pcmRaw) ||
    (structured?.coatings_and_finishes ?? []).some((c) =>
      isCeramicNonstickMaterialText(`${c.coating_name ?? ''} ${c.coating_type ?? ''}`),
    )
  if (
    !ceramicDisclosed &&
    (undisclosed === 'PROPRIETARY_NAMED' ||
      undisclosed === 'UNKNOWN' ||
      /proprietary|undisclosed/i.test(pcmRaw) ||
      (structured?.coatings_and_finishes ?? []).some((c) => c.coating_type === 'proprietary_undisclosed'))
  ) {
    triggers.add('proprietary_coating')
  }

  const blob = collectMaterialBlob(structured)
  if (/plastic|nylon|polypropylene|polycarbonate|tritan|abs|pet\b|pp\b|pe\b/i.test(blob)) {
    triggers.add('plastic_food_contact')
  }

  if (/silicone/i.test(blob)) {
    triggers.add('silicone_food_contact')
  }

  if (/glass/i.test(pcmRaw) || /glass/i.test(blob)) {
    const hasLid =
      (structured?.secondary_components ?? []).some((c) =>
        /lid|seal|gasket|cap/i.test(String(c.component_role)),
      ) || /lid|seal|gasket/i.test(blob)
    if (hasLid) triggers.add('glass_with_lid')
  }

  if (/bamboo|wood\s*composite|mdf|particle\s*board/i.test(blob)) {
    triggers.add('bamboo_wood_composite')
  }

  // PTFE cookware always requires PFOA-vs-PFAS distinction retrieval (Phase 3.7).
  if (triggers.has('ptfe_primary_contact')) {
    triggers.add('pfoa_pfas_distinction')
  }

  return triggers
}

/**
 * @param {object} structured
 * @param {object} mappings
 * @param {object[]} sources
 * @param {{ primaryId: string, pfasStatusId: string, pcmRaw: string }} ctx
 */
function detectPfoaPfasDistinctionPattern(structured, mappings, sources, ctx) {
  if (isInertFoodContactPrimary(ctx.primaryId)) return false
  if (ctx.pfasStatusId === 'pfas_not_present_inert_material') return false
  if (isCeramicNonstickPrimary(ctx.primaryId)) return true
  if (isPtfeFamilyPrimary(ctx.primaryId)) return true
  if (
    ctx.pfasStatusId === 'pfas_present_disclosed' ||
    ctx.pfasStatusId === 'pfas_intentionally_added_disclosed'
  ) {
    return true
  }
  if (mappings?.safety_claim_ids?.pfoa_free_claim) return true
  if (structured?.safety_claims?.pfoa_free_claim?.claimed) return true

  const sourceBlob = (sources ?? [])
    .map((s) => `${s.title ?? ''} ${s.page_excerpt ?? ''} ${s.url ?? ''}`)
    .join('\n')
  const blob = [collectMaterialBlob(structured), ctx.pcmRaw, sourceBlob].filter(Boolean).join('\n')
  return /\bpfoa[-\s]?free\b|\bpfas[-\s]?free\b|\bptfe\b|\bpfa\b|\bfep\b|non-?stick/i.test(blob)
}

/**
 * @param {object} structured
 */
function collectMaterialBlob(structured) {
  const parts = [
    structured?.primary_contact_material?.material_identity,
    ...(structured?.secondary_components ?? []).map(
      (c) => `${c.component_role} ${c.material_identity ?? ''}`,
    ),
    ...(structured?.coatings_and_finishes ?? []).map((c) => `${c.coating_name} ${c.coating_type}`),
    structured?.ingredient_list?.ingredients?.join(' '),
  ]
  return parts.filter(Boolean).join('\n').toLowerCase()
}

export { PTFE_FAMILY_PRIMARY_IDS as PTFE_PRIMARY_IDS, isExpansionRequired }
