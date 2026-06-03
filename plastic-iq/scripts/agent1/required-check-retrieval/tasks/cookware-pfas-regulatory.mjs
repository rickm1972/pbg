import { fetchPageText } from '../../../lib/fetch-page-text.mjs'
import { fillQueryTemplate, runPerplexityQuery } from '../perplexity-query.mjs'
import { getRetrievalTaskForCheck } from '../../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'

const MN_PCA_URL = 'https://www.pca.state.mn.us/air-water-land-climate/2025-pfas-prohibitions'
const MN_STATUTE_URL = 'https://www.revisor.mn.gov/statutes/cite/116.943'

const MN_COOKWARE_QUOTE =
  'Starting Jan. 1, 2025, Minnesota prohibits sale of cookware containing intentionally added PFAS under Amara\'s Law (Minn. Stat. § 116.943). MPCA: cookware includes items with nonstick PFAS food-contact coatings; Teflon™ (PTFE) is prohibited in cookware.'

/**
 * @param {object} ctx
 * @param {object} ctx.product
 * @param {object} ctx.structured
 * @param {object[]} ctx.sources
 * @param {import('../../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs').RetrievalTaskDefinition} ctx.task
 * @param {{ PERPLEXITY_API_KEY?: string }} ctx.env
 */
export async function runCookwarePfasRegulatoryRetrieval(ctx) {
  const { product, structured, sources, env } = ctx
  const task = getRetrievalTaskForCheck('external.regulatory_pfas_minnesota_review')
  const attempts = []
  /** @type {{ url: string, title: string, excerpt: string, source_type: string }[]} */
  const newSources = []

  const mappings = structured?.canonical_mappings
  const primaryId = mappings?.primary_contact_material_id?.canonical_id ?? ''
  const pfasId = mappings?.pfas_status_id?.canonical_id ?? ''
  const intentionallyAdded = /pfas_intentionally_added|pfas_present/.test(pfasId)

  // Existing manufacturer nonstick source
  const mfrNonstick =
    sources.find((s) => /aboutnonstick|nonstick|pfas|ptfe/i.test(`${s.url} ${s.title}`)) ??
    structured?.retailer_links?.manufacturer_direct_url

  /** Official Minnesota PCA */
  try {
    const text = await fetchPageText(MN_PCA_URL)
    attempts.push({ goal: 'official_mn_pca', query: MN_PCA_URL, result_count: 1, urls: [MN_PCA_URL] })
    const quote = extractMnPcaQuote(text)
    if (/cookware/i.test(text) && /intentionally added/i.test(text)) {
      newSources.push({
        url: MN_PCA_URL,
        title: 'Minnesota PCA — 2025 PFAS prohibitions',
        excerpt: quote || MN_COOKWARE_QUOTE,
        source_type: 'regulatory',
      })
    }
  } catch (err) {
    attempts.push({
      goal: 'official_mn_pca',
      query: MN_PCA_URL,
      result_count: 0,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  try {
    const statuteText = await fetchPageText(MN_STATUTE_URL, { maxChars: 6000 })
    attempts.push({ goal: 'official_mn_statute', query: MN_STATUTE_URL, result_count: 1, urls: [MN_STATUTE_URL] })
    if (/cookware/i.test(statuteText) && /intentionally added/i.test(statuteText)) {
      const statuteQuote = statuteText.match(/Cookware.{0,200}intentionally added.{0,120}/i)?.[0]
      newSources.push({
        url: MN_STATUTE_URL,
        title: 'Minn. Stat. § 116.943 — Products containing PFAS',
        excerpt: statuteQuote ?? 'Cookware with intentionally added PFAS prohibited from Jan. 1, 2025 in Minnesota.',
        source_type: 'government',
      })
    }
  } catch (err) {
    attempts.push({
      goal: 'official_mn_statute',
      query: MN_STATUTE_URL,
      result_count: 0,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  const apiKey = env.PERPLEXITY_API_KEY
  if (apiKey && task) {
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
        for (const hit of search.results.slice(0, 2)) {
          if (/not sold|no longer (sold|available)|withdrawn|discontinued/i.test(hit.snippet) && /minnesota|mn\b/i.test(hit.snippet)) {
            newSources.push({
              url: hit.url,
              title: hit.title || 'Manufacturer MN distribution',
              excerpt: hit.snippet,
              source_type: 'manufacturer',
            })
          }
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
  }

  const mnExemption = newSources.some(
    (s) => /not sold|withdrawn|discontinued|no longer/i.test(s.excerpt) && /minnesota|mn\b/i.test(s.excerpt),
  )

  const mnOfficial = newSources.some((s) => s.url.includes('pca.state.mn.us') || s.url.includes('revisor.mn.gov'))

  let status = 'failed'
  let detail = null
  let source_url = null
  let source_quote = null
  /** @type {string[]} */
  const canonical_ids_added = []

  if (mnExemption) {
    status = 'passed'
    const ex = newSources.find((s) => /not sold|withdrawn/i.test(s.excerpt))
    source_url = ex?.url ?? null
    source_quote = ex?.excerpt ?? null
    detail =
      'Manufacturer/retailer source indicates product not sold in Minnesota (distribution exemption documented; not SKU-specific ban language).'
  } else if (mnOfficial && intentionallyAdded) {
    status = 'passed'
    const reg = newSources.find((s) => s.url.includes('pca.state.mn.us')) ?? newSources[0]
    source_url = reg.url
    source_quote = reg.excerpt
    canonical_ids_added.push('minnesota_pfas_ban_2025')
    detail =
      'Minnesota 2025 PFAS cookware prohibition is applicable/relevant: product is cookware and evidence shows intentionally added PFAS/PTFE nonstick. Category/material applicability from official PCA/statute — not confirmation that this exact SKU is banned in Minnesota.'
  } else if (mnOfficial) {
    status = 'passed'
    const reg = newSources[0]
    source_url = reg.url
    source_quote = reg.excerpt
    canonical_ids_added.push('minnesota_pfas_ban_2025')
    detail =
      'Minnesota regulatory applicability documented from official government source (cookware + intentionally added PFAS). Confirm PFAS intent on product; not SKU-specific ban confirmation.'
  } else {
    status = 'failed'
    detail =
      'Retrieval did not obtain Minnesota PCA/statute source or manufacturer MN distribution statement. Re-run retrieval or add source manually.'
  }

  if (mfrNonstick && typeof mfrNonstick === 'object' && mfrNonstick.url) {
    attempts.push({
      goal: 'existing_manufacturer_nonstick',
      query: mfrNonstick.url,
      result_count: 1,
      urls: [mfrNonstick.url],
    })
  }

  return {
    check_id: 'external.regulatory_pfas_minnesota_review',
    status,
    source_url,
    source_quote,
    canonical_ids_added,
    retrieval_attempts: attempts,
    timestamp: new Date().toISOString(),
    detail,
    newSources,
    applicability: {
      primary_contact_material_id: primaryId,
      pfas_status_id: pfasId,
      intentionally_added_pfas: intentionallyAdded,
      mn_ban_applies_to_cookware_nonstick: mnOfficial && intentionallyAdded,
    },
  }
}

/**
 * @param {string} text
 */
function extractMnPcaQuote(text) {
  const cookware = text.match(/Cookware[\s\S]{0,400}/i)?.[0]
  if (cookware) return cookware.slice(0, 380).trim()
  const teflon = text.match(/Teflon[\s\S]{0,200}/i)?.[0]
  return teflon?.slice(0, 200).trim() ?? MN_COOKWARE_QUOTE
}
