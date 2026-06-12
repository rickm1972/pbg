import { bridgeLegacyFacts, bridgeCertificationsVerified } from './bridge-legacy.mjs'
import { ALGORITHM_VERSION } from './types.mjs'
import {
  createServiceClient,
  fetchProductById,
  fetchProductByName,
  insertEvidence,
  nextBundleVersion,
  updateAgentStatus,
} from './supabase.mjs'
import { researchProduct } from './research.mjs'
import { partitionCertificationsAndSafetyClaims } from './certification-classify.mjs'
import { enforceStructuredCertificationVerification } from './certification-verify-structured.mjs'
import { evaluateStructuredThreshold } from './threshold-structured.mjs'
import { buildFieldProvenance } from './field-provenance.mjs'
import { filterOutOfScopeFromFacts } from '../../src/shared/safety-signals/out-of-scope-policy.mjs'
import { detectPatternTriggers } from '../../src/shared/required-evidence-matrix/pattern-triggers.mjs'
import {
  assertRequiredExternalRetrievalComplete,
  invokeRequiredCheckRetrieval,
} from './required-check-retrieval/invoke.mjs'
import { getProductTypeRegistryPreflightError } from '../../src/shared/product-type-registry/preflight.mjs'

/** Phase 2 — persist non-authoritative proposed closed fields; never fails evidence save. */
async function tryPersistProposedInputDraft(supabase, product, evidence) {
  try {
    const { createProposedInputDraftForEvidence } = await import('./proposed-input-supabase.mjs')
    const draft = await createProposedInputDraftForEvidence(supabase, { product, evidence })
    console.log(
      `Step 7b: proposed closed-field draft saved (${draft.proposed_input_id}, status=${draft.proposal_status})`,
    )
    return draft
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Step 7b: proposed input draft failed (evidence save retained): ${message}`)
    return null
  }
}

const CANONICAL_TAXONOMY_RELOAD_MODULES = [
  'canonical-taxonomy-fallbacks.mjs',
  'hybrid-cookware-structural.mjs',
  'ceramic-nonstick-structural.mjs',
  'inert-cookware-structural.mjs',
  'primary-contact-material-taxonomy.mjs',
  'substrate-material-taxonomy.mjs',
  'coating-modifier-taxonomy.mjs',
  'compound-cookware-material.mjs',
  'map-structured-evidence.mjs',
  '../agent1/manufacturer-pdp-validation.mjs',
  '../agent1/lab-report-evidence.mjs',
  '../agent1/source-authority.mjs',
  '../agent1/lab-result-retrieval.mjs',
  '../agent1/gate1-source-validation.mjs',
]

/** Dev API sets AGENT1_RELOAD_MODULES=1 so taxonomy edits load without restarting Vite. */
async function loadCanonicalPipeline() {
  const bust = process.env.AGENT1_RELOAD_MODULES === '1' ? `?t=${Date.now()}` : ''
  if (bust) {
    await Promise.all(
      CANONICAL_TAXONOMY_RELOAD_MODULES.map((file) =>
        import(
          new URL(`../../src/shared/canonical-taxonomy/${file}${bust}`, import.meta.url).href,
        ),
      ),
    )
  }
  const mapHref = new URL(
    `../../src/shared/canonical-taxonomy/map-structured-evidence.mjs${bust}`,
    import.meta.url,
  ).href
  const assertHref = new URL(`./assert-canonical-materials.mjs${bust}`, import.meta.url).href
  const [mapMod, assertMod] = await Promise.all([import(mapHref), import(assertHref)])
  return {
    applyCanonicalMappings: mapMod.applyCanonicalMappings,
    assertCookwareMaterialsResolved: assertMod.assertCookwareMaterialsResolved,
  }
}

/**
 * Failed or interrupted Agent 1 runs must not leave products stuck on evidence_in_progress.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} productId
 * @param {string} nextStatus
 */
async function clearStuckEvidenceInProgress(supabase, productId, nextStatus) {
  const { data } = await supabase
    .from('products')
    .select('agent_status')
    .eq('product_id', productId)
    .maybeSingle()
  if (data?.agent_status === 'evidence_in_progress') {
    await updateAgentStatus(supabase, productId, nextStatus)
  }
}

export async function runAgent1({ productId, productName, dryRun = false }) {
  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const id = product.product_id
  if (product.active === false) {
    const reason = 'Product is archived (inactive) and is not in the pipeline catalog.'
    console.log(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  console.log(`\n=== Agent 1: ${product.product_name} (${id}) ===\n`)

  const registryPreflightError = getProductTypeRegistryPreflightError({ product })
  if (registryPreflightError) {
    console.log(`Stopped: ${registryPreflightError}`)
    return { ok: false, product, reason: registryPreflightError }
  }

  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'evidence_in_progress')
    console.log('Step 1: agent_status → evidence_in_progress')
  } else {
    console.log('Step 1: (dry run) skip status update')
  }

  let packet
  try {
    console.log('Steps 2–4: researching product (web search + extraction)…')
    const rawPacket = await researchProduct(product)
    let structured =
      rawPacket.structured_evidence ?? rawPacket.agent_metadata?.structured_evidence
    const partition = partitionCertificationsAndSafetyClaims(structured, rawPacket.sources)
    if (partition.routed_marketing.length) {
      console.log(
        `  Routed ${partition.routed_marketing.length} marketing claim(s) from certifications → safety_claims`,
      )
    }
    const verified = await enforceStructuredCertificationVerification({
      structured_evidence: structured,
      sources: rawPacket.sources,
      agent_metadata: rawPacket.agent_metadata,
      product,
    })
    const facts = bridgeLegacyFacts(verified.structured_evidence, verified.sources)
    packet = {
      sources: verified.sources,
      facts,
      agent_metadata: {
        ...verified.agent_metadata,
        structured_evidence: verified.structured_evidence,
        certifications_verified: bridgeCertificationsVerified(verified.structured_evidence),
      },
    }
    if (verified.removed_count > 0) {
      console.log(
        `  Certification verification removed ${verified.removed_count} claim(s) not found in returned excerpts`,
      )
    }
    console.log(
      `  certifications_verified: ${verified.verified_count} kept, ${verified.removed_count} removed`,
    )

    structured = packet.agent_metadata.structured_evidence
    const { applyCanonicalMappings, assertCookwareMaterialsResolved } = await loadCanonicalPipeline()
    applyCanonicalMappings(structured, packet.sources, {
      facts: packet.facts,
      agent_metadata: packet.agent_metadata,
    })
    assertCookwareMaterialsResolved(structured, product)
    packet.facts = filterOutOfScopeFromFacts(packet.facts)
    console.log('Step 4b: required-check retrieval (Phase 3.7)…')
    console.log(
      `  retrieval module reload=${process.env.AGENT1_RELOAD_MODULES === '1' ? 'yes' : 'no (set AGENT1_RELOAD_MODULES=1 in dev API)'}`,
    )
    const retrieval = await invokeRequiredCheckRetrieval({
      structured,
      sources: packet.sources,
      facts: packet.facts,
      product,
    })
    packet.sources = retrieval.sources
    packet.facts = bridgeLegacyFacts(structured, packet.sources)
    packet.agent_metadata.structured_evidence = structured
    packet.agent_metadata.retrieval_runner_keys = retrieval.runner_keys ?? []
    packet.agent_metadata.retrieval_execute_module = retrieval.module_id ?? null
    packet.agent_metadata.retrieval_tasks_executed = retrieval.tasks_executed ?? []
    const triggers = detectPatternTriggers(
      structured,
      structured.canonical_mappings,
      packet.sources,
    )
    assertRequiredExternalRetrievalComplete(structured, triggers)

    const sourceValidationHref = new URL(
      `../../src/shared/agent1/gate1-source-validation.mjs${process.env.AGENT1_RELOAD_MODULES === '1' ? `?t=${Date.now()}` : ''}`,
      import.meta.url,
    ).href
    const { applyAgent1SourceValidation } = await import(sourceValidationHref)
    const sourceValidation = applyAgent1SourceValidation(
      structured,
      packet.sources,
      product,
      packet.facts,
      { providedSourceIntake: packet.agent_metadata.provided_source_intake ?? null },
    )
    packet.facts = sourceValidation.facts
    if (sourceValidation.warnings.length) {
      packet.agent_metadata.warnings = [
        ...(packet.agent_metadata.warnings ?? []),
        ...sourceValidation.warnings,
      ]
    }
    if (sourceValidation.blockers.length) {
      console.log(
        `  Source validation blockers (${sourceValidation.blockers.length}) — Gate 1 human review required`,
      )
      for (const b of sourceValidation.blockers) console.log(`    - ${b}`)
    }

    if (retrieval.pending_count > 0) {
      console.log(
        `  Ran ${retrieval.results?.length ?? 0} retrieval task(s); approval_blocked=${retrieval.validation?.summary?.approval_blocked ?? 'unknown'}`,
      )
    } else {
      console.log('  No pending required-check retrieval tasks')
    }
  } catch (err) {
    if (!dryRun) {
      await clearStuckEvidenceInProgress(supabase, id, 'unscored')
      const message = err instanceof Error ? err.message : String(err)
      if (/retrieval pipeline error|No retrieval runner registered/i.test(message)) {
        console.error(`Agent 1 retrieval failure — not submitting pending_review: ${message}`)
      }
    }
    throw err
  }

  if (dryRun) {
    const threshold = evaluateStructuredThreshold(
      packet.agent_metadata.structured_evidence,
      packet.sources,
    )
    packet.agent_metadata.minimum_threshold = threshold
    return {
      ok: threshold.met,
      product,
      evidence: null,
      packet,
      threshold,
      dryRun: true,
    }
  }

  const threshold = evaluateStructuredThreshold(
    packet.agent_metadata.structured_evidence,
    packet.sources,
  )
  packet.agent_metadata.minimum_threshold = threshold

  console.log('Step 5: minimum threshold', threshold.met ? 'PASSED' : 'FAILED')
  if (!threshold.met) {
    console.log('  failures:', threshold.failures.join(', '))
  }

  const bundleVersion = await nextBundleVersion(supabase, id)

  if (!threshold.met) {
    packet.agent_metadata.in_testing_queue = true
    packet.agent_metadata.warnings = [
      ...packet.agent_metadata.warnings,
      'Minimum scoring threshold not met — held in testing queue (draft evidence saved).',
      ...threshold.failures.map((f) => `threshold_failed:${f}`),
    ]

    const draft = await insertEvidence(supabase, {
      product_id: id,
      bundle_version: bundleVersion,
      review_status: 'draft',
      algorithm_version: ALGORITHM_VERSION,
      sources: packet.sources,
      facts: packet.facts,
      agent_metadata: packet.agent_metadata,
      field_provenance: buildFieldProvenance(
        packet.agent_metadata.structured_evidence,
        packet.sources,
      ),
    })

    await updateAgentStatus(supabase, id, 'evidence_pending')
    console.log('Agent stopped: In Testing Queue (agent_status → evidence_pending, review_status → draft)')

    await tryPersistProposedInputDraft(supabase, product, draft)

    return {
      ok: false,
      product,
      evidence: draft,
      packet,
      threshold,
      queue: 'in_testing',
    }
  }

  // Steps 6–7
  const pendingReviewAt = new Date().toISOString()
  const fieldProvenance = buildFieldProvenance(
    packet.agent_metadata.structured_evidence,
    packet.sources,
  )
  const evidence = await insertEvidence(supabase, {
    product_id: id,
    bundle_version: bundleVersion,
    review_status: 'pending_review',
    algorithm_version: ALGORITHM_VERSION,
    sources: packet.sources,
    facts: packet.facts,
    agent_metadata: packet.agent_metadata,
    field_provenance: fieldProvenance,
    pending_review_at: pendingReviewAt,
  })

  await updateAgentStatus(supabase, id, 'evidence_awaiting_review')
  console.log(
    'Steps 6–7: evidence saved, review_status → pending_review, agent_status → evidence_awaiting_review',
  )

  await tryPersistProposedInputDraft(supabase, product, evidence)

  return {
    ok: true,
    product,
    evidence,
    packet,
    threshold,
  }
}

export function formatPacketSummary(result) {
  const { packet, threshold, product, evidence } = result
  const lines = [
    `Product: ${product.product_name}`,
    `Evidence ID: ${evidence?.evidence_id ?? 'n/a'}`,
    `Bundle version: ${evidence?.bundle_version ?? 'n/a'}`,
    `Threshold met: ${threshold.met}`,
    `Sources (${packet.sources.length}):`,
  ]

  for (const [i, s] of packet.sources.entries()) {
    lines.push(`  [${i}] ${s.source_type}: ${s.title}`)
    lines.push(`      ${s.url}`)
  }

  lines.push(`\nFacts (${packet.facts.length}):`)
  for (const f of packet.facts) {
    lines.push(
      `  - ${f.fact_key} (${f.confidence}): ${JSON.stringify(f.fact_value)}`,
    )
    if (f.excerpt) {
      const excerpt = f.excerpt.length > 120 ? `${f.excerpt.slice(0, 117)}…` : f.excerpt
      lines.push(`    excerpt: "${excerpt}"`)
    }
  }

  if (packet.agent_metadata.warnings?.length) {
    lines.push(`\nWarnings:`)
    for (const w of packet.agent_metadata.warnings) lines.push(`  - ${w}`)
  }

  const usage = packet.agent_metadata.api_usage
  if (usage) {
    const total = usage.total_estimated_cost_usd ?? usage.estimated_cost_usd ?? 0
    lines.push(
      `\nAPI usage: total=$${total.toFixed(4)} | Amazon web_search=${usage.web_search_requests ?? 0} $${(usage.amazon_anthropic_estimated_cost_usd ?? 0).toFixed(4)} | Perplexity=${usage.perplexity_search_requests ?? 0} $${(usage.perplexity_estimated_cost_usd ?? 0).toFixed(4)} | synthesis $${(usage.claude_estimated_cost_usd ?? 0).toFixed(4)} (${usage.anthropic_api_calls ?? 0} Claude calls, in=${usage.input_tokens ?? 0} out=${usage.output_tokens ?? 0})`,
    )
  }

  return lines.join('\n')
}
