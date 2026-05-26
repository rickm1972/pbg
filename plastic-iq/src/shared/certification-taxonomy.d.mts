export type CertificationTaxonomyEntry = {
  id: string
  name: string
  patterns: RegExp[]
  registryDomains: string[]
  registryHomeUrl: string
  pac_relevant: boolean
}

export const CERTIFICATION_TAXONOMY: CertificationTaxonomyEntry[]

export function resolveCertEntry(certName: string): CertificationTaxonomyEntry | null
export function resolveCertTaxonomy(certName: string): CertificationTaxonomyEntry | null
export function isPacRelevant(certName: string): boolean
