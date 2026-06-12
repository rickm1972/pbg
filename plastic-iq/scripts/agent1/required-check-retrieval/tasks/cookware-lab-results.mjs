import { analyzeLabResultRetrieval, requiresLabResultRetrieval } from '../../../../src/shared/agent1/lab-result-retrieval.mjs'
import { classifyLabResultSource } from '../../../../src/shared/agent1/source-authority.mjs'
import { fetchManufacturerPdpEvidence } from '../../../../src/shared/agent1/manufacturer-pdp-modal-extraction.mjs'
import { fillQueryTemplate, runPerplexityQuery } from '../perplexity-query.mjs'
import { getRetrievalTaskForCheck } from '../../../../src/shared/required-evidence-retrieval/retrieval-task-registry.mjs'

const CHECK_ID = 'external.coated_product_lab_results'

/**
 * @param {object} ctx
 */
export async function runCoatedProductLabResultsRetrieval(ctx) {
  const { product, structured, sources, env } = ctx
  const mappings = structured?.canonical_mappings ?? {}
  const attempts = []
  /** @type {{ url: string, title: string, excerpt: string, source_type: string }[]} */
  const newSources = []

  if (!requiresLabResultRetrieval(mappings, structured)) {
    return {
      check_id: CHECK_ID,
      status: 'not_applicable',
      detail: 'Lab-result retrieval not required for this material pattern.',
      retrieval_attempts: attempts,
      timestamp: new Date().toISOString(),
      newSources,
    }
  }

  let analysis = analyzeLabResultRetrieval(sources, structured)

  const providedMfrUrl = product?.manufacturer_product_url?.trim()
  if (providedMfrUrl && !analysis.retrieved_lab_result) {
    try {
      const pdp = await fetchManufacturerPdpEvidence(providedMfrUrl)
      if (pdp.has_lab_modal_evidence && pdp.modal_excerpt) {
        attempts.push({
          goal: 'manufacturer_pdp_modal_lab',
          query: providedMfrUrl,
          result_count: pdp.modal_blocks?.length ?? 1,
          urls: [providedMfrUrl],
        })
        newSources.push({
          url: providedMfrUrl,
          title: 'Manufacturer PDP — modal lab evidence',
          excerpt: pdp.modal_excerpt,
          page_excerpt: pdp.modal_excerpt,
          source_type: 'manufacturer',
          manufacturer_modal_evidence: true,
        })
        analysis = analyzeLabResultRetrieval([...sources, ...newSources], structured)
      }
    } catch (err) {
      attempts.push({
        goal: 'manufacturer_pdp_modal_lab',
        query: providedMfrUrl,
        result_count: 0,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const task = getRetrievalTaskForCheck(CHECK_ID)
  const apiKey = env.PERPLEXITY_API_KEY

  if (apiKey && task && !analysis.retrieved_lab_result) {
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
          if (!hit.snippet) continue
          newSources.push({
            url: hit.url,
            title: hit.title || 'Lab / test result reference',
            excerpt: hit.snippet,
            source_type: /lab|test|coa/i.test(hit.snippet) ? 'manufacturer' : 'context',
          })
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
    analysis = analyzeLabResultRetrieval([...sources, ...newSources], structured)
  }

  let status = 'passed'
  let detail = 'Lab-result retrieval evaluated for coated product claims.'

  if (analysis.link_not_retrieved) {
    status = 'failed'
    detail = 'LAB_RESULTS_LINK_NOT_RETRIEVED: claim references lab results but linked report was not retrieved.'
  } else if (!analysis.retrieved_lab_result) {
    status = 'failed'
    detail =
      'NO_THIRD_PARTY_TESTING_FOUND: targeted lab-result search did not retrieve PFAS/PTFE test evidence for coated product claims.'
  } else {
    const classes = analysis.lab_sources.map((s) => s.classification).join(', ')
    detail = `Lab/testing evidence retrieved (${classes || 'manufacturer_published_third_party_lab_result'}).`
  }

  const primaryLab = analysis.lab_sources[0]
  return {
    check_id: CHECK_ID,
    status,
    source_url: primaryLab?.url ?? null,
    source_quote: primaryLab?.title ?? null,
    retrieval_attempts: attempts,
    timestamp: new Date().toISOString(),
    detail,
    newSources,
    lab_assessment: analysis,
  }
}

export { classifyLabResultSource, CHECK_ID }
