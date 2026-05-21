/** Layer 4B transparency badges (V2.3.4 public labels). */
export function transparencyBadgeStyle(badge: string): {
  bg: string
  ring: string
  icon: string
  text: string
} {
  const n = badge.toLowerCase()
  if (n.includes('full disclosed')) {
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
  if (n.includes('full disclosed')) {
    return 'Full Disclosed — all materials disclosed by the manufacturer; nothing inferred.'
  }
  if (n.includes('documentation incomplete')) {
    return 'Documentation Incomplete — most materials are known; minor details (grade, finish) are unconfirmed.'
  }
  if (n.includes('material uncertain')) {
    return 'Material Uncertain — some food-contact materials are inferred or span multiple plausible hazard levels.'
  }
  if (n.includes('opaque')) {
    return 'Opaque — a food-contact coating or material is unknown or not verifiable from available sources.'
  }
  if (n.includes('partial')) {
    return 'Partial Disclosure — legacy label; most materials confirmed, some details unverified.'
  }
  if (n.includes('limited')) {
    return 'Limited Disclosure — legacy label; materials mostly inferred from product type.'
  }
  return `${badge} — how completely we know what this product is made of.`
}
