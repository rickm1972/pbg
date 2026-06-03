/**
 * Phase 3.5: deterministic canonical mapping from Agent 1 structured_evidence (raw preserved).
 */
import { GOVERNMENT_SOURCE_CONFIRMED, TAXONOMY_EXPANSION_REQUIRED } from './constants.mjs'
import { PRIMARY_CONTACT_MATERIAL_TAXONOMY } from './primary-contact-material-taxonomy.mjs'
import { SUBSTRATE_MATERIAL_TAXONOMY } from './substrate-material-taxonomy.mjs'
import { COATING_MODIFIER_TAXONOMY } from './coating-modifier-taxonomy.mjs'
import { SAFETY_CLAIM_TAXONOMY } from './safety-claim-taxonomy.mjs'
import { PFAS_STATUS_TAXONOMY } from './pfas-status-taxonomy.mjs'
import { REGULATORY_FLAG_TAXONOMY } from './regulatory-flag-taxonomy.mjs'
import { resolveCertEntry } from './certification-canonical-taxonomy.mjs'
import { getCanonicalApprovalBlockers } from './score-driving-fields.mjs'
import { applyRequiredEvidenceValidation } from '../required-evidence-matrix/validate-required-evidence.mjs'
import { PTFE_PRIMARY_IDS } from '../required-evidence-matrix/pattern-triggers.mjs'

const SCHEMA_VERSION = '3.5'

/**
 * @param {string} text
 * @param {import('./types.mjs').TaxonomyEntry[]} entries
 * @returns {import('./types.mjs').TaxonomyEntry | null}
 */
function matchTaxonomy(text, entries) {
  const blob = String(text ?? '').trim()
  if (!blob) return null
  for (const entry of entries) {
    for (const re of entry.aliases) {
      if (re.test(blob)) return entry
    }
  }
  return null
}

/**
 * @param {object} params
 * @returns {import('./types.mjs').CanonicalFieldMapping}
 */
function mappingRow(params) {
  const entry = params.entry
  const canonical_id = params.forceExpansion
    ? TAXONOMY_EXPANSION_REQUIRED
    : (entry?.canonical_id ?? TAXONOMY_EXPANSION_REQUIRED)
  return {
    field_key: params.field_key,
    raw_value: String(params.raw_value ?? '').trim(),
    canonical_id,
    mapping_rule_id: params.forceExpansion ? null : (entry?.mapping_rule_id ?? params.mapping_rule_id ?? null),
    source_url: params.source_url ?? null,
    source_quote: params.source_quote ?? null,
    confidence_label: params.confidence_label ?? null,
    display_label: entry?.display_label ?? null,
    taxonomy_file: entry?.taxonomy_file ?? params.taxonomy_file ?? null,
    agent2_material_id: entry?.agent2_material_id ?? null,
  }
}

/**
 * @param {object} structured
 * @param {object[]} sources
 */
function collectSourceBlob(structured, sources) {
  const parts = []
  const pcm = structured?.primary_contact_material
  if (pcm?.material_identity) parts.push(pcm.material_identity)
  for (const c of structured?.coatings_and_finishes ?? []) {
    parts.push(c.coating_name, c.coating_type)
  }
  const ing = structured?.ingredient_list?.ingredients
  if (Array.isArray(ing)) parts.push(ing.join(' '))
  for (const s of sources ?? []) {
    parts.push(s.title, s.page_excerpt)
  }
  return parts.join('\n')
}

/**
 * @param {object} structured
 * @param {object[]} sources
 */
function mapCookwareTfalStyle(structured, sources) {
  const pcm = structured?.primary_contact_material ?? {}
  const primaryRaw = pcm.material_identity ?? ''
  const interiorCoat =
    (structured?.coatings_and_finishes ?? []).find((c) => /ptfe|nonstick|titanium/i.test(String(c.coating_name ?? ''))) ??
    null
  const exteriorCoat =
    (structured?.coatings_and_finishes ?? []).find((c) => /hard\s*anodized\s*exterior/i.test(String(c.coating_name ?? ''))) ??
    null

  const blob = collectSourceBlob(structured, sources)
  const hasTitanium = /titanium/i.test(`${primaryRaw} ${interiorCoat?.coating_name ?? ''} ${blob}`)
  const hasPtfeStack = /ptfe|nonstick|non-stick|pfa|fep/i.test(`${primaryRaw} ${interiorCoat?.coating_name ?? ''} ${blob}`)
  const hasHardAnodized = /hard\s*anodized|hard\s*anodised/i.test(`${primaryRaw} ${exteriorCoat?.coating_name ?? ''} ${blob}`)

  /** @type {import('./types.mjs').CanonicalMappingsPayload} */
  const out = { schema_version: SCHEMA_VERSION, safety_claim_ids: {}, regulatory_flag_ids: [], blockers: [] }

  if (hasPtfeStack && hasHardAnodized) {
    const primaryEntry = hasTitanium
      ? PRIMARY_CONTACT_MATERIAL_TAXONOMY.find((e) => e.canonical_id === 'ptfe_nonstick_titanium_reinforced')
      : PRIMARY_CONTACT_MATERIAL_TAXONOMY.find((e) => e.canonical_id === 'ptfe_nonstick_coating')
    out.primary_contact_material_id = mappingRow({
      field_key: 'primary_contact_material_id',
      raw_value: interiorCoat?.coating_name ?? primaryRaw,
      entry: primaryEntry,
      mapping_rule_id: hasTitanium ? 'cookware_titanium_ptfe_interior_v1' : 'cookware_ptfe_on_hard_anodized_v1',
      source_url: interiorCoat?.source_url ?? pcm.source_url,
      source_quote: interiorCoat?.coating_name ?? primaryRaw,
      confidence_label: pcm.confidence_label ?? 'manufacturer_confirmed',
    })
    const substrateEntry = SUBSTRATE_MATERIAL_TAXONOMY.find((e) => e.canonical_id === 'hard_anodized_aluminum')
    out.substrate_material_id = mappingRow({
      field_key: 'substrate_material_id',
      raw_value: exteriorCoat?.coating_name ?? 'hard anodized aluminum body',
      entry: substrateEntry,
      mapping_rule_id: 'cookware_hard_anodized_substrate_v1',
      source_url: exteriorCoat?.source_url ?? pcm.source_url,
      confidence_label: 'manufacturer_confirmed',
    })
    if (hasTitanium) {
      const modEntry = COATING_MODIFIER_TAXONOMY.find((e) => e.canonical_id === 'titanium_reinforced')
      out.coating_modifier_id = mappingRow({
        field_key: 'coating_modifier_id',
        raw_value: interiorCoat?.coating_name ?? 'titanium reinforced PTFE',
        entry: modEntry,
        mapping_rule_id: 'cookware_titanium_modifier_v1',
        source_url: interiorCoat?.source_url ?? pcm.source_url,
        confidence_label: 'manufacturer_confirmed',
      })
    } else {
      const modEntry = COATING_MODIFIER_TAXONOMY.find((e) => e.canonical_id === 'hard_anodized_exterior_finish')
      out.coating_modifier_id = mappingRow({
        field_key: 'coating_modifier_id',
        raw_value: exteriorCoat?.coating_name ?? 'hard anodized exterior',
        entry: modEntry,
        mapping_rule_id: 'cookware_hard_anodized_exterior_v1',
        source_url: exteriorCoat?.source_url,
        confidence_label: 'manufacturer_confirmed',
      })
    }
  } else {
    const primaryEntry = matchTaxonomy(primaryRaw, PRIMARY_CONTACT_MATERIAL_TAXONOMY)
    out.primary_contact_material_id = mappingRow({
      field_key: 'primary_contact_material_id',
      raw_value: primaryRaw,
      entry: primaryEntry,
      forceExpansion: !primaryEntry,
      taxonomy_file: 'primary-contact-material-taxonomy.mjs',
      source_url: pcm.source_url,
      source_quote: primaryRaw,
      confidence_label: pcm.confidence_label,
    })
    const substrateEntry = matchTaxonomy(blob, SUBSTRATE_MATERIAL_TAXONOMY)
    out.substrate_material_id = mappingRow({
      field_key: 'substrate_material_id',
      raw_value: exteriorCoat?.coating_name ?? primaryRaw,
      entry: substrateEntry,
      forceExpansion: !substrateEntry,
      taxonomy_file: 'substrate-material-taxonomy.mjs',
      source_url: exteriorCoat?.source_url ?? pcm.source_url,
      confidence_label: 'manufacturer_confirmed',
    })
    const modEntry = matchTaxonomy(
      `${interiorCoat?.coating_name ?? ''} ${exteriorCoat?.coating_name ?? ''}`,
      COATING_MODIFIER_TAXONOMY,
    )
    out.coating_modifier_id = mappingRow({
      field_key: 'coating_modifier_id',
      raw_value: interiorCoat?.coating_name ?? exteriorCoat?.coating_name ?? '',
      entry: modEntry,
      forceExpansion: !modEntry,
      taxonomy_file: 'coating-modifier-taxonomy.mjs',
      source_url: interiorCoat?.source_url ?? exteriorCoat?.source_url,
      confidence_label: 'manufacturer_confirmed',
    })
  }

  return out
}

/**
 * @param {import('./types.mjs').CanonicalMappingsPayload} cookware
 * @param {object} structured
 */
function isPtfeNonstickCookware(cookware, structured) {
  const primaryId = cookware?.primary_contact_material_id?.canonical_id ?? ''
  if (PTFE_PRIMARY_IDS.has(primaryId)) return true
  const pcm = String(structured?.primary_contact_material?.material_identity ?? '')
  return /ptfe|non-?stick/i.test(pcm)
}

/**
 * Agent 1 sometimes sets pfas_free_claim.claimed from PFOA-only copy on PTFE cookware.
 * @param {object} structured
 * @param {import('./types.mjs').CanonicalMappingsPayload} cookware
 */
function sanitizePfasFreeClaimMislabel(structured, cookware) {
  const claim = structured?.safety_claims?.pfas_free_claim
  if (!claim?.claimed || !isPtfeNonstickCookware(cookware, structured)) return
  const q = `${claim.source_quote ?? ''}`
  if (!/\bpfas[-\s]?free\b/i.test(q)) {
    claim.claimed = false
  }
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {import('./types.mjs').CanonicalMappingsPayload} cookware
 */
function mapPfasStatus(structured, sources, cookware) {
  const sc = structured?.safety_claims ?? {}
  const blob = collectSourceBlob(structured, sources)
  const ingText = (structured?.ingredient_list?.ingredients ?? []).join(' ')
  const ptfeProduct = isPtfeNonstickCookware(cookware, structured)

  if (/ptfe/i.test(ingText) && (/\bpfa\b/i.test(ingText) || /\bfep\b/i.test(ingText) || /pfas/i.test(ingText))) {
    const entry = PFAS_STATUS_TAXONOMY.find((e) => e.canonical_id === 'pfas_intentionally_added_disclosed')
    return mappingRow({
      field_key: 'pfas_status_id',
      raw_value: ingText.slice(0, 240),
      entry,
      mapping_rule_id: 'pfas_intentionally_added_disclosed_v1',
      source_url: structured?.ingredient_list?.source_url ?? sc.testing_source_url ?? null,
      source_quote: 'Ingredient/disclosure lists PTFE, PFA, FEP (PFAS family).',
      confidence_label: 'manufacturer_confirmed',
    })
  }

  if (ptfeProduct) {
    const entry = PFAS_STATUS_TAXONOMY.find((e) => e.canonical_id === 'pfas_present_disclosed')
    const quote =
      ingText.trim() ||
      (structured?.coatings_and_finishes ?? [])
        .map((c) => c.coating_name)
        .filter(Boolean)
        .join('; ')
        .slice(0, 200) ||
      'PTFE nonstick food-contact surface — PFAS family disclosed'
    return mappingRow({
      field_key: 'pfas_status_id',
      raw_value: quote.slice(0, 240),
      entry,
      mapping_rule_id: 'pfas_present_disclosed_v1',
      source_url:
        structured?.ingredient_list?.source_url ??
        cookware?.primary_contact_material_id?.source_url ??
        pcmSource(structured),
      source_quote: quote.slice(0, 240),
      confidence_label: 'manufacturer_confirmed',
    })
  }

  if (sc.pfas_free_claim?.claimed && /\bpfas[-\s]?free\b/i.test(`${sc.pfas_free_claim.source_quote ?? ''} ${blob}`)) {
    const entry = PFAS_STATUS_TAXONOMY.find((e) => e.canonical_id === 'pfas_free_claimed')
    return mappingRow({
      field_key: 'pfas_status_id',
      raw_value: sc.pfas_free_claim.source_quote ?? 'pfas_free_claim',
      entry,
      mapping_rule_id: 'pfas_free_claimed_v1',
      source_url: sc.pfas_free_claim.source_url,
      source_quote: sc.pfas_free_claim.source_quote ?? null,
      confidence_label: 'manufacturer_confirmed',
    })
  }

  if (/ptfe|pfa|fep|pfas/i.test(blob)) {
    const entry = PFAS_STATUS_TAXONOMY.find((e) => e.canonical_id === 'pfas_present_disclosed')
    return mappingRow({
      field_key: 'pfas_status_id',
      raw_value: blob.slice(0, 200),
      entry,
      mapping_rule_id: 'pfas_present_disclosed_v1',
      source_url: pcmSource(structured),
      confidence_label: 'manufacturer_confirmed',
    })
  }

  const entry = PFAS_STATUS_TAXONOMY.find((e) => e.canonical_id === 'pfas_not_disclosed')
  return mappingRow({
    field_key: 'pfas_status_id',
    raw_value: 'not disclosed in reviewed sources',
    entry,
    mapping_rule_id: 'pfas_not_disclosed_v1',
    source_url: null,
    confidence_label: 'unknown',
  })
}

function pcmSource(structured) {
  return structured?.primary_contact_material?.source_url ?? null
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {import('./types.mjs').CanonicalMappingsPayload} cookware
 */
function mapSafetyClaims(structured, sources, cookware) {
  const sc = structured?.safety_claims ?? {}
  const blob = collectSourceBlob(structured, sources)
  const ptfeProduct = isPtfeNonstickCookware(cookware, structured)
  /** @type {Record<string, import('./types.mjs').CanonicalFieldMapping>} */
  const out = {}

  const claimDefs = [
    {
      key: 'pfoa_free_claim',
      schemaKey: null,
      detect: () => /\bno\s+pfoa\b/i.test(blob) || /pfoa[-\s]?free/i.test(blob),
    },
    {
      key: 'pfas_free_marketing_claim',
      schemaKey: 'pfas_free_claim',
      detect: () => {
        if (ptfeProduct) return false
        if (!sc.pfas_free_claim?.claimed) return false
        const q = `${sc.pfas_free_claim.source_quote ?? ''} ${blob}`
        return (
          /\bpfas[-\s]?free\b/i.test(q) &&
          !/pfas[-\s]?free alternative|avoid pfas|guide|comparison/i.test(q)
        )
      },
    },
    {
      key: 'non_toxic_marketing_claim',
      schemaKey: 'non_toxic_claim',
      detect: () => Boolean(sc.non_toxic_claim?.claimed),
    },
    { key: 'bpa_free_claim', schemaKey: 'bpa_free_claim', detect: () => Boolean(sc.bpa_free_claim?.claimed) },
    { key: 'lead_free_claim', schemaKey: 'lead_free_claim', detect: () => Boolean(sc.lead_free_claim?.claimed) },
    {
      key: 'phthalate_free_claim',
      schemaKey: 'phthalate_free_claim',
      detect: () => Boolean(sc.phthalate_free_claim?.claimed),
    },
  ]

  for (const def of claimDefs) {
    const claimed = def.detect()
    if (!claimed && def.schemaKey && !sc[def.schemaKey]?.claimed) continue
    if (!claimed) continue

    const taxEntry = SAFETY_CLAIM_TAXONOMY.find((e) => e.canonical_id === def.key)
    const schemaField = def.schemaKey ? sc[def.schemaKey] : null
    const raw =
      def.key === 'pfoa_free_claim'
        ? (blob.match(/pfoa[-\s]?free[^.;]*/i)?.[0] ?? 'PFOA-free (copy)')
        : def.key === 'non_toxic_marketing_claim'
          ? 'non_toxic_claim'
          : def.key

    out[def.key] = {
      ...mappingRow({
        field_key: def.key,
        raw_value: raw,
        entry: taxEntry,
        mapping_rule_id: taxEntry?.mapping_rule_id,
        source_url: schemaField?.source_url ?? pcmSource(structured),
        source_quote: raw,
        confidence_label: schemaField ? 'manufacturer_confirmed' : 'retailer_confirmed',
      }),
      claimed: true,
    }
  }

  return out
}

/**
 * @param {object} structured
 * @param {object[]} sources
 */
function mapRegulatoryFlags(structured, sources) {
  const rcBlob = (structured?.required_check_results ?? [])
    .map((r) => `${r.source_quote ?? ''} ${r.detail ?? ''}`)
    .join('\n')
  const blob = `${collectSourceBlob(structured, sources)}\n${rcBlob}`
  /** @type {import('./types.mjs').CanonicalFieldMapping[]} */
  const flags = []
  if (/minnesota/i.test(blob) && (/pfas/i.test(blob) || /ban|prohibit|2025|2029/i.test(blob))) {
    const entry = REGULATORY_FLAG_TAXONOMY.find((e) => e.canonical_id === 'minnesota_pfas_ban_2025')
    const regSource =
      sources.find((s) => /pca\.state\.mn\.us|revisor\.mn\.gov/i.test(s.url ?? '')) ??
      sources.find((s) => /regulatory|government/i.test(s.source_type ?? ''))
    const rc = structured?.required_check_results?.find(
      (r) => r.check_id === 'external.regulatory_pfas_minnesota_review' && r.status === 'passed',
    )
    const govSource = Boolean(regSource)
    flags.push(
      mappingRow({
        field_key: 'regulatory_flag_ids',
        raw_value:
          'Minnesota 2025 PFAS cookware prohibition — category/material applicability (not SKU-specific ban confirmation)',
        entry,
        mapping_rule_id: 'regulatory_minnesota_pfas_ban_2025_v1',
        source_url: regSource?.url ?? rc?.source_url ?? pcmSource(structured),
        source_quote:
          regSource?.page_excerpt?.slice(0, 400) ??
          rc?.source_quote?.slice(0, 400) ??
          'Official MN source: cookware with intentionally added PFAS prohibited from Jan. 1, 2025 (Amara\'s Law).',
        confidence_label: govSource ? GOVERNMENT_SOURCE_CONFIRMED : 'manufacturer_confirmed',
      }),
    )
  }
  return flags
}

/**
 * @param {object} structured
 */
function mapCertifications(structured) {
  /** @type {Record<string, import('./types.mjs').CanonicalFieldMapping>} */
  const out = {}
  for (const v of structured?.certifications?.verified_certifications ?? []) {
    const resolved = resolveCertEntry(v.cert_name)
    if (!resolved) {
      out[v.cert_name] = mappingRow({
        field_key: 'certification_ids',
        raw_value: v.cert_name,
        forceExpansion: true,
        taxonomy_file: 'certification-taxonomy.mjs',
        source_url: v.source_url,
      })
      continue
    }
    out[resolved.id] = mappingRow({
      field_key: 'certification_ids',
      raw_value: v.cert_name,
      entry: {
        canonical_id: resolved.id,
        display_label: resolved.name,
        mapping_rule_id: 'certification_taxonomy_resolve_v1',
        taxonomy_file: 'certification-taxonomy.mjs',
      },
      source_url: v.source_url,
      confidence_label: 'certification verified',
    })
  }
  return out
}

/**
 * Apply deterministic canonical mappings to structured evidence (mutates copy).
 * @param {object} structured
 * @param {object[]} [sources]
 * @param {{ facts?: object[] }} [options]
 * @returns {import('./types.mjs').CanonicalMappingsPayload}
 */
export function applyCanonicalMappings(structured, sources = [], options = {}) {
  if (!structured || typeof structured !== 'object') {
    return { schema_version: SCHEMA_VERSION, blockers: ['structured_evidence missing'] }
  }

  const sub = structured?.product_identity?.subcategory ?? ''
  const cookware = mapCookwareTfalStyle(structured, sources)
  sanitizePfasFreeClaimMislabel(structured, cookware)
  cookware.pfas_status_id = mapPfasStatus(structured, sources, cookware)
  cookware.safety_claim_ids = mapSafetyClaims(structured, sources, cookware)
  if (isPtfeNonstickCookware(cookware, structured)) {
    delete cookware.safety_claim_ids.pfas_free_marketing_claim
  }
  cookware.regulatory_flag_ids = mapRegulatoryFlags(structured, sources)
  cookware.certification_ids = mapCertifications(structured)

  if (options.facts) {
    const factBlob = options.facts.map((f) => `${f.fact_key} ${f.fact_value}`).join('\n')
    if (/pfoa[-\s]?free/i.test(factBlob) && !cookware.safety_claim_ids?.pfoa_free_claim) {
      const taxEntry = SAFETY_CLAIM_TAXONOMY.find((e) => e.canonical_id === 'pfoa_free_claim')
      cookware.safety_claim_ids.pfoa_free_claim = {
        ...mappingRow({
          field_key: 'pfoa_free_claim',
          raw_value: factBlob.match(/pfoa[-\s]?free/i)?.[0] ?? 'PFOA-free',
          entry: taxEntry,
          source_url: pcmSource(structured),
        }),
        claimed: true,
      }
    }
  }

  cookware.blockers = getCanonicalApprovalBlockers(cookware, { subcategory: sub })
  structured.canonical_mappings = cookware
  applyRequiredEvidenceValidation(structured, sources, options)
  return cookware
}

export {
  PRIMARY_CONTACT_MATERIAL_TAXONOMY,
  SUBSTRATE_MATERIAL_TAXONOMY,
  COATING_MODIFIER_TAXONOMY,
  SAFETY_CLAIM_TAXONOMY,
  PFAS_STATUS_TAXONOMY,
  REGULATORY_FLAG_TAXONOMY,
}
