import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from '../lib/env.mjs'
import { ALGORITHM_VERSION, AGENT_VERSION } from './version.mjs'
import { normalizeEvidence } from './normalize.mjs'
import { buildWhyThisScoreOptions } from './why-this-score-map.mjs'
import { canRunAgent2Sequential } from '../lib/pipeline-catalog.mjs'
import {
  createServiceClient,
  fetchProductById,
  fetchProductByName,
  fetchApprovedEvidence,
  fetchLatestRejectedScoringInputs,
  insertScoringInputs,
  updateAgentStatus,
} from './supabase.mjs'
import {
  cosmeticProductDescriptionWarningMessage,
  scoreBlockingNormalizationFailureMessage,
} from '../../src/shared/agent2/output-contract.mjs'
import { getProductTypeRegistryPreflightError } from '../../src/shared/product-type-registry/preflight.mjs'

/** JSON CLI mode: progress logs go to stderr so stdout is parseable JSON only. */
function agentLog(...args) {
  if (process.env.PLASTICIQ_AGENT2_JSON_CLI === '1') {
    console.error(...args)
  } else {
    console.log(...args)
  }
}

export async function runAgent2({ productId, productName, dryRun = false }) {
  const supabase = createServiceClient()
  const product = productId
    ? await fetchProductById(supabase, productId)
    : await fetchProductByName(supabase, productName)

  const id = product.product_id
  if (product.active === false) {
    const reason = 'Product is archived (inactive) and is not in the pipeline catalog.'
    agentLog(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  agentLog(`\n=== Agent 2: ${product.product_name} (${id}) ===\n`)

  const isRerun = product.agent_status === 'normalization_rejected'
  let canRun = canRunAgent2Sequential(product.agent_status)
  if (!canRun && product.agent_status === 'normalization_awaiting_review') {
    const { data: latest } = await supabase
      .from('scoring_inputs')
      .select('input_id, review_status')
      .eq('product_id', id)
      .order('run_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.review_status === 'draft') {
      canRun = true
      if (!dryRun) {
        await updateAgentStatus(supabase, id, 'evidence_approved')
        product.agent_status = 'evidence_approved'
        agentLog(
          'Step 0: reset normalization_awaiting_review → evidence_approved (failed draft — re-run)',
        )
      }
    } else if (latest?.review_status === 'pending_review') {
      canRun = true
      if (!dryRun) {
        const now = new Date().toISOString()
        await supabase
          .from('scoring_inputs')
          .update({
            review_status: 'rejected',
            review_timestamp: now,
            review_notes: 'Superseded by Agent 2 re-run from Admin UI.',
            human_reviewer: 'system:agent2-rerun',
          })
          .eq('input_id', latest.input_id)
        await updateAgentStatus(supabase, id, 'evidence_approved')
        product.agent_status = 'evidence_approved'
        agentLog(
          `Step 0: archived pending_review input ${latest.input_id} — ready for Admin UI re-run`,
        )
      }
    }
  }

  if (!canRun) {
    const reason = dryRun
      ? `Agent 2 dry run not allowed for agent_status ${product.agent_status}`
      : `Agent 2 requires approved evidence and a pipeline-catalog status (not awaiting review / in progress). Current: ${product.agent_status}`
    agentLog(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  let rejectionNotes = null
  if (isRerun) {
    const rejected = await fetchLatestRejectedScoringInputs(supabase, id)
    rejectionNotes = rejected?.review_notes ?? null
    if (!rejectionNotes?.trim()) {
      const reason =
        'Re-run requires review_notes on the latest rejected scoring_inputs row'
      agentLog(`Stopped: ${reason}`)
      return { ok: false, product, reason }
    }
    agentLog('Step 1: normalization_rejected — re-run with reviewer corrections')
    agentLog(`  rejection notes: ${rejectionNotes.slice(0, 120)}…`)
  } else {
    agentLog('Step 1: evidence_approved confirmed')
  }
  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'normalization_in_progress')
    agentLog('Step 2: agent_status → normalization_in_progress')
  } else {
    agentLog('Step 2: (dry run) skip status update')
  }

  const evidence = await fetchApprovedEvidence(supabase, id)
  agentLog(
    `Step 3: loaded approved evidence bundle v${evidence.bundle_version} (${evidence.evidence_id})`,
  )

  const registryPreflightError = getProductTypeRegistryPreflightError({ product, evidence })
  if (registryPreflightError) {
    agentLog(`Stopped: ${registryPreflightError}`)
    if (!dryRun) {
      await updateAgentStatus(supabase, id, 'evidence_approved')
    }
    return { ok: false, product, reason: registryPreflightError }
  }

  let inputs
  try {
    agentLog('Step 4: deterministic normalization (V3.0, no LLM)…')
    inputs = await normalizeEvidence(product, evidence, {
      rejectionNotes: rejectionNotes ?? undefined,
    })
  } catch (err) {
    await updateAgentStatus(
      supabase,
      id,
      isRerun ? 'normalization_rejected' : 'evidence_approved',
    )
    throw err
  }

  const taxonomyBlocked = inputs.status === 'taxonomy_expansion_required'
  const descriptionWarning =
    inputs.product_description_status && inputs.product_description_status !== 'generated'
  agentLog(
    taxonomyBlocked
      ? 'Step 5: taxonomy_expansion_required — normalization halted for missing material taxonomy.'
      : 'Step 5: JSON parsed and validated',
  )

  const whyThisScore = taxonomyBlocked ? null : buildWhyThisScoreOptions(evidence, inputs)
  if (taxonomyBlocked) {
    agentLog(
      'Step 5b: skipping Why This Score vocabulary mapping (taxonomy expansion required).',
    )
  } else {
    agentLog('Step 5b: Why This Score vocabulary options mapped')
    if (inputs.product_description) {
      const words = inputs.description_word_count ?? inputs.product_description.split(/\s+/).length
      agentLog(`  product_description (${words} words): ${inputs.product_description}`)
    }
    if (descriptionWarning) {
      agentLog(
        `  product_description WARNING (non-score): ${(inputs.flagged_missing_fields ?? []).join(', ') || inputs.product_description_status}`,
      )
      for (const w of inputs.product_description_warnings ?? []) {
        agentLog(`  → ${w}`)
      }
    }
  }

  if (inputs.human_review_required) {
    agentLog('  human_review_required: true')
    agentLog(`  reason: ${inputs.human_review_reason ?? '(none)'}`)
  }

  if (dryRun) {
    agentLog('Step 6: (dry run) skip database write')
    return { ok: true, product, evidence, inputs, whyThisScore, dryRun: true }
  }

  const row = await insertScoringInputs(supabase, {
    product_id: id,
    evidence_id: evidence.evidence_id,
    agent_version: inputs.normalization_metadata?.agent_version ?? AGENT_VERSION,
    algorithm_version: inputs.normalization_metadata?.algorithm_version ?? ALGORITHM_VERSION,
    inputs,
    review_status: taxonomyBlocked ? 'draft' : 'pending_review',
    human_review_required: Boolean(inputs.human_review_required),
    human_review_reason: inputs.human_review_reason ?? null,
    ...(whyThisScore || {}),
  })
  agentLog(`Step 6: saved scoring_inputs (${row.input_id})`)

  if (taxonomyBlocked) {
    await updateAgentStatus(supabase, id, 'evidence_approved')
    agentLog(
      'Step 7: agent_status → evidence_approved (missing material taxonomy — add taxonomy and re-run Agent 2)',
    )
  } else {
    await updateAgentStatus(supabase, id, 'normalization_awaiting_review')
    agentLog('Step 7: agent_status → normalization_awaiting_review')
  }

  const outDir = join(projectRoot, 'scripts', 'output')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `agent2-${id}.json`)
  writeFileSync(outFile, JSON.stringify({ product, evidence, inputs, scoring_input: row }, null, 2))
  agentLog(`  output: ${outFile}`)

  if (taxonomyBlocked) {
    const reason = scoreBlockingNormalizationFailureMessage(
      inputs.status,
      inputs.flagged_missing_fields ?? inputs.missing_taxonomy_materials,
    )
    return { ok: false, product, evidence, inputs, scoringInput: row, reason }
  }

  if (descriptionWarning) {
    return {
      ok: true,
      product,
      evidence,
      inputs,
      scoringInput: row,
      whyThisScore,
      outFile,
      productDescriptionWarning: cosmeticProductDescriptionWarningMessage(
        inputs.flagged_missing_fields,
      ),
    }
  }

  return {
    ok: true,
    product,
    evidence,
    inputs,
    scoringInput: row,
    whyThisScore,
    outFile,
  }
}

function previewOptions(options) {
  const list = Array.isArray(options) ? options : []
  const text = list.join(', ')
  return text.length > 72 ? `${text.slice(0, 69)}…` : text || '—'
}

export function formatNormalizationSummary(result) {
  if (!result.ok) {
    return `${result.product.product_name}: ${result.reason}`
  }
  const { inputs, product } = result
  const lines = [
    `Product: ${product.product_name}`,
    `Category: ${inputs.product_category_default}`,
    `Components: ${inputs.components.length}`,
    `Transparency: ${inputs.layer_4b?.transparency_badge} (±${inputs.layer_4b?.confidence_interval})`,
    `Layer 4A net: ${inputs.layer_4a?.net_adjustment ?? 0}`,
    `Human review: ${inputs.human_review_required ? 'YES' : 'no'}`,
    'Why This Score options:',
    `  primary: ${previewOptions(result.whyThisScore?.primary_material_options ?? result.scoringInput?.primary_material_options)}`,
    `  disclosure: ${previewOptions(result.whyThisScore?.disclosure_quality_options ?? result.scoringInput?.disclosure_quality_options)}`,
    `  certifications: ${previewOptions(result.whyThisScore?.certifications_options ?? result.scoringInput?.certifications_options)}`,
  ]
  if (inputs.human_review_required && inputs.human_review_reason) {
    lines.push(`  Reason: ${inputs.human_review_reason}`)
  }
  for (const c of inputs.components) {
    lines.push(
      `  - ${c.component_name}: hazard ${c.material_hazard}, migration ${c.adjusted_migration_potential}, severity ${c.exposure_severity}, intimacy ${c.contact_intimacy}`,
    )
  }
  return lines.join('\n')
}
