import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, FlaskConical, Layers, Route, ShieldCheck, Users, Waves } from 'lucide-react'
import aboutHero from '../assets/about-hero.png'
import aboutFtcCard from '../assets/about-ftc-card.png'
import aboutCtaBanner from '../assets/about-cta-banner.png'
import { PacTierAboutGrid } from '../components/PacTierLegend'
import { TopNav } from '../components/nav/TopNav'
import {
  RISK_MEASURE_CLOSING,
  RISK_MEASURE_INTRO,
} from '../lib/riskMeasureCopy'

const PAC_SAFETY_CERTIFICATIONS = [
  {
    name: 'MADE SAFE',
    description: 'Comprehensive human health and ecosystem hazard screening',
  },
  {
    name: 'EWG Verified',
    description:
      'Ingredient transparency and hazard criteria for cleaning and personal care',
  },
  { name: 'NSF', description: 'Food contact materials standards' },
  { name: 'OEKO-TEX Standard 100', description: 'Harmful substance testing for textiles' },
  { name: 'GOTS', description: 'Global Organic Textile Standard' },
  { name: 'Bluesign', description: 'Chemical management in textile production' },
  { name: 'USDA Organic', description: 'Organic material verification' },
] as const

/** Matches Home / Why PlasticBegone section titles (Playfair, xl). */
const SECTION_TITLE = 'font-display text-xl font-semibold tracking-tight text-ink-900'

export function AboutPage() {
  return (
    <div className="bg-transparent">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-x-clip bg-[#fdfcf9]">
          <TopNav variant="overlay" overlayPosition="absolute" />

          <section className="bg-transparent pb-0 pt-0">
            <div className="relative pb-1 sm:pb-1.5">
              <div className="relative isolate z-0 min-h-[17rem] overflow-hidden rounded-[1.65rem] bg-[#eef7ef] shadow-[0_28px_70px_-28px_rgba(15,61,38,0.35)] ring-1 ring-black/[0.04] sm:min-h-[18rem] md:min-h-[19rem] md:rounded-[1.85rem] lg:min-h-[20rem]">
                <img
                  src={aboutHero}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover object-[44%_42%] sm:object-[46%_42%]"
                  loading="eager"
                />

                <div
                  className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[92%] bg-gradient-to-r from-[#fbfaf7]/96 via-[#fbfaf7]/72 to-transparent sm:w-[84%] md:w-[72%] lg:w-[58%]"
                  aria-hidden
                />

                <div className="relative z-10 flex flex-col px-4 pb-10 pt-20 sm:px-6 sm:pb-11 sm:pt-24 lg:px-10 lg:pb-12 lg:pt-28">
                  <div className="max-w-[22.5rem] sm:max-w-[23.5rem] lg:max-w-[26rem]">
                    <div className="text-xs font-medium text-slate-600">
                      <Link to="/" className="hover:text-ink-900">
                        Home
                      </Link>
                      <span className="mx-2 text-slate-300">›</span>
                      <span className="text-slate-700">About</span>
                    </div>

                    <h1 className="mt-4 font-display text-balance text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.1rem] xl:text-[3.35rem]">
                      Making plastic disappear from everyday life.
                    </h1>
                    <p className="mt-4 text-pretty text-sm font-medium leading-relaxed text-slate-700 sm:text-[0.9375rem] lg:text-base">
                      PlasticBegone is our science-based rating system that helps you identify safer products
                      and reduce exposure to plastic-associated chemicals.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="relative z-20 -mt-5 grid scroll-mt-28 gap-3 sm:-mt-6 md:-mt-7 md:grid-cols-3 md:gap-4"
              >
                <Highlight
                  icon={<ShieldCheck className="h-6 w-6 text-emerald-700" />}
                  iconTone="emerald"
                  title="Science-first"
                  body="We ground every score in materials science, toxicology, and emerging research."
                />
                <Highlight
                  icon={<FlaskConical className="h-6 w-6 text-blue-700" />}
                  iconTone="blue"
                  title="Transparent"
                  body="Clear scoring, evidence tiers, and methodology you can trust and explore."
                />
                <Highlight
                  icon={<Users className="h-6 w-6 text-violet-700" />}
                  iconTone="violet"
                  title="Consumer-first"
                  body="Designed to help you make safer, everyday choices for you and your family."
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-0 md:px-6 md:pb-7 md:pt-0">
        <div className="grid gap-4">
          <Panel
            title="What are plastic-associated chemicals?"
            subtitle="Plastic-associated chemicals include families such as phthalates, bisphenols, PFAS, and parabens. Depending on product design and conditions of use (heat, acidity, fats, abrasion), chemicals may migrate from materials into food, beverages, or onto skin."
            right={
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className="text-xs font-semibold text-slate-600">Common chemical families</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    'Phthalates',
                    'Bisphenols',
                    'PFAS',
                    'Parabens',
                    'Flame retardants',
                    'Other additives',
                  ].map((x) => (
                    <span
                      key={x}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            }
          />

          <div
            id="methodology"
            className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card scroll-mt-28"
          >
            <div>
              <h2 className={SECTION_TITLE}>How the PAC Safety Score is calculated</h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-700">
                Scores are driven by expected exposure risk based on materials, construction, and
                available evidence. We emphasize direct-contact surfaces (food, drink, skin contact)
                and conditions that increase migration risk.
              </p>
            </div>

            <div className="space-y-3">
              <PacTierAboutGrid />
              <p className="border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-700">
                The PAC Safety Score is not an overall product quality score. It reflects expected chemical
                exposure risk from plastic-associated sources.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className={SECTION_TITLE}>How we measure risk</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {RISK_MEASURE_INTRO}
            </p>
            <div className="mt-4 grid items-stretch gap-3 md:grid-cols-3">
              <RiskFactorCard
                icon={<Layers className="h-5 w-5 text-emerald-700" />}
                iconTone="emerald"
                title="Contact material"
                body="What material touches your food, drink, or skin."
              />
              <RiskFactorCard
                icon={<Waves className="h-5 w-5 text-blue-700" />}
                iconTone="blue"
                title="Migration"
                body="How easily that material transfers chemicals."
              />
              <RiskFactorCard
                icon={<Route className="h-5 w-5 text-violet-700" />}
                iconTone="violet"
                title="Use conditions"
                body="How intensely the product is used (heat, fat, contact time)."
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{RISK_MEASURE_CLOSING}</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
                    <BadgeCheck className="h-4 w-4 text-emerald-700" aria-hidden />
                  </span>
                  <h2 className={SECTION_TITLE}>Verified certifications</h2>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  We only credit certifications we can verify in the certifying body&apos;s own registry. A
                  product page may claim &apos;MADE SAFE Certified&apos; on its label, but we check madesafe.org
                  directly to confirm the product is listed there. If we can&apos;t verify it on the registry, we
                  don&apos;t credit it.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs leading-relaxed text-emerald-900 ring-1 ring-emerald-200/70">
                <div className="font-semibold uppercase tracking-wide">What “verified” means</div>
                <p className="mt-1 text-[0.78rem]">
                  A certification only shows up on a product page after we match the brand and product in the
                  certifier&apos;s own public registry entry.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[0.78rem] font-semibold uppercase tracking-wide text-slate-500">
                Certifications we recognize for PAC safety
              </p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PAC_SAFETY_CERTIFICATIONS.map((cert) => (
                  <li
                    key={cert.name}
                    className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-[0_10px_40px_-24px_rgba(15,61,38,0.35)] ring-1 ring-slate-200/80"
                  >
                    <div className="text-sm font-semibold text-ink-900">{cert.name}</div>
                    <div className="mt-1 text-sm text-slate-600">{cert.description}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.78rem] leading-relaxed text-slate-500">
                On product pages, each certification links out to the certifying body&apos;s registry entry so
                you can verify it yourself.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className={SECTION_TITLE}>What we score</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
              <p>
                PlasticBegone scores products where the plastic and other materials directly contact
                food, drink, or skin. Cookware, drinkware, food storage, utensils, textiles, and similar
                product categories.
              </p>
              <p>
                We do not score the chemistry of cleaning formulations, cosmetics ingredients, or food
                products themselves. For ingredient-level analysis of cleaning products and personal care, we
                defer to EWG Skin Deep and similar databases.
              </p>
            </div>
          </div>

          <div
            id="ftc-disclosure"
            className="relative isolate min-h-[240px] w-full overflow-hidden rounded-3xl border border-slate-200/90 shadow-card scroll-mt-28 sm:min-h-[260px] md:min-h-[280px]"
          >
            <img
              src={aboutFtcCard}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center sm:object-right"
              loading="lazy"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-full bg-gradient-to-r from-[#faf7f0]/98 via-[#faf7f0]/75 to-[#faf7f0]/20 sm:w-[85%] md:w-[70%] lg:w-[55%]"
              aria-hidden
            />
            <div className="relative z-10 flex min-h-[240px] flex-col justify-center p-6 sm:min-h-[260px] md:min-h-[280px] md:max-w-2xl md:p-8 lg:max-w-3xl">
              <h2 className={SECTION_TITLE}>FTC affiliate disclosure</h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-700 md:text-base">
                PlasticBegone may earn commissions on purchases made through affiliate links. This does not
                influence ratings. Scores are based entirely on independent scientific methodology.
              </p>
              <a
                href="#"
                className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-forest underline decoration-forest/40 underline-offset-[6px] transition hover:decoration-forest"
                onClick={(e) => e.preventDefault()}
              >
                Read full disclosure
                <span aria-hidden className="translate-y-px">
                  →
                </span>
              </a>
            </div>
          </div>

          <div className="relative isolate overflow-hidden rounded-3xl ring-1 ring-black/[0.06] shadow-[0_20px_50px_-28px_rgba(15,61,38,0.35)]">
            <img
              src={aboutCtaBanner}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[52%_center]"
              loading="lazy"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[88%] bg-gradient-to-r from-[#fbfaf7]/95 via-[#fbfaf7]/65 to-transparent sm:w-[78%] md:w-[62%]"
              aria-hidden
            />
            <div className="relative z-10 flex flex-col gap-6 px-6 py-8 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-10 md:px-10 md:py-10">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                  Start making plastic disappear.
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700 sm:text-base">
                  Explore safer alternatives and build a healthier home, one choice at a time.
                </p>
              </div>
              <Link
                to="/categories"
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-forest px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-18px_rgba(8,51,32,0.65)] transition hover:bg-forest-deep md:self-center"
              >
                Browse categories
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Highlight({
  icon,
  iconTone,
  title,
  body,
}: {
  icon: React.ReactNode
  iconTone: 'emerald' | 'blue' | 'violet'
  title: string
  body: string
}) {
  const bubble =
    iconTone === 'emerald'
      ? 'bg-emerald-50 ring-emerald-100'
      : iconTone === 'blue'
        ? 'bg-blue-50 ring-blue-100'
        : 'bg-violet-50 ring-violet-100'

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-[0_12px_40px_-12px_rgba(15,61,38,0.18)] ring-1 ring-black/[0.03] md:p-4">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1 ${bubble}`}>
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-600">{body}</div>
      </div>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle: string
  right: React.ReactNode
}) {
  return (
    <div className="grid items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-card md:grid-cols-12">
      <div className="md:col-span-7">
        <h2 className={SECTION_TITLE}>{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{subtitle}</p>
      </div>
      <div className="md:col-span-5">{right}</div>
    </div>
  )
}

function RiskFactorCard({
  icon,
  iconTone,
  title,
  body,
}: {
  icon: React.ReactNode
  iconTone: 'emerald' | 'blue' | 'violet'
  title: string
  body: string
}) {
  const bubble =
    iconTone === 'emerald'
      ? 'bg-emerald-50 ring-emerald-100'
      : iconTone === 'blue'
        ? 'bg-blue-50 ring-blue-100'
        : 'bg-violet-50 ring-violet-100'
  const titleTone =
    iconTone === 'emerald'
      ? 'text-emerald-700'
      : iconTone === 'blue'
        ? 'text-blue-700'
        : 'text-violet-700'

  return (
    <div className="flex h-full flex-col rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-[0_10px_40px_-24px_rgba(15,61,38,0.35)] ring-1 ring-slate-200/80">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${bubble}`}>
        {icon}
      </span>
      <h3 className={`mt-3 text-sm font-semibold ${titleTone}`}>{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-700">{body}</p>
    </div>
  )
}
