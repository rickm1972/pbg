import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  CheckCircle2,
  FlaskConical,
  Info,
  Microscope,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import aboutHero from '../assets/about-hero.png'
import aboutScienceCard from '../assets/about-science-card.png'
import aboutFtcCard from '../assets/about-ftc-card.png'
import aboutCtaBanner from '../assets/about-cta-banner.png'
import { TopNav } from '../components/nav/TopNav'

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
                      PACScore is our science-based rating system that helps you identify safer products
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
              <h2 className="text-base font-semibold text-ink-900">
                How the PAC Safety Score is calculated
              </h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-700">
                Scores are driven by expected exposure risk based on materials, construction, and
                available evidence. We emphasize direct-contact surfaces (food, drink, skin contact)
                and conditions that increase migration risk.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <TierCard
                className="md:col-span-1"
                tone="excellent"
                range="90–100"
                tier="Excellent"
                body="Minimal PAC exposure pathways."
                icon={<CheckCircle2 className="h-6 w-6 text-emerald-700" strokeWidth={2.75} />}
              />
              <TierCard
                className="md:col-span-1"
                tone="good"
                range="70–89"
                tier="Good"
                body="Generally low risk with some exposure considerations."
                icon={<CheckCircle2 className="h-6 w-6 text-blue-700" strokeWidth={2.75} />}
              />
              <TierCard
                className="md:col-span-1"
                tone="caution"
                range="50–69"
                tier="Caution"
                body="Meaningful exposure pathways; consider alternatives."
                icon={<AlertTriangle className="h-6 w-6 text-amber-700" strokeWidth={2.75} />}
              />
              <TierCard
                className="md:col-span-1"
                tone="highrisk"
                range="0–49"
                tier="High Risk"
                body="High likelihood of PAC exposure under normal use."
                icon={<AlertTriangle className="h-6 w-6 text-red-700" strokeWidth={2.75} />}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-1">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                  <Beaker className="h-5 w-5 text-emerald-700" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-700">
                  PACScore is not an overall product quality score. It reflects expected chemical
                  exposure risk from plastic-associated sources.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Score basis categories</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                Each product includes a score basis badge to communicate confidence and methodology.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <BasisCard
                title="Lab Verified"
                body="Supported by lab testing and measurements."
                tone="lab"
                icon={<Microscope className="h-4 w-4 text-emerald-700" />}
              />
              <BasisCard
                title="Based on Materials Science"
                body="Derived from materials and product design principles."
                tone="materials"
                icon={<Shield className="h-4 w-4 text-blue-700" />}
              />
              <BasisCard
                title="AI Estimated"
                body="Preliminary estimate pending stronger evidence."
                tone="ai"
                icon={<Sparkles className="h-4 w-4 text-violet-700" />}
              />
              <BasisCard
                title="In Testing Queue"
                body="Awaiting additional testing or review."
                tone="queue"
                icon={<Info className="h-4 w-4 text-amber-700" />}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-5">
            <div
              id="research"
              className="relative isolate min-h-[280px] overflow-hidden rounded-3xl border border-slate-200/90 shadow-card scroll-mt-28 md:min-h-[300px]"
            >
              <img
                src={aboutScienceCard}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
                loading="lazy"
              />
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[90%] bg-gradient-to-r from-[#eef2ee]/98 via-[#eef2ee]/88 to-transparent sm:w-[82%] md:w-[68%] lg:w-[58%]"
                aria-hidden
              />
              <div className="relative z-10 flex min-h-[280px] flex-col justify-center p-6 md:min-h-[300px] md:max-w-[min(26rem,72%)] md:p-8">
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900 md:text-xl">
                  Scientific foundation
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  PlasticBegone is built to translate emerging science into practical buying decisions. We
                  track evolving evidence, including the PERTH Trial published in Nature Medicine (April
                  2026), and incorporate validated findings into scoring where appropriate.
                </p>
                <Link
                  to="/about#methodology"
                  className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-forest underline decoration-forest/40 underline-offset-[6px] transition hover:decoration-forest"
                >
                  Learn more about our science
                  <span aria-hidden className="translate-y-px">
                    →
                  </span>
                </Link>
              </div>
            </div>

            <div
              id="ftc-disclosure"
              className="relative isolate min-h-[280px] overflow-hidden rounded-3xl border border-slate-200/90 shadow-card md:min-h-[300px]"
            >
              <img
                src={aboutFtcCard}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
                loading="lazy"
              />
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[90%] bg-gradient-to-r from-[#faf7f0]/98 via-[#faf7f0]/88 to-transparent sm:w-[82%] md:w-[68%] lg:w-[58%]"
                aria-hidden
              />
              <div className="relative z-10 flex min-h-[280px] flex-col justify-center p-6 md:min-h-[300px] md:max-w-[min(26rem,72%)] md:p-8">
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900 md:text-xl">
                  FTC affiliate disclosure
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  PlasticBegone may earn commissions on purchases made through affiliate links. This does
                  not influence ratings. Scores are based entirely on independent scientific
                  methodology.
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
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{subtitle}</p>
      </div>
      <div className="md:col-span-5">{right}</div>
    </div>
  )
}

function TierCard({
  tier,
  range,
  body,
  tone,
  icon,
  className,
}: {
  tier: string
  range: string
  body: string
  tone: 'excellent' | 'good' | 'caution' | 'highrisk'
  icon: React.ReactNode
  className?: string
}) {
  const toneCls =
    tone === 'excellent'
      ? 'border-emerald-100 bg-emerald-50/60'
      : tone === 'good'
        ? 'border-blue-100 bg-blue-50/60'
        : tone === 'caution'
          ? 'border-amber-100 bg-amber-50/70'
          : 'border-red-100 bg-red-50/70'
  const rangeCls =
    tone === 'excellent'
      ? 'text-emerald-700'
      : tone === 'good'
        ? 'text-blue-700'
        : tone === 'caution'
          ? 'text-amber-700'
          : 'text-red-700'

  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-sm ${toneCls} ${className ?? ''}`}
      style={{ minHeight: 132 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-base font-semibold ${rangeCls}`}>{range}</div>
          <div className={`mt-1 text-base font-semibold ${rangeCls}`}>{tier}</div>
        </div>
        <div className="rounded-full bg-transparent p-2.5 ring-1 ring-slate-200">{icon}</div>
      </div>
      <div className="mt-3 text-xs leading-relaxed text-slate-700">{body}</div>
    </div>
  )
}

function BasisCard({
  title,
  body,
  tone,
  icon,
}: {
  title: string
  body: string
  tone: 'lab' | 'materials' | 'ai' | 'queue'
  icon: React.ReactNode
}) {
  const toneTitle =
    tone === 'lab'
      ? 'text-emerald-700'
      : tone === 'materials'
        ? 'text-blue-700'
        : tone === 'ai'
          ? 'text-violet-700'
          : 'text-amber-700'
  const toneBubble =
    tone === 'lab'
      ? 'bg-emerald-50 ring-emerald-100'
      : tone === 'materials'
        ? 'bg-blue-50 ring-blue-100'
        : tone === 'ai'
          ? 'bg-violet-50 ring-violet-100'
          : 'bg-amber-50 ring-amber-100'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${toneBubble}`}>
          {icon}
        </span>
        <div>
          <div className={`text-sm font-semibold ${toneTitle}`}>{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-600">{body}</div>
        </div>
      </div>
    </div>
  )
}

