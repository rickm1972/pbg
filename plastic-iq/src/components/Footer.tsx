import { Link } from 'react-router-dom'
import footerLogo from '../assets/plastic-begone-footer-logo-transparent-cropped.png'
import { PRIMARY_NAV } from './nav/primaryNav'

export function Footer() {
  return (
    <footer className="hidden bg-transparent md:block">
      <div className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
        <div className="w-full bg-forest-deep py-2.5 text-white">
          <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src={footerLogo}
                alt="PlasticBegone"
                className="h-11 w-auto max-w-[min(680px,64vw)] object-contain object-left"
              />

              <div className="hidden min-w-0 flex-col leading-tight text-white/80 sm:flex">
                <div className="text-[11px] font-semibold text-white/85">Making plastic disappear.</div>
                <div className="text-[11px] text-white/65">© 2026 PlasticBegone. All rights reserved.</div>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-white/80 sm:justify-end sm:gap-x-7">
              {PRIMARY_NAV.map((item) => (
                <FooterLink key={item.to} to={item.to}>
                  {item.label}
                </FooterLink>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="transition hover:text-white">
      {children}
    </Link>
  )
}
