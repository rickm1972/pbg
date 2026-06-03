/**
 * Phase 3.7 — deterministic retrieval tasks for required external checks.
 *
 * Implemented runners: cookware_pfas_regulatory_minnesota (T-Fal validated).
 * Planned before catalog-wide runs (priority order): pfas_nonstick_disclosure,
 * pfoa_pfas_distinction, food_storage lid/seal/plastic, drinkware cap/straw/gasket,
 * cooking_utensil materials, cutting_board binder/finish/plastic.
 * @typedef {object} RetrievalTaskDefinition
 * @property {string} check_id — matches matrix external check id
 * @property {string} task_key
 * @property {string} label
 * @property {string} pattern_trigger — from pattern-triggers.mjs
 * @property {string[]} target_source_types
 * @property {{ goal: string, queryTemplate: string }[]} query_templates — `{{brand}}` `{{product_name}}`
 * @property {string[]} official_urls — fetched first when set
 * @property {string[]} expected_evidence_fields
 * @property {string} canonical_mapping_target
 * @property {string} pass_criteria_summary
 */

/** @type {RetrievalTaskDefinition[]} */
export const RETRIEVAL_TASK_REGISTRY = [
  {
    check_id: 'external.regulatory_pfas_minnesota_review',
    task_key: 'cookware_pfas_regulatory_minnesota',
    label: 'Cookware PFAS regulatory (Minnesota 2025)',
    pattern_trigger: 'ptfe_primary_contact',
    target_source_types: ['regulatory', 'government', 'manufacturer', 'ingredient_page', 'faq'],
    query_templates: [
      {
        goal: 'minnesota_pca_pfas',
        queryTemplate:
          'Minnesota PCA 2025 PFAS prohibitions cookware intentionally added nonstick PTFE',
      },
      {
        goal: 'manufacturer_mn_distribution',
        queryTemplate: '{{brand}} {{product_name}} sold Minnesota PFAS cookware distribution',
      },
      {
        goal: 'manufacturer_nonstick_pfas',
        queryTemplate: '{{brand}} nonstick PFAS PTFE disclosure official',
      },
    ],
    official_urls: [
      'https://www.pca.state.mn.us/air-water-land-climate/2025-pfas-prohibitions',
      'https://www.revisor.mn.gov/statutes/cite/116.943',
    ],
    expected_evidence_fields: [
      'sources[].page_excerpt',
      'canonical_mappings.regulatory_flag_ids',
      'required_check_results',
    ],
    canonical_mapping_target: 'regulatory_flag_ids.minnesota_pfas_ban_2025',
    pass_criteria_summary:
      'Official MN source documents 2025 cookware prohibition for intentionally added PFAS (category/material applicability). minnesota_pfas_ban_2025 flag is OK without SKU-specific ban confirmation. MN non-sale only with manufacturer distribution evidence.',
  },
  {
    check_id: 'external.pfas_nonstick_disclosure',
    task_key: 'cookware_pfas_nonstick_disclosure',
    label: 'PFAS / nonstick disclosure',
    pattern_trigger: 'ptfe_primary_contact',
    target_source_types: ['manufacturer', 'ingredient_page', 'faq'],
    query_templates: [
      {
        goal: 'nonstick_ingredients',
        queryTemplate: '{{brand}} {{product_name}} PTFE PFA FEP nonstick coating ingredients disclosure',
      },
    ],
    official_urls: [],
    expected_evidence_fields: ['canonical_mappings.pfas_status_id', 'ingredient_list'],
    canonical_mapping_target: 'pfas_status_id',
    pass_criteria_summary: 'Manufacturer lists PTFE/PFA/FEP or PFAS family on food-contact coating with source URL.',
  },
  {
    check_id: 'external.pfoa_vs_pfas_free_distinction',
    task_key: 'cookware_pfoa_pfas_distinction',
    label: 'PFOA-free vs PFAS-free distinction',
    pattern_trigger: 'pfoa_pfas_distinction',
    target_source_types: ['manufacturer', 'retailer', 'amazon'],
    query_templates: [
      {
        goal: 'pfoa_claim_copy',
        queryTemplate: '{{brand}} {{product_name}} PFOA free nonstick coating claim site:amazon.com OR manufacturer',
      },
      {
        goal: 'pfas_free_vs_pfoa',
        queryTemplate: '{{brand}} {{product_name}} PFAS free vs PFOA free marketing claim',
      },
    ],
    official_urls: ['https://www.t-fal.ca/en/pfoas/'],
    expected_evidence_fields: ['safety_claims', 'canonical_mappings.safety_claim_ids'],
    canonical_mapping_target: 'safety_claim_ids.pfoa_free_claim',
    pass_criteria_summary: 'PFOA-free documented without treating PFOA-free as PFAS-free.',
  },
]

/**
 * @param {string} checkId
 */
export function getRetrievalTaskForCheck(checkId) {
  return RETRIEVAL_TASK_REGISTRY.find((t) => t.check_id === checkId) ?? null
}

/**
 * Whether a registry task applies for the active pattern triggers.
 * @param {RetrievalTaskDefinition} task
 * @param {Set<string>} triggers
 */
export function isRetrievalTaskTriggered(task, triggers) {
  if (!task.pattern_trigger) return true
  if (triggers.has(task.pattern_trigger)) return true
  // PFOA-vs-PFAS distinction is mandatory for all PTFE primary-contact cookware.
  if (
    task.check_id === 'external.pfoa_vs_pfas_free_distinction' &&
    triggers.has('ptfe_primary_contact')
  ) {
    return true
  }
  return false
}

/**
 * Score-driving external checks that must have retrieval runners for PTFE cookware.
 * (Used by Agent 1 wiring tests — runners live in scripts/agent1/required-check-retrieval/task-runners.mjs)
 */
export const PTFE_REQUIRED_EXTERNAL_CHECK_IDS = [
  'external.regulatory_pfas_minnesota_review',
  'external.pfoa_vs_pfas_free_distinction',
]

/**
 * @param {import('../required-evidence-matrix/validate-required-evidence.mjs').validateRequiredEvidence} validation
 * @param {Set<string>} triggers
 */
export function listPendingRetrievalTasks(validation, triggers) {
  const pending = []
  for (const task of RETRIEVAL_TASK_REGISTRY) {
    if (!isRetrievalTaskTriggered(task, triggers)) continue
    const item = validation?.checklist_items?.find((i) => i.id === task.check_id)
    if (!item) continue
    if (item.status === 'passed' || item.status === 'not_applicable') continue
    if (item.severity === 'blocker' || (item.score_driving && item.status === 'missing')) {
      pending.push(task)
    }
  }
  return pending
}
