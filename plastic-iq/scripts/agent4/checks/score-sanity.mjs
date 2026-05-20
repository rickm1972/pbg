/**
 * Check 3 — Score sanity vs subcategory peers (approved scores only).
 */
import { SCORE_SANITY_DELTA_THRESHOLD } from '../constants.mjs'

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

function materialExplainsOutlier(productFamilies, peerFamilySets, productScore, peerMedian) {
  if (!productFamilies.length) return false
  const uniqueFamily = productFamilies.find((f) => {
    const peerCount = peerFamilySets.filter((set) => set.includes(f)).length
    return peerCount <= Math.max(0, Math.floor(peerFamilySets.length * 0.25))
  })
  if (uniqueFamily) return true
  if (productScore < peerMedian - SCORE_SANITY_DELTA_THRESHOLD) {
    const riskFamilies = ['nylon', 'ptfe', 'tritan', 'ceramic_nonstick']
    if (productFamilies.some((f) => riskFamilies.includes(f))) return true
  }
  if (productScore > peerMedian + SCORE_SANITY_DELTA_THRESHOLD) {
    const safeFamilies = ['cast_iron', 'glass', 'soap', 'stainless']
    if (productFamilies.some((f) => safeFamilies.includes(f))) return true
  }
  return false
}

/**
 * @param {object} params
 * @param {object} params.product — products row
 * @param {object} params.inputs
 * @param {object} params.score — audited product_scores row
 * @param {object[]} params.peerScores — other approved scores in same subcategory
 */
function peerPacScore(peer) {
  const raw = peer?.score?.pac_safety_score ?? peer?.pac_safety_score
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function runScoreSanity({ product, inputs, score, peerScores }) {
  const subcategory = product.subcategory ?? null
  const productScore = Number(score.pac_safety_score)
  const peerScoresOnly = (peerScores ?? [])
    .map((p) => peerPacScore(p))
    .filter((n) => n != null)

  if (peerScoresOnly.length < 2) {
    return {
      status: 'skip',
      flags: [],
      subcategory,
      product_score: productScore,
      peer_median: null,
      peer_count: peerScoresOnly.length,
      delta_from_median: null,
      skip_reason: 'insufficient_peers',
    }
  }

  const peerMedian = median(peerScoresOnly)
  const delta = Math.abs(productScore - peerMedian)
  const productMaterial = primaryContactMaterial(inputs, score)
  const productFamilies = detectFamilies(productMaterial)
  const peerFamilySets = (peerScores ?? []).map((p) =>
    detectFamilies(primaryContactMaterial(p.inputs ?? p, p.score ?? p)),
  )

  if (delta <= SCORE_SANITY_DELTA_THRESHOLD) {
    return {
      status: 'pass',
      flags: [],
      subcategory,
      product_score: productScore,
      peer_median: peerMedian,
      peer_count: peerScoresOnly.length,
      delta_from_median: delta,
    }
  }

  if (materialExplainsOutlier(productFamilies, peerFamilySets, productScore, peerMedian)) {
    return {
      status: 'pass',
      flags: [],
      subcategory,
      product_score: productScore,
      peer_median: peerMedian,
      peer_count: peerScoresOnly.length,
      delta_from_median: delta,
      material_explanation: productFamilies,
    }
  }

  return {
    status: 'flag',
    flags: [
      {
        code: 'SCORE_SUBCATEGORY_OUTLIER',
        message: `PAC score ${productScore} is ${delta.toFixed(0)} points from subcategory peer median ${peerMedian} without a clear material explanation`,
        context: {
          subcategory,
          product_score: productScore,
          peer_median: peerMedian,
          peer_count: peerScoresOnly.length,
          delta,
          product_families: productFamilies,
        },
      },
    ],
    subcategory,
    product_score: productScore,
    peer_median: peerMedian,
    peer_count: peerScoresOnly.length,
    delta_from_median: delta,
  }
}
