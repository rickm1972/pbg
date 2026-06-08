/** Layout-only badge styling tokens — maps Agent 3 badge strings to CSS classes. */

export function badgeStyleTokens(badge: string): {
  bg: string
  ring: string
  icon: string
  text: string
} {
  const n = badge.toLowerCase()
  if (/^full(y)?\s+disclosed$/i.test(badge)) {
    return {
      bg: 'bg-blue-50',
      ring: 'ring-blue-200',
      icon: 'text-blue-700',
      text: 'text-blue-900',
    }
  }
  if (n.includes('documentation incomplete')) {
    return {
      bg: 'bg-sky-50',
      ring: 'ring-sky-200',
      icon: 'text-sky-700',
      text: 'text-sky-900',
    }
  }
  if (n.includes('material uncertain')) {
    return {
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
      icon: 'text-amber-700',
      text: 'text-amber-900',
    }
  }
  if (n.includes('opaque')) {
    return {
      bg: 'bg-red-50',
      ring: 'ring-red-200',
      icon: 'text-red-700',
      text: 'text-red-900',
    }
  }
  if (n.includes('partial') || n.includes('limited')) {
    return {
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
      icon: 'text-amber-700',
      text: 'text-amber-900',
    }
  }
  return {
    bg: 'bg-slate-50',
    ring: 'ring-slate-200',
    icon: 'text-slate-600',
    text: 'text-slate-900',
  }
}

const RISK_BAR_COLORS: Record<string, { text: string; bar: string }> = {
  emerald: { text: 'text-emerald-700', bar: 'bg-emerald-500' },
  amber: { text: 'text-amber-700', bar: 'bg-amber-500' },
  red: { text: 'text-red-700', bar: 'bg-red-500' },
}

export function riskBarStyleTokens(colorToken: string): { text: string; bar: string } {
  return RISK_BAR_COLORS[colorToken] ?? RISK_BAR_COLORS.emerald
}
