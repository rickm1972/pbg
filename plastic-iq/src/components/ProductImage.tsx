import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'

export function ProductImage({
  src,
  name,
  className,
  fit = 'contain',
  decorative = false,
}: {
  src: string | null
  name: string
  className?: string
  fit?: 'contain' | 'cover'
  /** When true, alt is empty (adjacent visible title is the label). */
  decorative?: boolean
}) {
  const [broken, setBroken] = useState(false)

  const initials = useMemo(
    () =>
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || 'PS',
    [name],
  )

  const showImg = Boolean(src && !broken)

  if (showImg) {
    return (
      <img
        src={src ?? undefined}
        alt={decorative ? '' : name}
        loading="lazy"
        className={cn(
          'h-full w-full bg-transparent',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className,
        )}
        onError={(e) => {
          setBroken(true)
          ;(e.currentTarget as HTMLImageElement).alt = `${name} image failed to load`
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        'grid h-full w-full place-items-center bg-gradient-to-br from-slate-50 to-slate-200 text-slate-600',
        className,
      )}
      aria-label={`${name} image placeholder`}
    >
      <span className="text-sm font-semibold">{initials}</span>
    </div>
  )
}

