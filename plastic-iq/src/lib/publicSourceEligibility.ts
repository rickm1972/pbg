import {
  retailerListingMatchesProductVariant,
} from './retailerVariantMatch'
import { normalizeUrlKey, hostOf, type PublicProductSource } from './publicSourceDisplay'
import type { PublicDisplayContract } from './publicProductDisplayContract'
import {
  stripPublicSourceRolePrefix,
  urlPathContainsSizeSlug,
} from './publicSourceTitleFormat'

export type PublicSourceContractEligibility = {
  public_source_eligible: boolean
  hide_reason?: string
}

function parseSlugDecimalInch(wholePart: string, fracPart: string): number | null {
  const whole = Number(wholePart)
  const frac = Number(fracPart)
  if (!Number.isFinite(whole) || !Number.isFinite(frac)) return null
  if (fracPart.length === 2 && frac === 25) return whole + 0.25
  if (fracPart.length === 1 && frac < 10) return whole + frac / 10
  return null
}

/** Inch sizes explicitly stated in prose (avoids G5 / slug false positives). */
function explicitTitleInchSizes(text: string): number[] {
  const sizes: number[] = []
  const re = /(\d+(?:\.\d+)?)\s*(?:inch|in\.?|")\b/gi
  for (const match of String(text ?? '').matchAll(re)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  return [...new Set(sizes)]
}

/** Inch sizes encoded in product URL slugs such as `12-5-inch`. */
function explicitProductUrlInchSizes(url: string): number[] {
  const path = urlPathname(url).toLowerCase()
  const sizes: number[] = []
  for (const match of path.matchAll(/(\d{1,2})-(\d{1,2})-inch/gi)) {
    const parsed = parseSlugDecimalInch(match[1], match[2])
    if (parsed != null) sizes.push(parsed)
  }
  for (const match of path.matchAll(/(\d+(?:\.\d+)?)-inch/gi)) {
    const n = Number(match[1])
    if (Number.isFinite(n)) sizes.push(n)
  }
  return [...new Set(sizes)]
}

function sourceVariantConflictsReviewedProduct(
  reviewedProductName: string,
  url: string,
  title: string,
): boolean {
  const productSizes = explicitTitleInchSizes(reviewedProductName)
  if (!productSizes.length) return false

  const sourceSizes = [
    ...explicitProductUrlInchSizes(url),
    ...explicitTitleInchSizes(stripPublicSourceRolePrefix(title)),
  ]
  if (!sourceSizes.length) return false

  return !sourceSizes.some((s) =>
    productSizes.some((p) => Math.abs(s - p) < 0.15),
  )
}

export function manufacturerTitleConflictsReviewedIdentity(
  sourceTitle: string,
  reviewedProductName: string,
): boolean {
  const sourceSizes = explicitTitleInchSizes(sourceTitle)
  const productSizes = explicitTitleInchSizes(reviewedProductName)
  if (!sourceSizes.length || !productSizes.length) return false
  return !sourceSizes.some((s) => productSizes.some((p) => Math.abs(s - p) < 0.15))
}

function urlPathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function isManufacturerProductPath(url: string): boolean {
  const path = urlPathname(url)
  return /\/products?\//i.test(path) || urlPathContainsSizeSlug(path)
}

function isManufacturerCollectionPath(url: string): boolean {
  return /\/collections?\//i.test(urlPathname(url))
}

function manufacturerHostMatchesBrand(url: string, brand: string | null | undefined): boolean {
  const normalizedBrand = String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!normalizedBrand) return false
  const host = hostOf(url).replace(/[^a-z0-9]/g, '')
  return host.includes(normalizedBrand)
}

/**
 * Derived public display contract: whether a source may render on the product page.
 * Variant-mismatched manufacturer/context product pages are excluded — not renamed.
 */
export function resolvePublicSourceContractEligibility(
  source: Pick<
    PublicProductSource,
    'url' | 'title' | 'public_label' | 'public_status' | 'source_type'
  >,
  contract: PublicDisplayContract | null | undefined,
): PublicSourceContractEligibility {
  const reviewed = contract?.reviewedProductName?.trim() ?? ''
  if (!reviewed) {
    return { public_source_eligible: true }
  }

  const url = source.url?.trim() ?? ''
  const title = stripPublicSourceRolePrefix(source.title?.trim() ?? '')
  if (!url) {
    return { public_source_eligible: false, hide_reason: 'Missing source URL.' }
  }

  if (
    source.public_label === 'Retailer' &&
    source.public_status === 'primary' &&
    contract?.primaryRetailerUrl &&
    normalizeUrlKey(url) === normalizeUrlKey(contract.primaryRetailerUrl)
  ) {
    return { public_source_eligible: true }
  }

  if (source.public_label === 'Manufacturer') {
    const isProductPath = isManufacturerProductPath(url)
    const isCollection = isManufacturerCollectionPath(url)

    if (sourceVariantConflictsReviewedProduct(reviewed, url, title)) {
      return {
        public_source_eligible: false,
        hide_reason:
          'Manufacturer source references a different product variant than the reviewed listing.',
      }
    }

    if (isProductPath) {
      return { public_source_eligible: true }
    }

    if (isCollection) {
      return { public_source_eligible: true }
    }

    if (
      urlPathContainsSizeSlug(urlPathname(url)) &&
      !retailerListingMatchesProductVariant(reviewed, url, title, {
        strictMissingSize: true,
      })
    ) {
      return {
        public_source_eligible: false,
        hide_reason:
          'Manufacturer source references a different product variant than the reviewed listing.',
      }
    }
    return { public_source_eligible: true }
  }

  if (source.public_label === 'Retailer') {
    if (
      !retailerListingMatchesProductVariant(reviewed, url, title, {
        strictMissingSize: false,
      })
    ) {
      return {
        public_source_eligible: false,
        hide_reason: 'Retailer listing does not match the reviewed product variant.',
      }
    }
    return { public_source_eligible: true }
  }

  if (source.public_label === 'Context') {
    const onManufacturerHost =
      manufacturerHostMatchesBrand(url, contract?.brand) || isManufacturerProductPath(url)
    if (
      onManufacturerHost &&
      isManufacturerProductPath(url) &&
      sourceVariantConflictsReviewedProduct(reviewed, url, title)
    ) {
      return {
        public_source_eligible: false,
        hide_reason:
          'Context source points to a different manufacturer product variant than the reviewed listing.',
      }
    }
  }

  return { public_source_eligible: true }
}

/** Keep only sources marked eligible under the public display contract. */
export function filterPublicSourcesByContractEligibility(
  sources: PublicProductSource[],
  contract: PublicDisplayContract | null | undefined,
): PublicProductSource[] {
  return sources.filter((source) => {
    const eligibility = resolvePublicSourceContractEligibility(source, contract)
    return eligibility.public_source_eligible
  })
}
