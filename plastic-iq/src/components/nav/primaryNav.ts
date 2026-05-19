import type { LucideIcon } from 'lucide-react'
import { Home, Info, Layers, Sparkles } from 'lucide-react'

export type PrimaryNavItem = {
  readonly to: string
  readonly label: string
  /** Only `true` for home — used by React Router `NavLink end` */
  readonly end?: boolean
  readonly Icon: LucideIcon
}

/** Single source of truth for main app nav (top bar + mobile bottom bar). */
export const PRIMARY_NAV: readonly PrimaryNavItem[] = [
  { to: '/', label: 'Home', end: true, Icon: Home },
  { to: '/categories', label: 'Categories', Icon: Layers },
  { to: '/whyplasticbegone', label: 'Why PlasticBegone?', Icon: Sparkles },
  { to: '/about', label: 'About', Icon: Info },
] as const
