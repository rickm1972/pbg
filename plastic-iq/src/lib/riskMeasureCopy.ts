export const RISK_MEASURE_INTRO = 'Every product is evaluated on three factors:'

export const RISK_MEASURE_FACTORS = [
  {
    name: 'Contact material',
    description: 'what material touches your food, drink, or skin',
  },
  {
    name: 'Migration',
    description: 'how easily that material transfers chemicals',
  },
  {
    name: 'Use conditions',
    description: 'how intensely the product is used (heat, fat, contact time)',
  },
] as const

export const RISK_MEASURE_CLOSING =
  'Risk emerges when all three factors combine. Some products can still score well even when one factor is concerning — for example, cast iron cookware faces harsh use conditions but remains low concern because the material is inert.'
