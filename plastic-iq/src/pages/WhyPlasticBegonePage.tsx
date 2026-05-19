import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownCircle, ArrowRight, FlaskConical, Sparkles, Users } from 'lucide-react'
import expertsDocumentaryCard from '../assets/experts-documentary-card.png'
import expertsPodcastCard from '../assets/experts-podcast-card.png'
import expertsStudyCard from '../assets/experts-study-card.png'
import whyPlasticBegoneHero from '../assets/why-plastic-begone-hero.png'
import whyPlasticPacsBanner from '../assets/why-plastic-pacs-banner.png'
import whyStudyNatureCard from '../assets/why-study-nature-card.png'
import { TopNav } from '../components/nav/TopNav'

const NATURE_PERTH_ARTICLE =
  'https://www.nature.com/articles/s41591-026-04324-7' as const

const HUBERMAN_MICROPLASTICS_EPISODE =
  'https://www.hubermanlab.com/episode/the-effects-of-microplastics-on-your-health-how-to-reduce-them' as const

const NETFLIX_PLASTIC_DETOX = 'https://www.netflix.com/title/82074244' as const

/** Deep forest green (not lime, not near‑black). ~Tailwind green-800. */
const BRAND_GREEN = '#166534' as const

/** Stat cards: tiny step up in lightness from hero cream (#f9f8f3), not #fff. */
const STAT_SURFACE = '#fbfaf6' as const

/** PAC row icons: viewBox 0 0 32 32, stroke via currentColor — heavier stroke reads “bold” at small sizes. */
const PAC_STROKE = 2.1
const PAC_STROKE_SOFT = 1.65

function PacIconMolecule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path
        d="M16 9v14M16 16H8M16 16h8M11 10.5l-4 3M21 10.5l4 3M11 21.5l-4-3M21 21.5l4-3"
        stroke="currentColor"
        strokeWidth={PAC_STROKE}
        strokeLinecap="round"
      />
      <circle cx="16" cy="9" r="2.25" stroke="currentColor" strokeWidth={PAC_STROKE} />
      <circle cx="16" cy="23" r="2.25" stroke="currentColor" strokeWidth={PAC_STROKE} />
      <circle cx="8" cy="16" r="2.25" stroke="currentColor" strokeWidth={PAC_STROKE} />
      <circle cx="24" cy="16" r="2.25" stroke="currentColor" strokeWidth={PAC_STROKE} />
    </svg>
  )
}

function PacIconBisphenols({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth={PAC_STROKE} strokeLinejoin="round">
        <path d="M10.5 16l0-5.2 4.5-2.6 4.5 2.6v5.2l-4.5 2.6-4.5-2.6z" />
        <path d="M16.5 16l0-5.2 4.5-2.6 4.5 2.6v5.2l-4.5 2.6-4.5-2.6z" />
      </g>
    </svg>
  )
}

function PacIconPfas({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path
        d="M16 7.5C12 13.5 9.5 16.5 9.5 20a6.5 6.5 0 0013 0c0-3.5-2.5-6.5-6.5-12.5z"
        stroke="currentColor"
        strokeWidth={PAC_STROKE}
        strokeLinejoin="round"
      />
      {(
        [
          [24.5, 8.5],
          [26.5, 14],
          [22, 22],
          [10, 22],
        ] as const
      ).map(([cx, cy]) => (
        <path
          key={`${cx}-${cy}`}
          d={`M${cx} ${cy - 1.5}v3M${cx - 1.5} ${cy}h3`}
          stroke="currentColor"
          strokeWidth={PAC_STROKE_SOFT}
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

function PacIconLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path
        d="M9 22.5c7.5-1.2 12.5-6 12-14.5-5.5 1.5-9.5 6-12 14.5z"
        stroke="currentColor"
        strokeWidth={PAC_STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M14.5 20c2-4.5 2-9 .5-12.5"
        stroke="currentColor"
        strokeWidth={PAC_STROKE_SOFT}
        strokeLinecap="round"
      />
    </svg>
  )
}

function PacIconWarning({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <path
        d="M9.5 24.5h13L16 8.5 9.5 24.5z"
        stroke="currentColor"
        strokeWidth={PAC_STROKE}
        strokeLinejoin="round"
      />
      <path d="M16 18v1.2" stroke="currentColor" strokeWidth={PAC_STROKE} strokeLinecap="round" />
      <circle cx="16" cy="14.5" r="1.05" fill="currentColor" />
    </svg>
  )
}

const PAC_ICON_WELL = 'bg-[#f3f1ea]' as const

const PAC_ITEMS: readonly {
  icon: ReactNode
  title: string
  body: string
  titleSans?: boolean
}[] = [
  {
    icon: <PacIconMolecule className="h-7 w-7" />,
    title: 'Phthalates',
    body: 'linked to hormonal disruption and fertility problems',
  },
  {
    icon: <PacIconBisphenols className="h-7 w-7" />,
    title: 'Bisphenols',
    body: 'BPA and its replacements BPS and BPF',
  },
  {
    icon: <PacIconPfas className="h-7 w-7" />,
    title: 'PFAS',
    body: 'linked to cancer and immune dysfunction',
  },
  {
    icon: <PacIconLeaf className="h-7 w-7" />,
    title: 'Parabens',
    body: 'found in personal care products',
  },
  {
    icon: <PacIconWarning className="h-7 w-7" />,
    title: 'BPA free does not mean PAC free.',
    body: 'Manufacturers replaced BPA with chemicals that cause similar harm.',
    titleSans: true,
  },
] as const

export function WhyPlasticBegonePage() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Why PlasticBegone? — PlasticBegone'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="bg-transparent">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-x-clip bg-transparent">
          <TopNav variant="overlay" overlayPosition="absolute" />

          <section className="bg-transparent pb-6 pt-0 md:pb-8">
            <div className="relative isolate z-0 min-h-[22rem] overflow-hidden rounded-[1.65rem] bg-[#f9f8f3] shadow-[0_18px_44px_-18px_rgba(15,61,38,0.12)] ring-1 ring-black/[0.05] sm:min-h-[24rem] md:min-h-[26rem] md:rounded-[1.85rem] lg:min-h-[28rem]">
              {/* Full-card hero image as background (TopNav sits on top). */}
              <img
                src={whyPlasticBegoneHero}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover object-[52%_42%] sm:object-[51%_42%] md:object-[52%_42%] lg:object-[54%_40%]"
                loading="eager"
              />

              {/* Light veil on the left so type + narrow cards read; right stays mostly raw photo. */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[92%] bg-gradient-to-r from-[#f9f8f3]/94 via-[#f9f8f3]/78 to-transparent sm:w-[84%] md:w-[52%] lg:w-[48%]"
                aria-hidden
              />

              <div className="relative z-10 grid md:grid-cols-2 md:items-stretch">
                <div className="bg-transparent px-6 pb-10 pt-8 sm:px-8 sm:pt-10 md:px-8 md:pb-12 md:pt-24 lg:px-10 lg:pb-14 lg:pt-28">
                  <h1 className="font-display text-[2.15rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.65rem] lg:text-[3rem]">
                    <span className="text-ink-900">Why Plastic</span>
                    <span style={{ color: BRAND_GREEN }}>Begone?</span>
                  </h1>

                  <p
                    className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight sm:text-xl lg:text-[1.3rem]"
                    style={{ color: BRAND_GREEN }}
                  >
                    Because plastic is already inside you.{' '}
                    <span style={{ color: BRAND_GREEN }} aria-hidden>
                      ✦
                    </span>
                  </p>

                  <p className="mt-4 max-w-xl text-pretty font-sans text-sm font-normal leading-relaxed text-[#4a4a4a] sm:text-[0.9375rem]">
                    Scientists have found plastic-associated chemicals in every person tested. The good
                    news? Simple swaps can dramatically reduce exposure.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-2 sm:gap-2.5">
                    <StatCard
                      icon={<Users className="h-8 w-8" color={BRAND_GREEN} strokeWidth={1.65} />}
                      stat="100%"
                      body="of participants tested positive for plastic chemicals in their body."
                    />
                    <StatCard
                      icon={<FlaskConical className="h-8 w-8" color={BRAND_GREEN} strokeWidth={1.65} />}
                      stat="6+"
                      body="different plastic-associated chemicals found in every single person."
                    />
                    <StatCard
                      icon={<ArrowDownCircle className="h-8 w-8" color={BRAND_GREEN} strokeWidth={1.65} />}
                      stat="60%"
                      body="reduction in BPA levels in just 7 days by switching products."
                    />
                  </div>

                  <p className="mt-8 font-sans text-[11px] font-medium leading-relaxed text-slate-400 sm:text-xs">
                    Source: PERTH Trial, Nature Medicine, April 2026
                  </p>
                </div>

                <div className="hidden md:block" aria-hidden />
              </div>
            </div>
          </section>

          {/* Overlaps hero bottom — rounded panel (About-style negative margin). */}
          <section className="relative z-20 -mt-7 px-0 pb-4 sm:-mt-8 sm:pb-5 md:-mt-10 md:pb-5">
            <div
              className="overflow-hidden rounded-[1.35rem] border border-stone-300/35 shadow-[0_20px_48px_-24px_rgba(15,61,38,0.14)] ring-1 ring-black/[0.04] md:rounded-[1.65rem]"
              style={{ backgroundColor: STAT_SURFACE }}
            >
              <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2 md:items-start md:gap-6 lg:p-6">
                <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-xl md:h-full">
                  <img
                    src={whyStudyNatureCard}
                    alt="Nature Medicine article: the PERTH Trial"
                    className="mx-auto max-h-[min(52vw,18rem)] w-full max-w-full object-contain object-center sm:max-h-[min(44vw,20rem)] md:max-h-[14.5rem] lg:max-h-[15.5rem]"
                    loading="lazy"
                  />
                </div>
                <div className="flex min-h-0 flex-col">
                  <h2 className="font-display text-balance text-[1.5rem] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[1.75rem] lg:text-[2rem]">
                    The study that started it all
                  </h2>
                  <p className="mt-3 text-pretty font-sans text-sm font-normal leading-relaxed text-[#4a4a4a] sm:text-[0.9375rem]">
                    Researchers at the University of Western Australia tested 211 healthy adults for
                    plastic chemicals. Every single one tested positive.
                  </p>
                  <p className="mt-2.5 text-pretty font-sans text-sm font-normal leading-relaxed text-[#4a4a4a] sm:text-[0.9375rem]">
                    Then they showed that simple product swaps reduced those chemical levels by up to
                    60% in one week.
                  </p>
                  <p className="mt-3 font-sans text-sm font-semibold leading-relaxed text-ink-900 sm:text-[0.9375rem]">
                    That study is why PlasticBegone exists.
                  </p>
                  <a
                    href={NATURE_PERTH_ARTICLE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-forest px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_-18px_rgba(8,51,32,0.65)] transition hover:bg-forest-deep"
                  >
                    Read the full study
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="-mt-2 px-0 pb-3 pt-0 sm:-mt-2.5 md:pb-4">
            <div className="rounded-[1.35rem] border border-stone-200/55 bg-[#fdfcf9] px-5 py-5 shadow-sm sm:px-6 sm:py-5 md:rounded-[1.65rem] lg:px-8 lg:py-6">
              <div className="grid grid-cols-1 gap-y-6 divide-y divide-stone-200/60 lg:grid-cols-[minmax(0,1.18fr)_repeat(5,minmax(0,1fr))] lg:gap-y-0 lg:divide-y-0">
                <aside className="max-w-lg pb-6 text-left lg:max-w-none lg:pb-0 lg:pr-2">
                  <h2 className="font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[1.6rem]">
                    What are PACs?
                  </h2>
                  <p className="mt-2 font-sans text-[13px] font-normal leading-snug text-[#4a4a4a] sm:text-sm sm:leading-relaxed">
                    Plastic-associated chemicals leach from plastic products into your food, water, and
                    skin — especially under heat, acidity, and friction.
                  </p>
                </aside>

                {PAC_ITEMS.map((item) => (
                  <div
                    key={item.title}
                    className='relative flex flex-col items-center px-1 pb-6 pt-2 text-center sm:px-2 lg:min-h-0 lg:justify-start lg:px-2 lg:pb-0 lg:pl-4 lg:pr-2 lg:pt-0 lg:before:pointer-events-none lg:before:absolute lg:before:left-0 lg:before:top-[10%] lg:before:bottom-[10%] lg:before:w-px lg:before:bg-stone-200/75 lg:before:content-[""]'
                  >
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${PAC_ICON_WELL} ring-1 ring-stone-200/40`}
                      style={{ color: BRAND_GREEN }}
                    >
                      {item.icon}
                    </div>
                    {item.titleSans ? (
                      <p className="mt-2 max-w-[10.5rem] text-pretty font-sans text-[11px] font-normal leading-snug text-ink-900 sm:text-xs">
                        {item.title}
                      </p>
                    ) : (
                      <h3 className="mt-2 max-w-[9rem] text-pretty font-display text-[0.9375rem] font-semibold leading-snug text-ink-900 sm:text-[1rem]">
                        {item.title}
                      </h3>
                    )}
                    <p className="mt-1 max-w-[10.5rem] text-pretty font-sans text-[10px] font-normal leading-snug text-[#4a4a4a] sm:text-[11px] sm:leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section
            className="-mt-2 px-0 pb-5 pt-0 sm:-mt-2.5 md:pb-6"
            aria-labelledby="kitchen-banner-heading"
          >
            <div className="relative h-44 w-full overflow-hidden rounded-[1.35rem] bg-[#fdfcf9] sm:h-48 md:h-52 md:rounded-[1.65rem] lg:h-56">
              <img
                src={whyPlasticPacsBanner}
                alt="Plastic food storage breaking apart beside a clear glass container"
                width={1024}
                height={301}
                className="absolute inset-0 h-full w-full object-cover object-[50%_42%]"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-y-0 left-0 z-10 flex max-w-[min(58%,18.5rem)] flex-col justify-center px-4 py-4 text-left sm:max-w-[19.5rem] sm:px-5 sm:py-5 md:max-w-[20.5rem] md:px-6 md:py-6 lg:py-7">
                <h2
                  id="kitchen-banner-heading"
                  className="font-display text-[1.125rem] font-semibold leading-[1.12] tracking-tight text-ink-900 sm:text-[1.3rem] md:text-[1.4rem] lg:text-[1.45rem] [text-shadow:0_1px_0_rgba(255,255,255,0.95),0_0_12px_rgba(253,252,249,0.75)]"
                >
                  <span className="block">The kitchen is where</span>
                  <span className="block">it starts.</span>
                </h2>
                <p className="mt-2 text-pretty font-sans text-xs font-normal leading-relaxed text-[#4a4a4a] sm:mt-2.5 sm:text-sm md:text-[0.9375rem] [text-shadow:0_1px_0_rgba(255,255,255,0.9),0_0_10px_rgba(253,252,249,0.7)]">
                  The PERTH Trial found processed, plastic-packaged, and canned foods are the biggest
                  source of daily exposure. Your kitchen is where the biggest wins are.
                </p>
                <Link
                  to="/categories"
                  className="mt-2.5 inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[11px] font-semibold text-white shadow-[0_10px_28px_-14px_rgba(8,51,32,0.6)] transition hover:bg-forest-deep sm:mt-3 sm:gap-2 sm:px-6 sm:py-2.5 sm:text-xs md:px-7 md:py-3 md:text-sm"
                >
                  Browse safer kitchen products
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <section className="px-0 pb-8 pt-0 md:pb-10" aria-labelledby="experts-heading">
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <Sparkles
                className="h-5 w-5 shrink-0 text-[#c9a227] sm:h-6 sm:w-6"
                aria-hidden
                strokeWidth={1.65}
              />
              <h2
                id="experts-heading"
                className="font-display text-[1.45rem] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[1.6rem]"
              >
                What the experts are saying
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              <a
                href={HUBERMAN_MICROPLASTICS_EPISODE}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-[1.35rem] border border-stone-200/55 bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:border-stone-300/80 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:rounded-[1.5rem]"
              >
                <img
                  src={expertsPodcastCard}
                  alt="Podcast: The Effects of Microplastics on Your Health and How to Reduce Them. Huberman Lab, October 2024."
                  className="block h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
              </a>
              <a
                href={NETFLIX_PLASTIC_DETOX}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-[1.35rem] border border-stone-200/55 bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:border-stone-300/80 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:rounded-[1.5rem]"
              >
                <img
                  src={expertsDocumentaryCard}
                  alt="Documentary on Netflix: The Plastic Detox. Exploring plastic exposure and modern health."
                  className="block h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
              </a>
              <a
                href={NATURE_PERTH_ARTICLE}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-[1.35rem] border border-stone-200/55 bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:border-stone-300/80 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:rounded-[1.5rem]"
              >
                <img
                  src={expertsStudyCard}
                  alt="Study in Nature Medicine: the PERTH trial on low-plastic diet and urinary bisphenols."
                  className="block h-auto w-full"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  stat,
  body,
}: {
  icon: ReactNode
  stat: string
  body: string
}) {
  return (
    <div
      className="flex w-[7.75rem] shrink-0 flex-col rounded-2xl border border-stone-300/35 px-3 py-3 shadow-[0_1px_2px_rgba(15,61,38,0.04)] sm:w-[8rem] sm:py-3.5 md:w-[8.25rem]"
      style={{ backgroundColor: STAT_SURFACE }}
    >
      {icon}
      <div
        className="mt-1.5 font-display text-[2.05rem] font-semibold leading-[0.95] tracking-tight sm:text-[2.2rem] md:text-[2.35rem]"
        style={{ color: BRAND_GREEN }}
      >
        {stat}
      </div>
      <p className="mt-1.5 font-sans text-[10px] font-normal leading-snug text-[#4a4a4a] sm:text-[11px]">
        {body}
      </p>
    </div>
  )
}
