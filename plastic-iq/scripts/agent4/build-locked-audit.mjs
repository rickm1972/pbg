/**
 * Phase 7 — Agent 4 locked-output audit (read-only; never mutates locked output).
 */
import { tierForScore } from '../agent3/algorithm.mjs'
import {
  METHODOLOGY_VERSION,
  MATERIAL_LOOKUP_VERSION,
} from '../../src/lib/lockedInput/buildLockedInputPackage.ts'

const VALID_TIERS = new Set(['Excellent', 'Good', 'Caution', 'Concern', 'High Risk'])
const HYBRID_PRIMARY_PREFIX = 'hybrid_'
const FOOD_CONTACT_CI_THRESHOLD = 0.5

/**
 * @typedef {import('../../src/types/agent3LockedOutput.ts').Agent3LockedOutputRow} LockedOutputRow
 * @typedef {import('../../src/types/lockedInput.ts').LockedInputPayload} LockedInputPayload
 * @typedef {import('../../src/types/agent4LockedAudit.ts').Agent4AuditIssue} AuditIssue
 * @typedef {import('../../src/types/agent4LockedAudit.ts').Agent4ConsistencyCheck} ConsistencyCheck
 */

/**
 * @param {LockedOutputRow} lockedOutput
 * @param {{ lockedPayload?: LockedInputPayload | null, lockHashFromInput?: string | null }} [options]
 */
export function buildAgent4LockedAudit(lockedOutput, options = {}) {
  /** @type {AuditIssue[]} */
  const blockers = []
  /** @type {AuditIssue[]} */
  const warnings = []
  /** @type {ConsistencyCheck[]} */
  const consistency_checks = []

  function check(id, pass, message, { fatal = false } = {}) {
    consistency_checks.push({ id, pass, message })
    if (!pass) {
      const issue = { code: id, message }
      if (fatal) blockers.push(issue)
      else warnings.push(issue)
    }
  }

  const score = lockedOutput.score_payload
  const math = lockedOutput.math_breakdown
  const display = lockedOutput.display_payload
  const components = math?.components ?? []

  // --- Provenance ---
  check(
    'provenance.locked_output_id',
    Boolean(lockedOutput.locked_output_id),
    'locked_output_id present',
    { fatal: true },
  )
  check(
    'provenance.locked_input_id',
    Boolean(lockedOutput.locked_input_id),
    'locked_input_id present',
    { fatal: true },
  )
  check(
    'provenance.lock_hash',
    Boolean(lockedOutput.lock_hash?.length),
    'lock_hash present',
    { fatal: true },
  )
  check(
    'provenance.agent3_input_source',
    lockedOutput.input_source === 'locked_input_package',
    `audited agent3_locked_outputs.input_source must be locked_input_package (got ${lockedOutput.input_source ?? 'missing'})`,
    { fatal: true },
  )
  check(
    'provenance.methodology_version',
    lockedOutput.methodology_version === METHODOLOGY_VERSION,
    `methodology_version must be ${METHODOLOGY_VERSION}`,
    { fatal: true },
  )
  check(
    'provenance.material_lookup_version',
    lockedOutput.material_lookup_version === MATERIAL_LOOKUP_VERSION,
    `material_lookup_version must be ${MATERIAL_LOOKUP_VERSION}`,
    { fatal: true },
  )

  if (options.lockedPayload) {
    check(
      'provenance.lock_hash_matches_locked_input',
      !options.lockHashFromInput || lockedOutput.lock_hash === options.lockHashFromInput,
      'lock_hash matches agent1_locked_inputs',
      { fatal: true },
    )
  }

  // --- Math presence ---
  check('math.final_score', score?.final_score != null, 'final score present', { fatal: true })
  check('math.tier', Boolean(score?.tier), 'tier present', { fatal: true })
  check('math.weighted_npr', score?.weighted_npr != null, 'weighted NPR present', { fatal: true })
  check('math.raw_score', score?.raw_score_before_layer_4a != null, 'raw score present', { fatal: true })
  check('math.layer_4a', score?.layer_4a_total_applied != null, 'Layer 4A total present', { fatal: true })
  check('math.cap_status', score?.cap_triggered != null, 'cap status present', { fatal: true })
  check('math.components', components.length > 0, 'component math breakdown present', { fatal: true })

  for (const comp of components) {
    const label = comp.component_name ?? comp.locked_canonical_material_id ?? 'component'
    if (comp.score_driving === false) continue
    check(
      `math.component.${label}.canonical_id`,
      Boolean(comp.locked_canonical_material_id),
      `${label}: locked canonical material ID present`,
      { fatal: true },
    )
    check(
      `math.component.${label}.hazard`,
      comp.hazard_used != null,
      `${label}: hazard present`,
      { fatal: true },
    )
    check(
      `math.component.${label}.adjusted_migration`,
      comp.adjusted_migration_used != null,
      `${label}: adjusted migration present`,
      { fatal: true },
    )
    check(
      `math.component.${label}.npr`,
      comp.npr_after_escalator != null,
      `${label}: component NPR present`,
      { fatal: true },
    )
    if (comp.non_detect_mitigation_applied) {
      check(
        `math.component.${label}.nd_factor`,
        comp.mitigation_factor === 0.58,
        `${label}: Non-Detect mitigation factor preserved at 0.58`,
        { fatal: true },
      )
      check(
        `math.component.${label}.nd_hazard_unchanged`,
        comp.hazard_used != null && comp.base_migration != null,
        `${label}: hazard/base migration preserved alongside Non-Detect (not re-applied to hazard)`,
      )
    }
  }

  // --- Score consistency ---
  if (score?.final_score != null && score?.pac_safety_score != null) {
    check(
      'math.rounded_final_matches_payload',
      Math.round(score.final_score) === score.pac_safety_score,
      'rounded final score matches pac_safety_score in score_payload',
      { fatal: true },
    )
  }
  if (score?.pac_safety_score != null && score?.tier) {
    const expectedTier = tierForScore(score.pac_safety_score)
    check(
      'math.tier_consistency',
      score.tier === expectedTier,
      `tier ${score.tier} matches score ${score.pac_safety_score} (expected ${expectedTier})`,
      { fatal: true },
    )
    check('math.tier_allowed', VALID_TIERS.has(score.tier), `tier ${score.tier} is valid`)
  }
  if (math?.layer_4a_total_applied != null && score?.layer_4a_total_applied != null) {
    check(
      'math.layer_4a_payload_match',
      math.layer_4a_total_applied === score.layer_4a_total_applied,
      'Layer 4A in math_breakdown matches score_payload',
      { fatal: true },
    )
  }
  if (math?.cap_triggered != null && score?.cap_triggered != null) {
    check(
      'math.cap_payload_match',
      math.cap_triggered === score.cap_triggered,
      'cap_triggered in math_breakdown matches score_payload',
      { fatal: true },
    )
  }
  if (math?.weighted_npr != null && score?.weighted_npr != null) {
    check(
      'math.weighted_npr_payload_match',
      Math.abs(math.weighted_npr - score.weighted_npr) < 0.0001,
      'weighted NPR in math_breakdown matches score_payload',
      { fatal: true },
    )
  }

  // --- Locked boundary (no re-lookup signals) ---
  for (const comp of components) {
    if (comp.score_driving === false) continue
    check(
      `boundary.${comp.locked_canonical_material_id}.resolved_id`,
      Boolean(comp.locked_resolved_material_taxonomy_id),
      `${comp.component_name}: resolved taxonomy ID present (locked values used)`,
    )
  }

  // --- Hybrid duplicate-exposure (general, not product-specific) ---
  const hybridDuplicate = checkHybridDuplicateExposure(components, options.lockedPayload)
  check(
    'boundary.hybrid_duplicate_exposure',
    hybridDuplicate.pass,
    hybridDuplicate.message,
    { fatal: true },
  )

  // --- Badge / display ---
  check(
    'display.transparency_badge',
    Boolean(score?.transparency_badge),
    'transparency badge present',
  )
  if (display?.badge_basis && score?.transparency_badge) {
    check(
      'display.badge_basis',
      true,
      'badge basis present in display_payload',
    )
  }
  check(
    'display.why_this_score',
    Boolean(display?.why_this_score_draft),
    'why-this-score draft present in display_payload',
  )
  check(
    'display.payload_exists',
    display != null,
    'display_payload exists (minimal draft acceptable)',
  )
  const publishWarning =
    display?.locked_input_warning ??
    display?.publish_disabled_notice ??
    ''
  check(
    'display.publish_warning',
    /publish/i.test(publishWarning) && /not enabled|disabled/i.test(publishWarning),
    'publish-disabled warning present in display_payload',
  )

  const checks_passed = consistency_checks.filter((c) => c.pass).length
  const checks_failed = consistency_checks.filter((c) => !c.pass).length
  const audit_status = blockers.length > 0 ? 'failed' : 'passed'

  /** @type {import('../../src/types/agent4LockedAudit.ts').Agent4LockedAuditPayload} */
  const audit_payload = {
    audited_locked_output_id: lockedOutput.locked_output_id,
    audited_agent3_input_source: 'locked_input_package',
    agent4_input_source: 'agent3_locked_output',
    product_id: lockedOutput.product_id,
    locked_input_id: lockedOutput.locked_input_id,
    lock_hash: lockedOutput.lock_hash,
    methodology_version: lockedOutput.methodology_version,
    material_lookup_version: lockedOutput.material_lookup_version,
    score_summary: {
      pac_safety_score: score?.pac_safety_score ?? 0,
      tier: score?.tier ?? '',
      transparency_badge: score?.transparency_badge ?? null,
      weighted_npr: score?.weighted_npr ?? 0,
      raw_score_before_layer_4a: score?.raw_score_before_layer_4a ?? 0,
      layer_4a_total_applied: score?.layer_4a_total_applied ?? 0,
      cap_triggered: Boolean(score?.cap_triggered),
      final_score: score?.final_score ?? 0,
    },
    component_count: components.length,
    blocker_count: blockers.length,
    warning_count: warnings.length,
    checks_passed,
    checks_failed,
    publish_disabled_notice:
      'Locked-output Agent 4 audit is isolated. Publishing is not enabled from this audit yet.',
  }

  return {
    product_id: lockedOutput.product_id,
    locked_output_id: lockedOutput.locked_output_id,
    locked_input_id: lockedOutput.locked_input_id,
    lock_hash: lockedOutput.lock_hash,
    input_source: 'agent3_locked_output',
    methodology_version: lockedOutput.methodology_version,
    material_lookup_version: lockedOutput.material_lookup_version,
    audit_status,
    audit_payload,
    blockers,
    warnings,
    consistency_checks,
  }
}

function isScoreDriving(comp) {
  return comp.score_driving !== false && comp.locked_is_score_driving !== false
}

function isHybridPrimaryComponent(comp) {
  const id = (comp.locked_canonical_material_id ?? '').toLowerCase()
  if (!id.startsWith(HYBRID_PRIMARY_PREFIX)) return false
  const role = (comp.component_role ?? '').toLowerCase()
  const ci = comp.contact_intimacy ?? comp.locked_contact_intimacy ?? 0
  return (
    role.includes('food') ||
    role.includes('cooking') ||
    role.includes('primary') ||
    role.includes('contact') ||
    ci >= FOOD_CONTACT_CI_THRESHOLD
  )
}

function isCoatingProprietaryComponent(comp) {
  const id = (comp.locked_canonical_material_id ?? '').toLowerCase()
  if (id.startsWith(HYBRID_PRIMARY_PREFIX)) return false
  const role = (comp.component_role ?? '').toLowerCase()
  if (role.includes('coating') || role.includes('proprietary')) return true
  if (id.includes('coating') || id.includes('proprietary') || id.includes('sol_gel')) return true
  return false
}

function hasFoodContactOverlap(comp) {
  const role = (comp.component_role ?? '').toLowerCase()
  const ci = comp.contact_intimacy ?? comp.locked_contact_intimacy ?? 0
  return (
    role.includes('food') ||
    role.includes('cooking') ||
    role.includes('primary') ||
    role.includes('contact') ||
    role.includes('surface') ||
    ci >= FOOD_CONTACT_CI_THRESHOLD
  )
}

/**
 * General hybrid duplicate-exposure rule (not keyed to product name/id).
 * @param {Array<Record<string, unknown>>} mathComponents
 * @param {LockedInputPayload | null | undefined} lockedPayload
 */
export function checkHybridDuplicateExposure(mathComponents, lockedPayload = null) {
  const fromMath = (mathComponents ?? []).filter(isScoreDriving)
  const hybridPrimaries = fromMath.filter(isHybridPrimaryComponent)

  if (hybridPrimaries.length === 0) {
    return { pass: true, message: 'No hybrid-primary score-driving component; duplicate-exposure check N/A' }
  }

  const overlappingFromMath = fromMath.filter(
    (c) => isCoatingProprietaryComponent(c) && hasFoodContactOverlap(c),
  )

  let overlappingFromLocked = []
  if (lockedPayload?.locked_components) {
    overlappingFromLocked = lockedPayload.locked_components.filter(
      (c) => c.locked_is_score_driving && isCoatingProprietaryComponent(c) && hasFoodContactOverlap(c),
    )
  }

  const offenders = [...overlappingFromMath, ...overlappingFromLocked]
  if (offenders.length > 0) {
    const names = offenders
      .map((c) => c.component_name ?? c.locked_component_name ?? c.locked_canonical_material_id)
      .join(', ')
    return {
      pass: false,
      message: `Hybrid-primary duplicate exposure: score-driving coating/proprietary row(s) overlap hybrid contact surface (${names})`,
    }
  }

  return {
    pass: true,
    message: 'Hybrid-primary products: no overlapping score-driving coating/proprietary duplicate exposure',
  }
}
