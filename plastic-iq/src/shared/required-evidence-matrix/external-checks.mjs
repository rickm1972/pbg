import { isExpansionRequired } from '../canonical-taxonomy/constants.mjs'
import { PTFE_PRIMARY_IDS } from './pattern-triggers.mjs'

/**
 * @param {object} structured
 * @param {string} checkId
 */
function getRequiredCheckResult(structured, checkId) {
  const list = structured?.required_check_results
  if (!Array.isArray(list)) return null
  return list.find((r) => r.check_id === checkId) ?? null
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {import('../canonical-taxonomy/types.mjs').CanonicalMappingsPayload | null | undefined} mappings
 * @param {Set<string>} triggers
 * @param {string} checkId
 */
export function evaluateExternalCheck(structured, sources, mappings, triggers, checkId) {
  const blob = [
    ...(sources ?? []).map((s) => `${s.title ?? ''} ${s.page_excerpt ?? ''} ${s.url ?? ''}`),
    structured?.primary_contact_material?.material_identity,
    structured?.ingredient_list?.ingredients?.join(' '),
    structured?.care_and_use_instructions,
  ]
    .filter(Boolean)
    .join('\n')

  switch (checkId) {
    case 'external.sources_documented':
      return sources?.length > 0
        ? pass('Sources on file', sources[0]?.url)
        : missing('No evidence sources recorded')

    case 'external.pfas_nonstick_disclosure': {
      if (!triggers.has('ptfe_primary_contact') && !triggers.has('ceramic_nonstick_coating')) {
        return notApplicable()
      }
      const pfas = mappings?.pfas_status_id
      const coatingOk = (structured?.coatings_and_finishes ?? []).some(
        (c) => c.composition_disclosed && /ptfe|nonstick/i.test(`${c.coating_name} ${c.coating_type}`),
      )
      const ingredientOk = Boolean(structured?.ingredient_list?.ingredients?.length)
      if (
        pfas &&
        !isExpansionRequired(pfas.canonical_id) &&
        (pfas.source_url || pfas.source_quote)
      ) {
        return pass('PFAS status mapped with source', pfas.source_url, pfas.source_quote)
      }
      if (coatingOk || ingredientOk) {
        return pass('Coating / ingredient disclosure documents PFAS family', structured?.ingredient_list?.source_url)
      }
      return missing('PFAS / nonstick disclosure not documented with source')
    }

    case 'external.pfoa_vs_pfas_free_distinction': {
      if (!triggers.has('pfoa_pfas_distinction') && !triggers.has('ptfe_primary_contact')) {
        return notApplicable()
      }
      const rc = getRequiredCheckResult(structured, checkId)
      if (rc?.status === 'passed') {
        return pass(rc.detail ?? 'PFOA-free vs PFAS-free distinction documented', rc.source_url, rc.source_quote)
      }
      if (rc?.status === 'failed') {
        return {
          status: 'missing',
          detail: rc.detail ?? 'PFOA vs PFAS-free distinction retrieval failed',
          source_url: rc.source_url,
          source_quote: rc.source_quote,
          severity: 'blocker',
        }
      }
      const sc = structured?.safety_claims ?? {}
      const pfoaMapped = mappings?.safety_claim_ids?.pfoa_free_claim
      const pfasFreeClaimed = Boolean(sc.pfas_free_claim?.claimed)
      const pfasFreeMapped = mappings?.safety_claim_ids?.pfas_free_marketing_claim

      if (pfasFreeClaimed && !pfasFreeMapped?.source_url && !sc.pfas_free_claim?.source_url) {
        return missing('PFAS-free claimed without dedicated source — do not infer from PFOA-free alone')
      }

      if (pfoaMapped && !isExpansionRequired(pfoaMapped.canonical_id)) {
        if (pfasFreeClaimed && pfoaMapped.canonical_id === 'pfoa_free_claim') {
          return review(
            'Both PFOA-free and PFAS-free appear claimed — verify sources are distinct',
            pfoaMapped.source_url,
          )
        }
        return pass('PFOA-free mapped; PFAS-free not inferred from PFOA-only copy', pfoaMapped.source_url, pfoaMapped.source_quote)
      }

      if (/\bno\s+pfoa\b/i.test(blob) || /pfoa[-\s]?free/i.test(blob)) {
        if (pfasFreeClaimed) {
          return review('PFOA-free language present with separate PFAS-free claim — confirm distinction', null)
        }
        return pass('PFOA-free documented without PFAS-free marketing conflation', null)
      }

      return missing('PFOA-free vs PFAS-free distinction not documented for PTFE product')
    }

    case 'external.regulatory_pfas_minnesota_review': {
      if (!triggers.has('ptfe_primary_contact')) return notApplicable()
      const rc = getRequiredCheckResult(structured, checkId)
      if (rc?.status === 'passed') {
        return pass(rc.detail ?? 'Required-check retrieval passed', rc.source_url, rc.source_quote)
      }
      if (rc?.status === 'failed') {
        return {
          status: 'missing',
          detail: rc.detail ?? 'Required-check retrieval failed for Minnesota PFAS regulatory review',
          source_url: rc.source_url,
          source_quote: rc.source_quote,
          severity: 'blocker',
        }
      }
      const flags = mappings?.regulatory_flag_ids ?? []
      const mnFlag = flags.find((f) => f.canonical_id === 'minnesota_pfas_ban_2025')
      if (mnFlag && !isExpansionRequired(mnFlag.canonical_id)) {
        return pass('Minnesota PFAS ban flag mapped', mnFlag.source_url, mnFlag.source_quote)
      }
      if (/minnesota/i.test(blob) && /pfas|ban|2025|2029|cookware/i.test(blob)) {
        return review(
          'Minnesota PFAS regulatory language in sources but not mapped — add regulatory_flag or source quote',
          null,
        )
      }
      return missing(
        'Regulatory PFAS check incomplete: no source documenting Minnesota 2025 ban applicability or exemption',
      )
    }

    case 'external.silicone_food_contact_grade': {
      if (!triggers.has('silicone_food_contact')) return notApplicable()
      if (/food[-\s]?grade|platinum|peroxide[-\s]?free|LFGB|FDA/i.test(blob)) {
        return pass('Silicone grade / food-grade language found in sources', null)
      }
      return warning('Silicone food-contact present — grade / platinum-cured disclosure not found (non-score gap)')
    }

    case 'external.proprietary_coating_warning': {
      if (!triggers.has('proprietary_coating')) return notApplicable()
      const pcm = structured?.primary_contact_material
      if (pcm?.undisclosed_code === 'PROPRIETARY_NAMED' || pcm?.undisclosed_code === 'UNKNOWN') {
        return review('Proprietary / undisclosed primary contact — human review required', pcm.source_url)
      }
      return pass('Proprietary coating pattern flagged for review', pcm?.source_url)
    }

    case 'external.plastic_food_contact_disclosure': {
      if (!triggers.has('plastic_food_contact')) return notApplicable()
      const sc = structured?.safety_claims ?? {}
      const hasBpa =
        Boolean(sc.bpa_free_claim?.claimed) ||
        Boolean(mappings?.safety_claim_ids?.bpa_free_claim) ||
        /bpa[-\s]?free|bps[-\s]?free|bpf|tritan|polypropylene|polycarbonate/i.test(blob)
      if (hasBpa) return pass('Plastic-type or BPA-family disclosure present', sc.bpa_free_claim?.source_url)
      return missing('Plastic food-contact component without BPA/BPS/BPF or plastic-type disclosure')
    }

    case 'external.glass_lid_seal_materials': {
      if (!triggers.has('glass_with_lid')) return notApplicable()
      const lidComp = (structured?.secondary_components ?? []).find((c) =>
        /lid|seal|gasket/i.test(String(c.component_role)),
      )
      if (lidComp?.material_identity?.trim()) {
        return pass('Lid / seal material documented', lidComp.source_url)
      }
      return missing('Glass storage with lid — lid/seal material not documented')
    }

    case 'external.bamboo_binder_finish': {
      if (!triggers.has('bamboo_wood_composite')) return notApplicable()
      if (/binder|finish|glue|resin|melamine|coating/i.test(blob)) {
        return pass('Binder / finish language present in sources', null)
      }
      return missing('Bamboo / wood composite — binder or finish disclosure not found')
    }

    default:
      return notApplicable()
  }
}

/** @returns {{ status: string, detail: string | null, source_url?: string | null, source_quote?: string | null, severity?: string }} */
function pass(detail, source_url = null, source_quote = null) {
  return { status: 'passed', detail, source_url, source_quote, severity: 'info' }
}

function missing(detail) {
  return { status: 'missing', detail, source_url: null, source_quote: null, severity: 'blocker' }
}

function warning(detail) {
  return { status: 'missing', detail, source_url: null, source_quote: null, severity: 'warning' }
}

function review(detail, source_url) {
  return { status: 'review_required', detail, source_url, source_quote: null, severity: 'warning' }
}

function notApplicable() {
  return { status: 'not_applicable', detail: null, source_url: null, source_quote: null, severity: 'info' }
}
