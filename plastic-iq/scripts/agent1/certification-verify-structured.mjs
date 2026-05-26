/**
 * Verify claimed_certifications → verified_certifications | claimed_but_not_verified
 * via live certifying-body registry search (Perplexity site search + registry page fetch).
 */
import { loadEnv } from '../lib/env.mjs'
import { isCertifyingBodyCredential } from './certification-classify.mjs'
import { certificationAppearsInText } from './certification-verify.mjs'
import {
  appendRegistrySource,
  urlMatchesRegistryDomain,
  resolveRegistryConfig,
  verifyCertAgainstRegistry,
} from './certification-registry-verify.mjs'

function buildCorpusFromSources(sources) {
  return (sources ?? []).map((s) => [s.page_excerpt, s.title, s.url].filter(Boolean).join('\n'))
}

function findClaimMentionUrl(certName, sources, corpus) {
  for (let i = 0; i < corpus.length; i++) {
    if (certificationAppearsInText(certName, corpus[i])) {
      return sources[i]?.url ?? null
    }
  }
  return sources[0]?.url ?? null
}

function isNegativeInventoryRow(name) {
  return /no third.party|not found|e\.g\.\s*,\s*made safe|none found/i.test(name)
}

function filterStaleRegistryWarnings(warnings) {
  return (warnings ?? []).filter(
    (w) =>
      typeof w === 'string' &&
      !/registry verification not performed/i.test(w) &&
      !/in-memory only/i.test(w),
  )
}

/**
 * @param {{
 *   structured_evidence: object,
 *   sources: object[],
 *   agent_metadata: object,
 *   product: { brand?: string, product_name?: string },
 * }} packet
 */
export async function enforceStructuredCertificationVerification(packet) {
  const structured = packet.structured_evidence
  let sources = [...(packet.sources ?? [])]
  const corpus = buildCorpusFromSources(sources)
  const env = loadEnv()
  const product = packet.product ?? {}

  const claimed = (structured.certifications.claimed_certifications ?? []).filter(
    (c) => c && !isNegativeInventoryRow(c) && isCertifyingBodyCredential(c),
  )

  const verified = []
  const notVerified = []
  const registryChecks = []
  const today = new Date().toISOString().slice(0, 10)
  let registryCostUsd = 0

  for (const certName of claimed) {
    const claim_source_url = findClaimMentionUrl(certName, sources, corpus)
    console.log(`  [registry] Checking "${certName}"…`)

    const result = await verifyCertAgainstRegistry({
      certName,
      product,
      env,
      sources,
    })
    registryCostUsd += result.cost_usd ?? 0

    registryChecks.push({
      cert_name: certName,
      verified: result.verified,
      registry_url: result.registry_url ?? null,
      registry_check_result: result.registry_check_result ?? null,
      search_query: result.search_query ?? null,
      detail: result.detail ?? null,
      steps: result.steps ?? null,
    })

    if (result.verified && result.registry_url) {
      const config = resolveRegistryConfig(certName)
      if (!config || !urlMatchesRegistryDomain(result.registry_url, config)) {
        notVerified.push({
          cert_name: certName,
          claim_source_url,
          registry_check_result: 'NOT_FOUND',
        })
        continue
      }
      verified.push({
        cert_name: certName,
        source_url: result.registry_url,
        registry_url: result.registry_url,
        retrieved_date: today,
      })
      sources = appendRegistrySource(sources, result.registry_url, certName)
    } else {
      notVerified.push({
        cert_name: certName,
        claim_source_url,
        registry_check_result: result.registry_check_result ?? 'NOT_FOUND',
      })
    }
  }

  structured.certifications.claimed_certifications = claimed
  structured.certifications.verified_certifications = verified
  structured.certifications.claimed_but_not_verified = notVerified

  const warnings = filterStaleRegistryWarnings(packet.agent_metadata?.warnings)
  warnings.push(
    `Registry verification: ${verified.length} verified in certifying-body registries, ${notVerified.length} claimed_but_not_verified (${claimed.length} cert claims checked; est. registry search cost $${registryCostUsd.toFixed(4)}).`,
  )

  return {
    ...packet,
    sources,
    structured_evidence: structured,
    agent_metadata: {
      ...packet.agent_metadata,
      registry_verification: registryChecks,
      certifications_verified: verified.map((v) => ({
        certification_name: v.cert_name,
        source_url: v.source_url,
        found_in_page_content: true,
        action_taken: 'kept — registry verified',
      })),
      warnings,
    },
    verified_count: verified.length,
    removed_count: notVerified.length,
  }
}
