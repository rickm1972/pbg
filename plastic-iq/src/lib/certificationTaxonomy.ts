/** Thin TS re-export — taxonomy data lives only in src/shared/certification-taxonomy.mjs */
export type { CertificationTaxonomyEntry } from '../shared/certification-taxonomy.d.mts'
export {
  CERTIFICATION_TAXONOMY,
  isPacRelevant,
  resolveCertEntry,
  resolveCertTaxonomy,
} from '../shared/certification-taxonomy.mjs'
