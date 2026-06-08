/**
 * Check 3 — Score sanity vs subcategory peers (current approved pipeline chain only).
 */
import {
  SCORE_SANITY_DELTA_THRESHOLD,
  SCORE_SANITY_MIN_FAMILY_PEERS,
  SCORE_SANITY_MIN_PEERS,
} from '../constants.mjs'

export const INSUFFICIENT_PEERS_MESSAGE =
  'Insufficient current peers for statistical sanity check. Current peers shown for context only.'

const MATERIAL_FAMILIES = [
  { id: 'cast_iron', pattern: /cast iron|cast-iron/ },
  { id: 'glass', pattern: /glass|borosilicate/ },
  { id: 'stainless', pattern: /stainless steel|stainless/ },
  { id: 'soap', pattern: /saponified|soap bar|soap formula|surfactant/ },
  { id: 'nylon', pattern: /\bnylon\b|polyamide/ },
  { id: 'ptfe', pattern: /\bptfe\b|teflon|fluoropolymer/ },
  { id: 'tritan', pattern: /tritan|copolyester/ },
  { id: 'ceramic_nonstick', pattern: /ceramic|thermolon|terrabond|nonstick coating/ },
  { id: 'silicone', pattern: /silicone/ },
  { id: 'aluminum', pattern: /aluminum|aluminium|anodized/ },
]

function detectFamilies(text) {
  const t = String(text ?? '').toLowerCase()
  return MATERIAL_FAMILIES.filter((f) => f.pattern.test(t)).map((f) => f.id)
}

function primaryContactMaterial(inputs, score) {
  const components = inputs?.components ?? []
  const scored =
    score?.component_nprs?.components ??
    components.map((c) => ({ ...c, final_npr: 0 }))
  const highContact = scored.filter((c) => Number(c.contact_intimacy) >= 0.7)
  const pool = highContact.length ? highContact : scored
  if (!pool.length) return ''
  const top = pool.reduce((best, c) => {
    const contrib = Number(c.final_npr ?? 0) * Number(c.contact_intimacy ?? 0)
    const bestContrib = best
      ? Number(best.final_npr ?? 0) * Number(best.contact_intimacy ?? 0)
      : -1
    return contrib > bestContrib ? c : best
  }, null)
  return `${top?.component_name ?? ''} ${top?.material ?? ''}`
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const SAFE_FAMILIES = new Set(['cast_iron', 'glass', 'soap', 'stainless'])
const RISK_FAMILIES = new Set(['nylon', 'ptfe', 'tritan', 'ceramic_nonstick'])

function familiesFromWhyOptions(scoringInput) {
  const primary = scoringInput?.primary_material_options ?? []
  const coatings = scoringInput?.coatings_finishes_options ?? []
  return detectFamilies([...primary, ...coatings].join(' '))
}

function peersArePolarized(peerFamilySets) {
  const hasSafe = peerFamilySets.some((set) => set.some((f) => SAFE_FAMILIES.has(f)))
  const hasRisk = peerFamilySets.some((set) => set.some((f) => RISK_FAMILIES.has(f)))
  return hasSafe && hasRisk
}

function materialExplainsOutlier(productFamilies, peerFamilySets, productScore, peerMedian) {
  if (!productFamilies.length) return false
  if (productFamilies.includes('ceramic_nonstick') && peersArePolarized(peerFamilySets)) {
    return true
  }
  const uniqueFamily = productFamilies.find((f) => {
    const peerCount = peerFamilySets.filter((set) => set.includes(f)).length
    return peerCount <= Math.max(0, Math.floor(peerFamilySets.length * 0.25))
  })
  if (uniqueFamily) return true
  if (productScore < peerMedian - SCORE_SANITY_DELTA_THRESHOLD) {
    if (productFamilies.some((f) => RISK_FAMILIES.has(f))) return true
  }
  if (productScore > peerMedian + SCORE_SANITY_DELTA_THRESHOLD) {
    if (productFamilies.some((f) => SAFE_FAMILIES.has(f))) return true
  }
  return false
}

function filterPeersBySharedFamily(peerScores, productFamilies) {
  if (!productFamilies.length) return []
  return (peerScores ?? []).filter((p) => {
    const inputs = p.inputs ?? p
    const scoreRow = p.score ?? p
    const peerFamilies = detectFamilies(primaryContactMaterial(inputs, scoreRow))
    return productFamilies.some((f) => peerFamilies.includes(f))
  })
}

/**
 * @param {object} params
 * @param {object} params.product — products row
 * @param {object} params.inputs
 * @param {object} params.score — audited product_scores row
 * @param {object[]} params.peerScores — other approved scores in same subcategory
 */
function peerSnapshot(peer) {
  const row = peer?.product
  const sc = peer?.score
  if (!row || !sc) return null
  return {
    product_id: row.product_id,
    product_name: row.product_name ?? null,
    score_id: sc.score_id,
    pac_safety_score: Number(sc.pac_safety_score),
    tier: sc.tier ?? null,
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    score_review_status: sc.review_status ?? 'approved',
    evidence_id: peer.evidence_id ?? row.active_evidence_id ?? null,
    input_id: peer.input_id ?? sc.input_id ?? null,
    publish_status: row.publish_status ?? null,
    active: row.active ?? true,
  }
}

export function runScoreSanity({ product, inputs, score, peerScores, scoringInput = null }) {
  const subcategory = product.subcategory ?? null
  const productScore = Number(score.pac_safety_score)
  const peerSnapshots = (peerScores ?? []).map(peerSnapshot).filter(Boolean)
  const productMaterial = primaryContactMaterial(inputs, score)
  let productFamilies = detectFamilies(productMaterial)
  const fromWhy = familiesFromWhyOptions(scoringInput)
  if (fromWhy.length) {
    productFamilies = [...new Set([...productFamilies, ...fromWhy])]
  }

  const subcategoryPeerCount = peerSnapshots.length
  if (subcategoryPeerCount < SCORE_SANITY_MIN_PEERS) {
    const familyPeers = filterPeersBySharedFamily(peerScores, productFamilies)
    const familySnapshots = familyPeers.map(peerSnapshot).filter(Boolean)
    const familyScoresOnly = familySnapshots
      .map((p) => p.pac_safety_score)
      .filter((n) => Number.isFinite(n))

    if (familyScoresOnly.length < SCORE_SANITY_MIN_FAMILY_PEERS) {
      return {
        status: 'not_applicable',
        informational: true,
        message: INSUFFICIENT_PEERS_MESSAGE,
        flags: [],
        subcategory,
        product_score: productScore,
        peer_median: null,
        peer_count: subcategoryPeerCount,
        family_peer_count: familyScoresOnly.length,
        delta_from_median: null,
        peer_products: peerSnapshots,
        product_families: productFamilies,
      }
    }

    return runMedianComparison({
      subcategory,
      productScore,
      productFamilies,
      peerScores: familyPeers,
      peerSnapshots: familySnapshots,
      comparison_scope: 'material_family',
    })
  }

  return runMedianComparison({
    subcategory,
    productScore,
    productFamilies,
    peerScores,
    peerSnapshots,
    comparison_scope: 'subcategory',
  })
}

function runMedianComparison({
  subcategory,
  productScore,
  productFamilies,
  peerScores,
  peerSnapshots,
  comparison_scope,
}) {
  const peerScoresOnly = peerSnapshots
    .map((p) => p.pac_safety_score)
    .filter((n) => Number.isFinite(n))

  const peerMedian = median(peerScoresOnly)
  const delta = Math.abs(productScore - peerMedian)
  const peerFamilySets = (peerScores ?? []).map((p) => {
    const inputs = p.inputs ?? p
    const scoreRow = p.score ?? p
    return detectFamilies(primaryContactMaterial(inputs, scoreRow))
  })

  const scopeLabel = comparison_scope === 'material_family' ? 'material-family' : 'subcategory'
  const baseResult = {
    subcategory,
    comparison_scope,
    product_score: productScore,
    peer_median: peerMedian,
    peer_count: peerScoresOnly.length,
    delta_from_median: delta,
    peer_products: peerSnapshots,
    product_families: productFamilies,
  }

  if (delta <= SCORE_SANITY_DELTA_THRESHOLD) {
    return {
      status: 'pass',
      flags: [],
      ...baseResult,
    }
  }

  if (materialExplainsOutlier(productFamilies, peerFamilySets, productScore, peerMedian)) {
    return {
      status: 'pass',
      flags: [],
      material_explanation: productFamilies,
      ...baseResult,
    }
  }

  return {
    status: 'flag',
    flags: [
      {
        code: 'SCORE_SUBCATEGORY_OUTLIER',
        message: `PAC score ${productScore} is ${delta.toFixed(0)} points from ${scopeLabel} peer median ${peerMedian} without a clear material explanation`,
        context: {
          subcategory,
          comparison_scope,
          product_score: productScore,
          peer_median: peerMedian,
          peer_count: peerScoresOnly.length,
          delta,
          product_families: productFamilies,
        },
      },
    ],
    ...baseResult,
  }
}
