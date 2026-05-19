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
import { evaluateMinimumThreshold } from './threshold.mjs'

export async function runAgent1({ productId, productName, dryRun = false }) {
  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const id = product.product_id
  console.log(`\n=== Agent 1: ${product.product_name} (${id}) ===\n`)

  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'evidence_in_progress')
    console.log('Step 1: agent_status → evidence_in_progress')
  } else {
    console.log('Step 1: (dry run) skip status update')
  }

  let packet
  try {
    console.log('Steps 2–4: researching product (web search + extraction)…')
    packet = await researchProduct(product)
  } catch (err) {
    if (!dryRun) await updateAgentStatus(supabase, id, 'evidence_pending')
    throw err
  }

  if (dryRun) {
    const threshold = evaluateMinimumThreshold(packet.sources, packet.facts)
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

  const threshold = evaluateMinimumThreshold(packet.sources, packet.facts)
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
    })

    await updateAgentStatus(supabase, id, 'evidence_pending')
    console.log('Agent stopped: In Testing Queue (agent_status → evidence_pending, review_status → draft)')

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
  const submittedAt = new Date().toISOString()
  const evidence = await insertEvidence(supabase, {
    product_id: id,
    bundle_version: bundleVersion,
    review_status: 'submitted',
    algorithm_version: ALGORITHM_VERSION,
    sources: packet.sources,
    facts: packet.facts,
    agent_metadata: packet.agent_metadata,
    submitted_at: submittedAt,
  })

  await updateAgentStatus(supabase, id, 'evidence_awaiting_review')
  console.log('Steps 6–7: evidence saved, review_status → submitted, agent_status → evidence_awaiting_review')

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
    lines.push(
      `\nAPI usage: anthropic_api_calls=${usage.anthropic_api_calls ?? 1} input=${usage.input_tokens ?? 0} output=${usage.output_tokens ?? 0} web_searches=${usage.web_search_requests ?? 0} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0} est_cost=$${(usage.estimated_cost_usd ?? 0).toFixed(4)}`,
    )
  }

  return lines.join('\n')
}
