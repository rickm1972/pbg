// Every new cert must declare pac_relevant.
// PAC-safety certs (chemical exposure, materials, emissions, migration testing) = true.
// Other certs (cruelty-free, fair trade, animal welfare, ethical sourcing, carbon/climate, B Corp) = false.

/**
 * KNOWN ISSUE (Agent 1 registry verification — not fixed in this build):
 * Branch Basics Leaping Bunny source_url may be leapingbunny.org/news-resources/2022-recommitment
 * (a news page on the registry domain, not a brand- or product-specific registry entry).
 * Future Agent 1 cleanup should require brand-specific or product-specific pages on the registry domain.
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   patterns: RegExp[],
 *   registryDomains: string[],
 *   registryHomeUrl: string,
 *   pac_relevant: boolean,
 * }} CertificationTaxonomyEntry
 */

/** @type {CertificationTaxonomyEntry[]} */
export const CERTIFICATION_TAXONOMY = [
  {
    id: 'made_safe',
    name: 'MADE SAFE',
    patterns: [/made\s*safe/i],
    registryDomains: ['madesafe.org'],
    registryHomeUrl: 'https://www.madesafe.org/',
    pac_relevant: true,
  },
  {
    id: 'ewg_verified',
    name: 'EWG Verified',
    patterns: [/ewg\s*verified/i],
    registryDomains: ['ewg.org', 'verified-portal.ewg.org'],
    registryHomeUrl: 'https://www.ewg.org/ewgverified/products.php',
    pac_relevant: true,
  },
  {
    id: 'leaping_bunny',
    name: 'Leaping Bunny',
    patterns: [/leaping\s*bunny/i],
    registryDomains: ['leapingbunny.org'],
    registryHomeUrl: 'https://www.leapingbunny.org/',
    pac_relevant: false,
  },
  {
    id: 'usda_organic',
    name: 'USDA Organic',
    patterns: [/usda\s*organic/i],
    registryDomains: ['organic.ams.usda.gov', 'usda.gov'],
    registryHomeUrl: 'https://organic.ams.usda.gov/integrity/',
    pac_relevant: true,
  },
  {
    id: 'oeko_tex',
    name: 'OEKO-TEX',
    patterns: [/oeko[\s-]*tex/i],
    registryDomains: ['oeko-tex.com'],
    registryHomeUrl: 'https://www.oeko-tex.com/en/label-check',
    pac_relevant: true,
  },
  {
    id: 'nsf',
    name: 'NSF',
    patterns: [/^nsf\b|nsf\s+certified/i],
    registryDomains: ['nsf.org', 'info.nsf.org'],
    registryHomeUrl: 'https://info.nsf.org/Certified/Food/',
    pac_relevant: true,
  },
  {
    id: 'gots',
    name: 'GOTS',
    patterns: [/\bgots\b|global\s+organic\s+textile/i],
    registryDomains: ['global-standard.org'],
    registryHomeUrl: 'https://global-standard.org/find-suppliers-certificates/',
    pac_relevant: true,
  },
  {
    id: 'bluesign',
    name: 'Bluesign',
    patterns: [/bluesign/i],
    registryDomains: ['bluesign.com'],
    registryHomeUrl: 'https://www.bluesign.com/en/partners',
    pac_relevant: true,
  },
]

/**
 * @param {string} certName
 * @returns {CertificationTaxonomyEntry | null}
 */
export function resolveCertEntry(certName) {
  const s = String(certName ?? '').trim()
  if (!s) return null
  for (const entry of CERTIFICATION_TAXONOMY) {
    if (entry.patterns.some((p) => p.test(s))) return entry
  }
  return null
}

/**
 * @param {string} certName
 * @returns {CertificationTaxonomyEntry | null}
 */
export function resolveCertTaxonomy(certName) {
  return resolveCertEntry(certName)
}

/**
 * @param {string} certName
 * @returns {boolean}
 */
export function isPacRelevant(certName) {
  return resolveCertEntry(certName)?.pac_relevant === true
}
