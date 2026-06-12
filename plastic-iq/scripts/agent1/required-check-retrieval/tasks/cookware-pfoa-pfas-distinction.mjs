import { fetchPageText } from '../../../lib/fetch-page-text.mjs'
import { isCeramicNonstickPrimary } from '../../../../src/shared/canonical-taxonomy/ceramic-nonstick-structural.mjs'
import { isHybridFoodContactPrimary } from '../../../../src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs'
import { PTFE_PRIMARY_IDS } from '../../../../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import { getRetrievalTaskForCheck } from '../../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'
import { fillQueryTemplate, runPerplexityQuery } from '../perplexity-query.mjs'
import {
  isOutdatedThirdPartyPtfeContext,
  isThirdPartySource,
} from '../../../../src/shared/agent1/source-authority.mjs'
import { manufacturerHostMatchesBrand } from '../../../../src/shared/agent1/manufacturer-pdp-validation.mjs'

const CHECK_ID = 'external.pfoa_vs_pfas_free_distinction'

const PFAS_PRESENT_STATUS_IDS = new Set([
  'pfas_present_disclosed',
  'pfas_intentionally_added_disclosed',
])

const PFOA_RE = /\bpfoa(?:s)?[-\s]?free\b|free of pfoa|no pfoa\b/i
const T_FAL_PFOA_URL = 'https://www.t-fal.ca/en/pfoas/'
const PFAS_FREE_MARKETING_RE =
  /\bpfas[-\s]?free\b|free of (all )?pfas\b|without (intentionally added )?pfas\b/i

/**
 * @param {object} ctx
 * @param {object} ctx.product
 * @param {object} ctx.structured
 * @param {object[]} ctx.sources
 * @param {{ PERPLEXITY_API_KEY?: string }} ctx.env
 */
export async function runCookwarePfoaPfasDistinctionRetrieval(ctx) {
  const { product, structured, sources, env } = ctx
  const attempts = []
  /** @type {{ url: string, title: string, excerpt: string, source_type: string }[]} */
  const newSources = []

  let analysis = analyzePfoaPfasClaims(structured, sources, product)

  if (!analysis.pfoa.source_quote) {
    const fetched = await fetchPfoaFromProductPages(sources, product, attempts)
    if (fetched.length) {
      newSources.push(...fetched)
      analysis = analyzePfoaPfasClaims(
        structured,
        [...sources, ...fetched.map(toSourceShape)],
        product,
      )
    }
  }

  const task = getRetrievalTaskForCheck(CHECK_ID)
  const apiKey = env.PERPLEXITY_API_KEY
  if (apiKey && task && !analysis.pfoa.source_quote) {
    for (const tpl of task.query_templates) {
      const query = fillQueryTemplate(tpl.queryTemplate, product)
      try {
        const search = await runPerplexityQuery({ apiKey, query })
        attempts.push({
          goal: tpl.goal,
          query,
          result_count: search.result_count,
          urls: search.results.map((r) => r.url),
        })
        for (const hit of search.results.slice(0, 3)) {
          if (!isProductScopedUrl(hit.url, product)) continue
          mergeHitIntoAnalysis(hit, newSources)
        }
      } catch (err) {
        attempts.push({
          goal: tpl.goal,
          query,
          result_count: 0,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    analysis = analyzePfoaPfasClaims(structured, [...sources, ...newSources.map(toSourceShape)], product)
  }

  const mappings = structured?.canonical_mappings ?? {}
  const pfasStatusId = mappings.pfas_status_id?.canonical_id ?? ''
  const primaryId = mappings.primary_contact_material_id?.canonical_id ?? ''
  const hybridOrProprietary =
    isHybridFoodContactPrimary(primaryId) ||
    mappings.coating_modifier_id?.canonical_id === 'proprietary_nonstick_coating_undisclosed' ||
    isCeramicNonstickPrimary(primaryId)
  const ptfeOrPfasPresent =
    !hybridOrProprietary &&
    (PTFE_PRIMARY_IDS.has(primaryId) || PFAS_PRESENT_STATUS_IDS.has(pfasStatusId))

  let status = 'failed'
  let detail = null
  let source_url = null
  let source_quote = null
  /** @type {string[]} */
  const canonical_ids_added = []

  const claimRecord = formatClaimRecord(analysis)

  if (analysis.conflation.detected) {
    status = 'failed'
    detail = `${analysis.conflation.reason} ${claimRecord}`
    source_url = analysis.pfoa.source_url ?? analysis.pfas_free_marketing.source_url
    source_quote = analysis.pfoa.source_quote ?? analysis.pfas_free_marketing.source_quote
  } else if (
    analysis.pfas_free_marketing.claimed &&
    !analysis.pfas_free_marketing.independently_sourced
  ) {
    status = 'failed'
    detail = `PFAS-free marketing appears without independent verification (do not infer from PFOA-free alone). ${claimRecord}`
    source_url = analysis.pfas_free_marketing.source_url ?? analysis.pfoa.source_url
    source_quote = analysis.pfas_free_marketing.source_quote ?? analysis.pfoa.source_quote
  } else if (pfasStatusId === 'pfas_free_claimed' && !analysis.pfas_free_marketing.independently_sourced) {
    status = 'failed'
    detail = `Canonical pfas_status_id is pfas_free_claimed but PFAS-free is not separately documented — likely PFOA-free conflation. ${claimRecord}`
    source_url = mappings.pfas_status_id?.source_url ?? analysis.pfoa.source_url
    source_quote = mappings.pfas_status_id?.source_quote ?? analysis.pfoa.source_quote
  } else if (
    ptfeOrPfasPresent &&
    analysis.pfas_free_marketing.claimed &&
    analysis.pfas_free_marketing.independently_sourced
  ) {
    status = 'passed'
    detail = `PFOA-free and PFAS-free are both product-marketing claims with separate source support; distinction preserved. pfas_status=${pfasStatusId || 'n/a'}. ${claimRecord}`
    source_url = analysis.pfoa.source_url ?? analysis.pfas_free_marketing.source_url
    source_quote = [analysis.pfoa.source_quote, analysis.pfas_free_marketing.source_quote]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 500)
  } else if (ptfeOrPfasPresent) {
    const pfasStatusOk =
      !pfasStatusId ||
      PFAS_PRESENT_STATUS_IDS.has(pfasStatusId) ||
      pfasStatusId === 'pfas_unknown'

    if (!pfasStatusOk && pfasStatusId === 'pfas_free_claimed') {
      status = 'failed'
      detail = `PFAS-present product must not use pfas_free_claimed without PFAS-free marketing source. pfas_status=${pfasStatusId || 'n/a'}. ${claimRecord}`
    } else {
      status = 'passed'
      detail = analysis.pfoa.claimed
        ? `PFOA-free documented with source; PFAS-free marketing not claimed or inferred from PFOA-only copy. pfas_status=${pfasStatusId || 'n/a'}. ${claimRecord}`
        : `No PFOA-free marketing claim found (recorded); PFAS-free not inferred. pfas_status=${pfasStatusId || 'n/a'}. ${claimRecord}`
      source_url = analysis.pfoa.source_url
      source_quote = analysis.pfoa.source_quote
      if (analysis.pfoa.claimed && !mappings.safety_claim_ids?.pfoa_free_claim) {
        canonical_ids_added.push('pfoa_free_claim')
      }
    }
  } else {
    status = 'passed'
    detail = `PFOA/PFAS distinction documented for non-PTFE trigger context. pfas_status=${pfasStatusId || 'n/a'}. ${claimRecord}`
    source_url = analysis.pfoa.source_url ?? analysis.pfas_free_marketing.source_url
    source_quote = analysis.pfoa.source_quote ?? analysis.pfas_free_marketing.source_quote
  }

  if (status === 'failed' && !source_url && !source_quote && ptfeOrPfasPresent) {
    detail = `Sources are ambiguous — cannot document PFOA-free vs PFAS-free distinction. ${claimRecord}`
  }

  return {
    check_id: CHECK_ID,
    status,
    source_url,
    source_quote,
    canonical_ids_added,
    retrieval_attempts: attempts,
    timestamp: new Date().toISOString(),
    detail,
    newSources,
    claim_assessment: analysis.summary,
  }
}

/**
 * @param {object} structured
 * @param {object[]} sources
 * @param {{ brand?: string, product_name?: string }} product
 */
function analyzePfoaPfasClaims(structured, sources, product) {
  const mappings = structured?.canonical_mappings ?? {}
  const sc = structured?.safety_claims ?? {}

  /** @type {ReturnType<typeof emptyPfoa>} */
  const pfoa = emptyPfoa()
  /** @type {ReturnType<typeof emptyPfasFree>} */
  const pfas_free_marketing = emptyPfasFree()
  const conflation = { detected: false, reason: null }

  if (sc.pfoa_free_claim?.claimed) {
    pfoa.claimed = true
    pfoa.source_url = sc.pfoa_free_claim.source_url ?? pfoa.source_url
    pfoa.source_quote = sc.pfoa_free_claim.source_quote ?? pfoa.source_quote
  }
  if (sc.pfas_free_claim?.claimed) {
    const q = `${sc.pfas_free_claim.source_quote ?? ''}`
    if (/\bpfas[-\s]?free\b/i.test(q)) {
      pfas_free_marketing.claimed = true
      pfas_free_marketing.absent = false
      pfas_free_marketing.source_url = sc.pfas_free_claim.source_url ?? pfas_free_marketing.source_url
      pfas_free_marketing.source_quote = sc.pfas_free_claim.source_quote ?? pfas_free_marketing.source_quote
    }
  }

  const pfoaMap = mappings.safety_claim_ids?.pfoa_free_claim
  const pfasMap = mappings.safety_claim_ids?.pfas_free_marketing_claim
  if (pfoaMap && pfoaMap.canonical_id === 'pfoa_free_claim') {
    pfoa.claimed = true
    pfoa.source_url = pfoa.source_url ?? pfoaMap.source_url
    pfoa.source_quote = pfoa.source_quote ?? pfoaMap.source_quote
  }
  if (pfasMap?.canonical_id === 'pfas_free_marketing_claim') {
    pfas_free_marketing.claimed = true
    pfas_free_marketing.absent = false
    pfas_free_marketing.source_url = pfas_free_marketing.source_url ?? pfasMap.source_url
    pfas_free_marketing.source_quote = pfas_free_marketing.source_quote ?? pfasMap.source_quote
  }

  const officialSources = (sources ?? []).filter((s) => !isThirdPartySource(s, s.url))

  for (const s of sources ?? []) {
    if (isRegulatorySource(s)) continue
    if (isOutdatedThirdPartyPtfeContext(s, product, officialSources)) continue
    const text = `${s.page_excerpt ?? ''} ${s.title ?? ''}`.trim()
    if (!text) continue
    const productScoped = isProductScopedSource(s, product)

    if (PFOA_RE.test(text) && (productScoped || !pfoa.source_url)) {
      pfoa.claimed = true
      if (productScoped || !pfoa.source_url) {
        pfoa.source_url = s.url ?? pfoa.source_url
        pfoa.source_quote = extractClaimQuote(text, PFOA_RE) ?? pfoa.source_quote
      }
    }
    if (productScoped && PFAS_FREE_MARKETING_RE.test(text) && isPfasFreeProductClaim(text)) {
      pfas_free_marketing.claimed = true
      pfas_free_marketing.absent = false
      pfas_free_marketing.independently_sourced = true
      pfas_free_marketing.source_url = s.url ?? pfas_free_marketing.source_url
      pfas_free_marketing.source_quote =
        extractClaimQuote(text, PFAS_FREE_MARKETING_RE) ?? pfas_free_marketing.source_quote
    }
  }

  if (pfoa.claimed && !pfas_free_marketing.claimed) {
    pfas_free_marketing.absent = true
  }

  if (pfas_free_marketing.claimed) {
    const q = pfas_free_marketing.source_quote ?? pfasMap?.source_quote ?? ''
    const u = pfas_free_marketing.source_url ?? pfasMap?.source_url ?? null
    if (u && /\bpfas[-\s]?free\b/i.test(q)) {
      pfas_free_marketing.independently_sourced = true
    }
  }

  const pfoaUrl = pfoa.source_url ?? pfoaMap?.source_url ?? null
  const pfasUrl = pfas_free_marketing.source_url ?? pfasMap?.source_url ?? null
  const pfoaQuote = pfoa.source_quote ?? pfoaMap?.source_quote ?? ''
  const pfasQuote = pfas_free_marketing.source_quote ?? pfasMap?.source_quote ?? ''

  if (pfas_free_marketing.claimed && !pfas_free_marketing.independently_sourced) {
    if (pfoaUrl && pfasUrl && normalizeUrl(pfoaUrl) === normalizeUrl(pfasUrl)) {
      if (!/\bpfas[-\s]?free\b/i.test(pfasQuote) && PFOA_RE.test(pfoaQuote)) {
        conflation.detected = true
        conflation.reason = 'Same source URL documents PFOA-free only; PFAS-free is not independently quoted.'
      }
    }
    if (PFOA_RE.test(pfasQuote) && !/\bpfas[-\s]?free\b/i.test(pfasQuote)) {
      conflation.detected = true
      conflation.reason = 'PFAS-free marketing quote contains only PFOA-free language.'
    }
  }

  if (mappings.pfas_status_id?.canonical_id === 'pfas_free_claimed' && pfoa.claimed && !pfas_free_marketing.independently_sourced) {
    conflation.detected = true
    conflation.reason =
      'Canonical mapping uses pfas_free_claimed while evidence only supports PFOA-free (not PFAS-free).'
  }

  const summary = {
    pfoa_free: pfoa.claimed ? 'claimed' : 'not_claimed',
    pfas_free_marketing: pfas_free_marketing.claimed
      ? pfas_free_marketing.independently_sourced
        ? 'claimed_sourced'
        : 'claimed_unverified'
      : 'not_claimed',
    pfoa_not_inferred_as_pfas_free:
      !conflation.detected &&
      (!pfas_free_marketing.claimed || pfas_free_marketing.independently_sourced),
  }

  return { pfoa, pfas_free_marketing, conflation, summary }
}

/**
 * @param {ReturnType<typeof analyzePfoaPfasClaims>} analysis
 */
function formatClaimRecord(analysis) {
  return (
    `Claims: PFOA-free=${analysis.summary.pfoa_free}; PFAS-free marketing=${analysis.summary.pfas_free_marketing}; ` +
    `PFOA≠PFAS-free preserved=${analysis.summary.pfoa_not_inferred_as_pfas_free}.`
  )
}

function emptyPfoa() {
  return { claimed: false, source_url: null, source_quote: null }
}

function emptyPfasFree() {
  return {
    claimed: false,
    absent: true,
    independently_sourced: false,
    source_url: null,
    source_quote: null,
  }
}

/**
 * @param {object} s
 */
function isRegulatorySource(s) {
  const blob = `${s.source_type ?? ''} ${s.url ?? ''} ${s.title ?? ''}`.toLowerCase()
  return /regulatory|government|statute|revisor\.mn|pca\.state/.test(blob)
}

/**
 * @param {string} text
 * @param {RegExp} re
 */
function extractClaimQuote(text, re) {
  const idx = text.search(re)
  if (idx < 0) return null
  const start = Math.max(0, idx - 40)
  return text.slice(start, idx + 120).replace(/\s+/g, ' ').trim()
}

/**
 * @param {{ url: string, title?: string, snippet: string }} hit
 * @param {object[]} newSources
 */
function mergeHitIntoAnalysis(hit, newSources) {
  if (!hit.url || !hit.snippet) return
  newSources.push({
    url: hit.url,
    title: hit.title || 'Retailer / manufacturer claim copy',
    excerpt: hit.snippet,
    source_type: 'retailer',
  })
}

/**
 * @param {string} text
 */
function isPfasFreeProductClaim(text) {
  if (!/\bpfas[-\s]?free\b/i.test(text)) return false
  if (/pfas[-\s]?free alternative|avoid pfas|want to avoid|consumer reports|guide|comparison/i.test(text)) {
    return false
  }
  return /\b(this|our|product|pan|cookware|set|coating)\b.*pfas[-\s]?free|pfas[-\s]?free.*\b(pan|cookware|coating|product)\b/i.test(
    text,
  )
}

/**
 * @param {object} s
 * @param {{ brand?: string, product_name?: string }} product
 */
function isProductScopedSource(s, product) {
  return isProductScopedUrl(s.url, product) || mentionsProduct(s, product)
}

/**
 * @param {string | null | undefined} url
 * @param {{ brand?: string, product_name?: string }} product
 */
function isProductScopedUrl(url, product) {
  if (!url) return false
  const u = url.toLowerCase()
  const brand = (product.brand ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (brand && u.includes(brand)) return true
  if (brand && manufacturerHostMatchesBrand(url, product.brand)) return true
  if (/amazon\.com\/.*\/(dp|gp\/product)\//i.test(u)) return true
  return false
}

/**
 * @param {object} s
 * @param {{ brand?: string, product_name?: string }} product
 */
function mentionsProduct(s, product) {
  const blob = `${s.title ?? ''} ${s.page_excerpt ?? ''}`.toLowerCase()
  const brand = (product.brand ?? '').toLowerCase()
  if (brand && blob.includes(brand.replace(/\s+/g, ''))) return true
  const name = (product.product_name ?? '').toLowerCase()
  if (name.length > 12 && blob.includes(name.slice(0, 24))) return true
  return false
}

/**
 * @param {{ url: string, title: string, excerpt: string, source_type: string }} add
 */
function toSourceShape(add) {
  return {
    url: add.url,
    title: add.title,
    page_excerpt: add.excerpt,
    source_type: add.source_type,
  }
}

/**
 * @param {string | null} url
 */
function normalizeUrl(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`.replace(/\/$/, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/**
 * @param {object[]} sources
 * @param {{ brand?: string, product_name?: string }} product
 * @param {object[]} attempts
 */
async function fetchPfoaFromProductPages(sources, product, attempts) {
  /** @type {{ url: string, title: string, excerpt: string, source_type: string }[]} */
  const additions = []
  const brand = (product.brand ?? '').toLowerCase()
  if (brand.includes('t-fal') || brand.includes('tfal')) {
    const official = await tryFetchPfoaQuote(T_FAL_PFOA_URL, attempts, 'manufacturer')
    if (official) return [official]
  }

  const urls = new Set()
  for (const s of sources ?? []) {
    if (!isProductScopedSource(s, product) || !s.url) continue
    if (urls.has(s.url)) continue
    urls.add(s.url)
  }
  for (const url of [...urls].slice(0, 4)) {
    const hit = await tryFetchPfoaQuote(
      url,
      attempts,
      /amazon/i.test(url) ? 'amazon' : 'manufacturer',
    )
    if (hit) {
      additions.push(hit)
      break
    }
  }
  return additions
}

/**
 * @param {string} url
 * @param {object[]} attempts
 * @param {string} source_type
 */
async function tryFetchPfoaQuote(url, attempts, source_type) {
  try {
    const text = await fetchPageText(url, { maxChars: 8000 })
    attempts.push({ goal: 'fetch_product_page', query: url, result_count: 1, urls: [url] })
    if (!PFOA_RE.test(text)) return null
    return {
      url,
      title: 'PFOA-free brand disclosure',
      excerpt: extractClaimQuote(text, PFOA_RE) ?? text.slice(0, 280),
      source_type,
    }
  } catch (err) {
    attempts.push({
      goal: 'fetch_product_page',
      query: url,
      result_count: 0,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
