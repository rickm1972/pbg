/**
 * Layer 1 — component roles (composable building blocks).
 */

/** @type {Record<string, { id: string, label: string, agent2_role?: string }>} */
export const COMPONENT_ROLES = {
  primary_contact_surface: {
    id: 'primary_contact_surface',
    label: 'Primary contact surface',
    agent2_role: 'primary_food_contact',
  },
  container_body: { id: 'container_body', label: 'Container body', agent2_role: 'structural' },
  lid_cap: { id: 'lid_cap', label: 'Lid / cap', agent2_role: 'lid' },
  seal_gasket: { id: 'seal_gasket', label: 'Seal / gasket', agent2_role: 'gasket' },
  straw_spout: { id: 'straw_spout', label: 'Straw / spout', agent2_role: 'primary_food_contact' },
  handle_grip: { id: 'handle_grip', label: 'Handle / grip', agent2_role: 'handle' },
  coating_lining: { id: 'coating_lining', label: 'Coating / lining', agent2_role: 'coating' },
  interior_layer: { id: 'interior_layer', label: 'Interior layer', agent2_role: 'primary_food_contact' },
  exterior_layer: { id: 'exterior_layer', label: 'Exterior layer', agent2_role: 'structural' },
  internal_core: {
    id: 'internal_core',
    label: 'Internal core',
    agent2_role: 'structural',
  },
  packaging: { id: 'packaging', label: 'Packaging', agent2_role: 'packaging' },
  consumable_contact_medium: {
    id: 'consumable_contact_medium',
    label: 'Consumable contact medium',
    agent2_role: 'formulation',
  },
}

export const COMPONENT_ROLE_REFS = Object.keys(COMPONENT_ROLES)
