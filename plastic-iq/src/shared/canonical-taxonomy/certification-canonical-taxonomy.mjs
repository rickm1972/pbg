/**
 * Gate 1 certification canonical IDs — wraps existing PAC certification taxonomy.
 */
import { CERTIFICATION_TAXONOMY } from '../certification-taxonomy.mjs'

/** @typedef {import('./types.mjs').TaxonomyEntry} TaxonomyEntry */

/** @type {TaxonomyEntry[]} */
export const CERTIFICATION_CANONICAL_TAXONOMY = CERTIFICATION_TAXONOMY.map((entry) => ({
  canonical_id: entry.id,
  display_label: entry.name,
  description: `PAC certification taxonomy entry (${entry.pac_relevant ? 'PAC-relevant' : 'not PAC-relevant'}).`,
  aliases: entry.patterns,
  mapping_rule_id: 'certification_taxonomy_resolve_v1',
  taxonomy_file: 'certification-taxonomy.mjs',
  pac_relevant: entry.pac_relevant,
}))

export { CERTIFICATION_TAXONOMY, resolveCertEntry } from '../certification-taxonomy.mjs'
