import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { PRIMARY_NAV } from './primaryNav'

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-4 px-1 py-2 sm:px-2">
        {PRIMARY_NAV.map((item) => (
          <BottomNavItem
            key={item.to}
            to={item.to}
            label={item.label}
            end={item.end ?? false}
            icon={
              <item.Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={item.to === '/whyplasticbegone' ? 1.75 : 2}
                aria-hidden
              />
            }
          />
        ))}
      </div>
    </nav>
  )
}

function BottomNavItem({
  to,
  label,
  icon,
  end = false,
}: {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[10px] font-medium leading-tight text-slate-600 sm:gap-1 sm:px-2 sm:text-xs',
          isActive ? 'text-ink-900' : 'hover:bg-slate-100',
        )
      }
    >
      {icon}
      <span className="max-w-[5.5rem] text-pretty sm:max-w-none">{label}</span>
    </NavLink>
  )
}

