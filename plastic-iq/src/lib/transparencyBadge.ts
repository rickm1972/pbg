/** Layer 4B transparency badge colors (Agent 2 / V2.3.3). */
export function transparencyBadgeStyle(badge: string): {
  bg: string
  ring: string
  icon: string
  text: string
} {
  const n = badge.toLowerCase()
  if (n.includes('full verified')) {
    return {
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-200',
      icon: 'text-emerald-700',
      text: 'text-emerald-900',
    }
  }
  if (n.includes('full disclosed')) {
    return {
      bg: 'bg-blue-50',
      ring: 'ring-blue-200',
      icon: 'text-blue-700',
      text: 'text-blue-900',
    }
  }
  if (n.includes('partial')) {
    return {
      bg: 'bg-amber-50',
      ring: 'ring-amber-200',
      icon: 'text-amber-700',
      text: 'text-amber-900',
    }
  }
  if (n.includes('limited')) {
    return {
      bg: 'bg-orange-50',
      ring: 'ring-orange-200',
      icon: 'text-orange-700',
      text: 'text-orange-900',
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
  return {
    bg: 'bg-slate-50',
    ring: 'ring-slate-200',
    icon: 'text-slate-600',
    text: 'text-slate-900',
  }
}

/** Plain-English one-liner shown under the badge on product pages. */
export function transparencyBadgeSummary(badge: string): string {
  const n = badge.toLowerCase()
  if (n.includes('full verified')) {
    return 'Full Verified — independent lab testing confirms materials.'
  }
  if (n.includes('full disclosed')) {
    return 'Full Disclosed — all materials disclosed by the manufacturer; nothing inferred.'
  }
  if (n.includes('partial')) {
    return 'Partial Disclosure — most materials confirmed, some details unverified.'
  }
  if (n.includes('limited')) {
    return 'Limited Disclosure — materials mostly inferred from product type and description.'
  }
  if (n.includes('opaque')) {
    return 'Opaque — materials unknown or not verifiable from available sources.'
  }
  return `${badge} — how completely we know what this product is made of.`
}
