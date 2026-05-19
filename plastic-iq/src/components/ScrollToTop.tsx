import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Reset scroll position when the route changes (incl. bottom nav on mobile). */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search, hash])

  return null
}
