import type { ProductPageScore } from './productScoresApi'
import { rewriteLegacyInertPublicDescription } from './nonPacInertMaterials'

/** Public lists only show products with an approved numeric PAC score. */
export function hasPublicDisplayScore(product: {
  pac_safety_score: number | null | undefined
}): boolean {
  return typeof product.pac_safety_score === 'number' && Number.isFinite(product.pac_safety_score)
}

export function filterPublicListProducts<T extends { pac_safety_score: number | null | undefined }>(
  products: T[],
): T[] {
  return products.filter(hasPublicDisplayScore)
}

export function hasApprovedPageScore(pageScore: ProductPageScore | null | undefined): boolean {
  return (
    pageScore != null &&
    typeof pageScore.pac_safety_score === 'number' &&
    Number.isFinite(pageScore.pac_safety_score)
  )
}

/** Soften absolute chemical-release phrasing on stored public descriptions. */
const INERT_DESCRIPTION_ABSOLUTE =
  /does not transfer plastic-associated chemicals into food/gi
const INERT_DESCRIPTION_SOFT =
  'is not expected to meaningfully transfer plastic-associated chemicals into food under typical kitchen use'

const UNCERTAINTY_SENTENCE_RE =
  /because (key food-contact chemistry|the exact coating formulation) is not fully disclosed,\s*(?:the score includes\s*)?(?:added uncertainty(?: in the confidence interval)?|that uncertainty is reflected in the score and transparency badge)\.?/gi

const LEGACY_USE_UNCERTAINTY_RE =
  /It's used for ([^;]+);\s*because (key food-contact chemistry|the exact coating formulation) is not fully disclosed/gi

const AWKWARD_USE_HEAT_RE =
  /It is used with oven heat with fat exposure and stovetop heat, including fat exposure/gi

const DUPLICATE_USE_HEAT_RE =
  /It's used for oven heat with fat exposure and stovetop heat with fat exposure/gi

export function softenPublicDescription(text: string): string {
  const softened = text
    .replace(
      AWKWARD_USE_HEAT_RE,
      'oven and stovetop heat, including fat exposure',
    )
    .replace(DUPLICATE_USE_HEAT_RE, 'oven and stovetop heat, including fat exposure')
    .replace(LEGACY_USE_UNCERTAINTY_RE, (_m, usePart: string, chemistry: string) => {
      let use = String(usePart)
      if (/oven/i.test(use) && /stovetop/i.test(use)) {
        use = 'oven and stovetop heat, including fat exposure'
      } else {
        use = use
          .replace(/\s+with fat exposure$/i, ', including fat exposure')
          .replace(/^oven heat and stovetop heat$/i, 'oven and stovetop heat, including fat exposure')
      }
      return `It is used with ${use}. Because ${chemistry} is not fully disclosed`
    })
    .replace(
      UNCERTAINTY_SENTENCE_RE,
      'Because $1 is not fully disclosed, that uncertainty is reflected in the score and transparency badge.',
    )
    .replace(
      /the score includes that uncertainty is reflected/gi,
      'that uncertainty is reflected',
    )
    .replace(
      /added uncertainty in the confidence interval/gi,
      'that uncertainty is reflected in the score and transparency badge',
    )
    .replace(INERT_DESCRIPTION_ABSOLUTE, INERT_DESCRIPTION_SOFT)
    .replace(
      /conditions that accelerate chemical release from PFAS/gi,
      'conditions associated with greater release potential for PFAS-related nonstick coatings',
    )
    .replace(
      /conditions that accelerate chemical release from/gi,
      'conditions associated with greater release potential for',
    )
    .replace(
      /conditions that accelerate chemical migration from coatings/gi,
      'conditions associated with greater migration potential from coatings',
    )

  return rewriteLegacyInertPublicDescription(softened)
}

export const PUBLIC_SCORE_PENDING_MESSAGE = 'Product not yet reviewed'

export const SAFER_ALTERNATIVES_COMING_SOON =
  'Safer alternatives coming soon — we’re reviewing lower-risk options in this category.'

export const HIGH_RISK_RETAILER_NOTE =
  'This product is rated High Risk by PlasticBegone.'

/** Section heading for retailer CTAs by PAC tier. */
export function publicRetailerSectionTitle(tier: string | null | undefined): string {
  if (tier === 'Excellent' || tier === 'Good') return 'Where to buy'
  return 'Product listings'
}

/** Caution note beside retailer CTAs on lower tiers (public product pages). */
export function publicRetailerCautionNote(tier: string | null | undefined): string | null {
  if (tier === 'High Risk') return HIGH_RISK_RETAILER_NOTE
  return null
}
