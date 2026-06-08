export const NONE: 'None'
export const CERT_VERIFICATION_ABSENT: 'No third-party certification'

export const WHY_OPTION_LEGACY_ALIASES: Record<string, Record<string, string>>

export const VOCABULARY: {
  primary_material: string[]
  secondary_materials: string[]
  coatings_finishes: string[]
  use_conditions: string[]
  disclosure_quality: string[]
  certifications: string[]
}

export function allowedOptionsForField(fieldKey: string): string[]
export function normalizeWhyThisScoreOption(fieldKey: string, value: string): string
export function isAllowedWhyOption(fieldKey: string, value: string): boolean
export function normalizeDisclosureBadge(badge: string): string
export function sanitizeOptions(selected: string[], fieldKey: string): string[]
export function finalizeOptions(selected: string[], fieldKey: string): string[]
