/**
 * Layer 1 — universal contact models (composable building blocks).
 */

/** @type {Record<string, { id: string, label: string, description: string }>} */
export const CONTACT_MODELS = {
  food_contact: {
    id: 'food_contact',
    label: 'Food contact',
    description: 'Direct or indirect contact with food during preparation, storage, or serving.',
  },
  drink_contact: {
    id: 'drink_contact',
    label: 'Drink contact',
    description: 'Direct oral contact with beverages during drinking.',
  },
  mouth_contact: {
    id: 'mouth_contact',
    label: 'Mouth contact',
    description: 'Infant/toy oral mouthing without ingestion as primary use.',
  },
  skin_contact_leave_on: {
    id: 'skin_contact_leave_on',
    label: 'Skin contact (leave-on)',
    description: 'Prolonged skin contact; product remains on skin after application.',
  },
  skin_contact_rinse_off: {
    id: 'skin_contact_rinse_off',
    label: 'Skin contact (rinse-off)',
    description: 'Brief skin contact; product is rinsed or washed away.',
  },
  child_contact: {
    id: 'child_contact',
    label: 'Child contact',
    description: 'Elevated sensitivity pathway for children and infant-design products.',
  },
  packaging_only: {
    id: 'packaging_only',
    label: 'Packaging only',
    description: 'Outer container; formulation or product dispensed elsewhere.',
  },
  indirect_contact: {
    id: 'indirect_contact',
    label: 'Indirect contact',
    description: 'Non-primary surfaces; incidental or secondary exposure pathways.',
  },
  non_contact_internal_structural: {
    id: 'non_contact_internal_structural',
    label: 'Non-contact internal / structural',
    description: 'Bonded internal cores and structural components without food contact.',
  },
}

export const CONTACT_MODEL_REFS = Object.keys(CONTACT_MODELS)
