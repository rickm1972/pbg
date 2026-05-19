import { Link, NavLink, useLocation } from 'react-router-dom'
import plasticBegoneLogo from '../../assets/plastic-begone-logo-transparent.png'
import { cn } from '../../lib/cn'
import { PRIMARY_NAV } from './primaryNav'

export function TopNav({
  variant = 'default',
  overlayPosition = 'fixed',
}: {
  variant?: 'default' | 'overlay'
  overlayPosition?: 'fixed' | 'absolute'
}) {
  const { pathname, hash } = useLocation()

  const isOverlay = variant === 'overlay'

  return (
    <header
      className={cn(
        'left-0 right-0 top-0 z-[100] overflow-x-clip',
        isOverlay ? overlayPosition : 'sticky',
        !isOverlay && 'border-b border-[#dfe6dd]/90 bg-[#fdfcf9]/95 backdrop-blur-md',
        isOverlay && 'border-b border-transparent bg-transparent backdrop-blur-none',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-1 pb-0.5 sm:gap-4 sm:px-6 sm:pt-1.5 sm:pb-1 lg:px-10',
        )}
      >
        <Link
          to="/"
          className="flex min-w-0 shrink-0 items-center"
        >
          <img
            src={plasticBegoneLogo}
            alt="Plastic Begone — Making plastic disappear."
            className={cn(
              'h-[3.75rem] w-auto max-w-[min(78vw,30rem)] origin-left scale-[1.12] object-contain object-left sm:h-[4.25rem] md:h-[5rem] lg:h-[5.5rem] md:scale-[1.16]',
              isOverlay && 'drop-shadow-[0_1px_2px_rgba(255,255,255,0.65)]',
            )}
          />
        </Link>

        <nav
          className={cn(
            'hidden flex-1 justify-center gap-0.5 md:flex xl:gap-1.5',
          )}
        >
          {PRIMARY_NAV.map(({ Icon: _Icon, ...item }) => (
            <TopNavItem
              key={item.to + item.label}
              to={item.to}
              label={item.label}
              end={item.end ?? false}
              pathname={pathname}
              locationHash={hash}
              overlay={isOverlay}
            />
          ))}
        </nav>
      </div>
    </header>
  )
}

function linkMatches(
  to: string,
  pathname: string,
  locationHash: string,
  end: boolean,
): boolean {
  const [pathPart, frag] = to.split('#')
  const pathOnly = pathPart ?? to

  if (frag) {
    return pathname === pathOnly && locationHash === `#${frag}`
  }
  if (end) return pathname === pathOnly
  if (pathOnly === '/') return pathname === '/'
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`)
}

function TopNavItem({
  to,
  label,
  end,
  pathname,
  locationHash,
  mobile,
  overlay,
}: {
  to: string
  label: string
  end: boolean
  pathname: string
  locationHash: string
  mobile?: boolean
  overlay?: boolean
}) {
  const active = linkMatches(to, pathname, locationHash, end)

  const desktopIdle = overlay ? 'text-ink-900' : 'text-forest-deep/90'

  return (
    <NavLink
      to={to}
      end={end}
      className={cn(
        mobile
          ? 'rounded-xl px-3 py-3 text-base font-semibold'
          : 'rounded-md px-2.5 py-2 text-sm font-semibold xl:px-3.5',
        'transition-colors',
        mobile ? 'text-forest-deep' : desktopIdle,
        !mobile &&
          !overlay &&
          'hover:text-forest',
        !mobile && overlay && 'hover:text-forest-deep',
        active
          ? mobile
            ? 'bg-white text-forest shadow-sm ring-1 ring-[#dfe6dd]'
            : cn(
                'text-forest underline decoration-forest decoration-2 underline-offset-[11px]',
                !overlay && 'decoration-forest',
              )
          : mobile
            ? 'text-forest-deep/90 hover:bg-white/55'
            : cn(
                'hover:underline hover:decoration-forest/45 hover:underline-offset-[11px]',
                overlay && 'hover:decoration-ink-900/30',
              ),
      )}
    >
      {label}
    </NavLink>
  )
}
