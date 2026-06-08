/**
 * Layer B — risk-bar contract fixture (Oura-style spec from published baseline shape).
 */

import type { AprDisplayRiskBar } from '../../../types/apr'

/** Representative risk bars matching Lodge published baseline / Agent 2 contract. */
export const FIXTURE_RISK_BARS_LODGE_SHAPE: AprDisplayRiskBar[] = [
  {
    id: 'material',
    label: 'Contact material: Cast iron',
    fill_percent: 99,
    color_token: 'emerald',
    status_label: 'Minimal PAC concern',
  },
  {
    id: 'migration',
    label: 'Migration',
    fill_percent: 100,
    color_token: 'emerald',
    status_label: 'Low migration',
  },
  {
    id: 'use_conditions',
    label: 'Use conditions',
    fill_percent: 80,
    color_token: 'amber',
    status_label: 'Standard',
  },
]
