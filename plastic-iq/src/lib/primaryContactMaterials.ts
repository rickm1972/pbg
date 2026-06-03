import type { NormalizationComponent } from '../types/agent'
import { displayOptions, primaryContactMaterialDisplay } from './whyThisScoreApi'
import { primaryMaterialLabelsFromComponents } from './whyThisScoreSort'

/**
 * Risk Dashboard "Contact material" line — primary surfaces sorted by material_hazard descending
 * (same rule as Agent 2 product description sentence 1 and Why This Score primary material).
 */
export function primaryContactMaterialDisplayFromComponents(
  components: NormalizationComponent[] | null | undefined,
  fallbackPrimaryOptions?: string[],
): string | null {
  const labels = primaryMaterialLabelsFromComponents(components)
  if (labels.length) return labels.join(', ')

  return primaryContactMaterialDisplay(displayOptions(fallbackPrimaryOptions ?? []))
}
