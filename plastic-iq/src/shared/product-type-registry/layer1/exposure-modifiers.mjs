/**
 * Layer 1 — exposure modifiers (composable building blocks).
 */

/** @type {Record<string, { id: string, label: string }>} */
export const EXPOSURE_MODIFIERS = {
  heat: { id: 'heat', label: 'Heat exposure' },
  microwave: { id: 'microwave', label: 'Microwave exposure' },
  freezing: { id: 'freezing', label: 'Freezing / cold storage' },
  dishwasher: { id: 'dishwasher', label: 'Dishwasher exposure' },
  acidic: { id: 'acidic', label: 'Acidic food exposure' },
  fatty: { id: 'fatty', label: 'Fatty food exposure' },
  wet: { id: 'wet', label: 'Wet / aqueous exposure' },
  abrasion: { id: 'abrasion', label: 'Abrasion / wear' },
  long_duration_storage: { id: 'long_duration_storage', label: 'Long-duration storage' },
  repeated_daily_use: { id: 'repeated_daily_use', label: 'Repeated daily use' },
  leave_on: { id: 'leave_on', label: 'Leave-on contact' },
  rinse_off: { id: 'rinse_off', label: 'Rinse-off contact' },
  uv_outdoor: { id: 'uv_outdoor', label: 'UV / outdoor exposure' },
}

export const EXPOSURE_MODIFIER_REFS = Object.keys(EXPOSURE_MODIFIERS)
