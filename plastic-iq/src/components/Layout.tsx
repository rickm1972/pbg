import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './nav/BottomNav'
import { TopNav } from './nav/TopNav'
import { Footer } from './Footer'

export function Layout() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const usesOverlayNav =
    !isAdmin &&
    (location.pathname === '/' ||
      location.pathname === '/categories' ||
      location.pathname === '/about' ||
      location.pathname === '/whyplasticbegone')

  return (
    <div className="min-h-dvh bg-[#fdfcf9] font-sans text-ink-900 antialiased">
      {usesOverlayNav ? null : <TopNav />}
      <main className={isAdmin ? 'pb-20' : 'pb-24 md:pb-0'}>
        <Outlet />
      </main>
      {isAdmin ? null : <Footer />}
      <BottomNav />
    </div>
  )
}

