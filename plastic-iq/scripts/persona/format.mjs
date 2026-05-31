import { PERSONA_CONTENT_FIELD_KEYS } from './schema.mjs'

const LABELS = {
  persona_name: 'Persona name',
  persona_nickname: 'Nickname',
  segment: 'Segment',
  summary_one_liner: 'One-line summary',
  summary: 'Summary',
  demographics: 'Demographics',
  role_lifestyle_context: 'Role / lifestyle',
  main_goal: 'Main goal',
  main_pain_point: 'Main pain point',
  buying_trigger: 'Buying trigger',
  barriers: 'Barriers',
  decision_criteria: 'Decision criteria',
  information_needs: 'Information needs',
  trusted_sources: 'Trusted sources',
  channels: 'Channels',
  messaging_angle: 'Messaging angle',
  objections: 'Objections',
  proof_needed: 'Proof needed',
  cta: 'CTA',
  voice_of_customer_quote: 'Voice of customer',
  data_sources: 'Data sources',
  pac_awareness_level: 'PAC awareness',
  overwhelm_risk: 'Overwhelm risk',
  safety_motivation: 'Safety motivation',
  replacement_readiness: 'Replacement readiness',
  trust_threshold: 'Trust threshold',
  eighty_twenty_mindset_fit: '80/20 mindset',
  product_category_priority: 'Category priority',
  risk_communication_sensitivity: 'Risk communication',
  preferred_safer_alternative_type: 'Preferred materials',
  certification_literacy: 'Certification literacy',
}

export function formatPersonaSummary(row) {
  const lines = []
  const content = row.persona_content ?? {}
  const usage = row.run_metadata?.api_usage

  lines.push(`\n=== Persona: ${row.persona_name || '(unnamed)'} ===`)
  lines.push(`ID: ${row.persona_id}`)
  lines.push(`Status: ${row.status} | Run: ${row.run_metadata?.run_status ?? 'n/a'}`)
  lines.push(`Target: ${row.target_segment}`)

  if (usage) {
    lines.push(
      `\nCost: $${(usage.total_estimated_cost_usd ?? 0).toFixed(4)} total` +
        ` | Perplexity $${(usage.perplexity_estimated_cost_usd ?? 0).toFixed(4)}` +
        ` (${usage.perplexity_input_tokens ?? 0} in / ${usage.perplexity_output_tokens ?? 0} out, ${usage.perplexity_requests ?? 0} requests)` +
        ` | Claude $${(usage.claude_estimated_cost_usd ?? 0).toFixed(4)}` +
        ` (${usage.claude_input_tokens ?? 0} in / ${usage.claude_output_tokens ?? 0} out)` +
        ` | Sources: ${usage.source_count ?? 0}`,
    )
  }

  lines.push('\n--- Profile ---\n')
  for (const key of PERSONA_CONTENT_FIELD_KEYS) {
    if (key === 'summary_one_liner' || key === 'persona_nickname') continue
    const val = content[key]
    if (!val || !String(val).trim()) continue
    lines.push(`${LABELS[key] ?? key}:\n${val}\n`)
  }

  const sources = row.sources ?? []
  if (sources.length) {
    lines.push('--- Sources ---')
    for (const s of sources) {
      lines.push(`- ${s.title ?? s.url}: ${s.url}`)
    }
  }

  if (row.run_metadata?.error_message) {
    lines.push(`\nError: ${row.run_metadata.error_message}`)
  }

  return lines.join('\n')
}
