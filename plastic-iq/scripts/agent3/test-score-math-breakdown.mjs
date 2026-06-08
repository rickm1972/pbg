/**
 * Unit-style check for Gate 3 score math breakdown (T-Fal fixture).
 * Run: node scripts/agent3/test-score-math-breakdown.mjs
 */
import { buildScoreMathBreakdown } from '../../src/lib/scoreMathBreakdown.ts'

const tfalScore = {
  score_id: 'test',
  product_id: '7a457a86-ab62-4cbf-90b9-ccaeafe06896',
  input_id: 'test-input',
  pac_safety_score: 2,
  tier: 'High Risk',
  displayed_confidence_range: '0–5',
  transparency_badge: 'Documentation Incomplete',
  weighted_npr: 382.5,
  component_nprs: {
    components: [
      {
        component_name: 'Cooking Surface (PTFE nonstick, titanium reinforced)',
        material_hazard: 0.85,
        adjusted_migration_potential: 0.75,
        contact_intimacy: 1,
        exposure_severity: 0.96,
        exposure_duration: 0.5,
        base_npr: 306,
        npr_after_category: 306,
        escalator_applied: 'escalator_1',
        escalator_multiplier: 1.25,
        final_npr: 382.5,
      },
    ],
  },
  escalator_applied: 'escalator_1',
  layer_4a_net: 0,
  ingredient_transparency_score: null,
  explanation_draft: null,
  algorithm_version: '2.3.4',
  run_timestamp: '',
  review_status: 'pending_review',
  reviewer: null,
  review_timestamp: null,
  review_notes: null,
}

const ctx = {
  layer4a: {
    net_adjustment: -2,
    negative_adjustments: [{ reason: 'Marketing language only, no verifiable claims', value: -2 }],
    positive_adjustments: [],
    unknown_coating_cap_applies: false,
  },
  layer4b: {
    transparency_badge: 'Documentation Incomplete',
    confidence_interval: 3,
  },
  normalizationComponents: [
    {
      component_name: 'Cooking Surface (PTFE nonstick, titanium reinforced)',
      material: 'PTFE nonstick coating (titanium reinforced)',
      material_id: 'ptfe_nonstick_titanium_reinforced',
      material_hazard: 0.85,
      adjusted_migration_potential: 0.75,
      migration_table_entry: 'PTFE nonstick coating (titanium reinforced) — 0.75',
      contact_intimacy: 1,
      exposure_severity: 0.96,
      severity_justification:
        'Cookware stovetop default: base 0.88 + fatty food +0.08 = 0.96 (capped at 1.0). Severity reflects use conditions only.',
      exposure_duration: 0.5,
      duration_justification: 'Cooking pan approximately 15 min daily default — 0.50.',
    },
  ],
}

const b = buildScoreMathBreakdown(tfalScore, ctx)

const rawExpected = 100 - Math.sqrt(382.5) * 5
const ok =
  Math.abs(b.rawScore - rawExpected) < 0.01 &&
  b.roundedScore === 2 &&
  b.displayedPacScore === 2 &&
  b.layer4a.appliedInFinalScore === 0 &&
  b.layer4a.normalizationSuggestion === -2 &&
  b.internallyConsistent &&
  b.escalator?.id === 'escalator_1' &&
  b.escalator?.plainEnglishName === 'High-heat PFAS/PTFE cookware escalation' &&
  (b.components[0]?.factorLabels.length ?? 0) >= 6

console.log('raw score:', b.rawScore.toFixed(2), '(expected ~2.21)')
console.log('layer4a applied:', b.layer4a.appliedInFinalScore)
console.log('layer4a suggestion:', b.layer4a.normalizationSuggestion)
console.log('escalator name:', b.escalator?.plainEnglishName)
console.log('factor labels:', b.components[0]?.factorLabels.length)
console.log('final score:', b.displayedPacScore)
console.log('internally consistent:', b.internallyConsistent)
console.log('consistency notes:', b.consistencyNotes)
console.log('strip reason:', b.layer4a.stripReason)

if (!ok) {
  console.error('FAIL')
  process.exit(1)
}
console.log('PASS — T-Fal score 2 is correct with Layer 4A net 0 (marketing -2 stripped)')
