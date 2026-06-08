#!/usr/bin/env node
/**
 * Run Agent 2 in a fresh Node process (stdout JSON for Vite dev API).
 * Progress logs go to stderr; stdout is a single JSON line only.
 * Usage: node scripts/agent2/cli-run-json.mjs <product_id>
 */
process.env.PLASTICIQ_AGENT2_JSON_CLI = '1'

const productId = process.argv[2]
if (!productId) {
  console.error('Usage: node scripts/agent2/cli-run-json.mjs <product_id>')
  process.exit(1)
}

const { runAgent2, formatNormalizationSummary } = await import('./runner.mjs')

let result
try {
  result = await runAgent2({ productId })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stdout.write(
    `${JSON.stringify({ ok: false, reason: message, product_id: productId })}\n`,
  )
  process.exit(1)
}

const payload = {
  ok: result.ok,
  reason: result.reason ?? null,
  summary: result.ok ? formatNormalizationSummary(result) : null,
  product_id: result.product?.product_id ?? productId,
  evidence_id: result.evidence?.evidence_id ?? null,
  input_id: result.scoringInput?.input_id ?? null,
  human_review_required: result.inputs?.human_review_required ?? null,
  description_generator_version:
    result.inputs?.normalization_metadata?.description_generator_version ?? null,
  product_description_preview: String(result.inputs?.product_description ?? '').slice(0, 160),
  component_count: result.inputs?.components?.length ?? null,
}

process.stdout.write(`${JSON.stringify(payload)}\n`)

process.exit(result.ok ? 0 : 2)
