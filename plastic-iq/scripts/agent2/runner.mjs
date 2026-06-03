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

export async function runAgent2({ productId, productName, dryRun = false }) {
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

  console.log(`\n=== Agent 2: ${product.product_name} (${id}) ===\n`)

  const isRerun = product.agent_status === 'normalization_rejected'
  let canRun = canRunAgent2Sequential(product.agent_status)
  if (!canRun && product.agent_status === 'normalization_awaiting_review') {
    const { data: latest } = await supabase
      .from('scoring_inputs')
      .select('review_status')
      .eq('product_id', id)
      .order('run_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.review_status === 'draft') {
      canRun = true
      if (!dryRun) {
        await updateAgentStatus(supabase, id, 'evidence_approved')
        product.agent_status = 'evidence_approved'
        console.log(
          'Step 0: reset normalization_awaiting_review → evidence_approved (failed draft — re-run)',
        )
      }
    }
  }

  if (!canRun) {
    const reason = dryRun
      ? `Agent 2 dry run not allowed for agent_status ${product.agent_status}`
      : `Agent 2 requires approved evidence and a pipeline-catalog status (not awaiting review / in progress). Current: ${product.agent_status}`
    console.log(`Stopped: ${reason}`)
    return { ok: false, product, reason }
  }

  let rejectionNotes = null
  if (isRerun) {
    const rejected = await fetchLatestRejectedScoringInputs(supabase, id)
    rejectionNotes = rejected?.review_notes ?? null
    if (!rejectionNotes?.trim()) {
      const reason =
        'Re-run requires review_notes on the latest rejected scoring_inputs row'
      console.log(`Stopped: ${reason}`)
      return { ok: false, product, reason }
    }
    console.log('Step 1: normalization_rejected — re-run with reviewer corrections')
    console.log(`  rejection notes: ${rejectionNotes.slice(0, 120)}…`)
  } else {
    console.log('Step 1: evidence_approved confirmed')
  }
  if (!dryRun) {
    await updateAgentStatus(supabase, id, 'normalization_in_progress')
    console.log('Step 2: agent_status → normalization_in_progress')
  } else {
    console.log('Step 2: (dry run) skip status update')
  }

  const evidence = await fetchApprovedEvidence(supabase, id)
  console.log(
    `Step 3: loaded approved evidence bundle v${evidence.bundle_version} (${evidence.evidence_id})`,
  )

  let inputs
  try {
    console.log('Step 4: deterministic normalization (V3.0, no LLM)…')
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
  const descriptionBlocked = inputs.status === 'description_generation_failed'
  console.log(
    taxonomyBlocked
      ? 'Step 5: taxonomy_expansion_required — normalization halted for missing material taxonomy.'
      : 'Step 5: JSON parsed and validated',
  )

  const whyThisScore = taxonomyBlocked ? null : buildWhyThisScoreOptions(evidence, inputs)
  if (taxonomyBlocked) {
    console.log(
      'Step 5b: skipping Why This Score vocabulary mapping (taxonomy expansion required).',
    )
  } else if (descriptionBlocked) {
    console.log('Step 5b: Why This Score vocabulary options mapped')
    console.log(
      `  product_description FAILED: ${(inputs.flagged_missing_fields ?? []).join(', ')}`,
    )
  } else {
    console.log('Step 5b: Why This Score vocabulary options mapped')
    if (inputs.product_description) {
      console.log(
        `  product_description: ${inputs.product_description.slice(0, 80)}… (${inputs.product_description.split(/\s+/).length} words)`,
      )
    }
  }

  if (inputs.human_review_required) {
    console.log('  human_review_required: true')
    console.log(`  reason: ${inputs.human_review_reason ?? '(none)'}`)
  }

  if (dryRun) {
    console.log('Step 6: (dry run) skip database write')
    return { ok: true, product, evidence, inputs, whyThisScore, dryRun: true }
  }

  const row = await insertScoringInputs(supabase, {
    product_id: id,
    evidence_id: evidence.evidence_id,
    agent_version: inputs.normalization_metadata?.agent_version ?? AGENT_VERSION,
    algorithm_version: inputs.normalization_metadata?.algorithm_version ?? ALGORITHM_VERSION,
    inputs,
    review_status: taxonomyBlocked || descriptionBlocked ? 'draft' : 'pending_review',
    human_review_required: Boolean(inputs.human_review_required),
    human_review_reason: inputs.human_review_reason ?? null,
    ...(whyThisScore || {}),
  })
  console.log(`Step 6: saved scoring_inputs (${row.input_id})`)

  if (taxonomyBlocked) {
    await updateAgentStatus(supabase, id, 'evidence_approved')
    console.log(
      'Step 7: agent_status → evidence_approved (missing material taxonomy — add taxonomy and re-run Agent 2)',
    )
  } else if (descriptionBlocked) {
    await updateAgentStatus(supabase, id, 'evidence_approved')
    console.log(
      'Step 7: agent_status → evidence_approved (description generation failed — fix evidence and re-run Agent 2)',
    )
  } else {
    await updateAgentStatus(supabase, id, 'normalization_awaiting_review')
    console.log('Step 7: agent_status → normalization_awaiting_review')
  }

  const outDir = join(projectRoot, 'scripts', 'output')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `agent2-${id}.json`)
  writeFileSync(outFile, JSON.stringify({ product, evidence, inputs, scoring_input: row }, null, 2))
  console.log(`  output: ${outFile}`)

  if (taxonomyBlocked || descriptionBlocked) {
    const reason = taxonomyBlocked
      ? `Missing material taxonomy (${(inputs.flagged_missing_fields ?? inputs.missing_taxonomy_materials ?? []).join(', ') || 'see scoring_inputs draft'}). Add taxonomy and re-run Agent 2.`
      : `Product description generation failed (${(inputs.flagged_missing_fields ?? []).join(', ') || 'see draft'}). Fix evidence and re-run Agent 2.`
    return { ok: false, product, evidence, inputs, scoringInput: row, reason }
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
