export type CanonicalFieldMapping = {
  field_key: string
  raw_value: string
  canonical_id: string
  mapping_rule_id: string | null
  source_url: string | null
  source_quote: string | null
  confidence_label: string | null
  display_label?: string | null
  taxonomy_file?: string | null
  agent2_material_id?: string | null
  claimed?: boolean
}

export type CanonicalMappingsPayload = {
  schema_version: string
  primary_contact_material_id?: CanonicalFieldMapping
  substrate_material_id?: CanonicalFieldMapping
  coating_modifier_id?: CanonicalFieldMapping
  pfas_status_id?: CanonicalFieldMapping
  safety_claim_ids?: Record<string, CanonicalFieldMapping>
  regulatory_flag_ids?: CanonicalFieldMapping[]
  secondary_component_material_ids?: Record<string, CanonicalFieldMapping>
  certification_ids?: Record<string, CanonicalFieldMapping>
  blockers?: string[]
}

export {
  TAXONOMY_EXPANSION_REQUIRED,
  isExpansionRequired,
  applyCanonicalMappings,
  getCanonicalApprovalBlockers,
  COOKWARE_SCORE_DRIVING_FIELDS,
  CANONICAL_TAXONOMY_COUNTS,
} from './canonical-taxonomy/index.mjs'
