import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  LayoutGrid,
  RefreshCcw,
  Scale,
  Search,
  Shield,
  Sparkles,
  Link2,
  Users,
} from 'lucide-react'
import type { Product } from '../types'
import { fetchAllProducts, fetchCategories, searchProducts } from '../lib/productsApi'
import { ProductCard } from '../components/ProductCard'
import homeHero from '../assets/home hero.png'
import categoryKitchen from '../assets/category-kitchen.png'
import categoryFoodStorage from '../assets/category-food-storage.png'
import categoryWaterBottles from '../assets/category-water-bottles.png'
import categoryCookingUtensils from '../assets/category-cooking-utensils.png'
import categoryCookware from '../assets/category-cookware.png'
import magicHero from '../assets/magic-wide-cropped.png'
import { colorForTier, tierForScore } from '../lib/score'
import { ScoreBasisBadge } from '../components/ScoreBasisBadge'
import { ProductImage } from '../components/ProductImage'
import { TopNav } from '../components/nav/TopNav'

/** Heavier stroke so tier glyphs read clearly at small sizes. */
const TIER_ICON_STROKE = 2.75 as const

const TIER_STRIP = [
  {
    tone: 'excellent',
    range: '90–100',
    label: 'Excellent',
    blurb: 'Minimal exposure risk',
    icon: (
      <CheckCircle2 className="h-5 w-5 text-emerald-700" strokeWidth={TIER_ICON_STROKE} />
    ),
    ring: 'ring-emerald-200',
    text: 'text-emerald-700',
  },
  {
    tone: 'good',
    range: '75–89',
    label: 'Good',
    blurb: 'Generally low risk',
    icon: <CheckCircle2 className="h-5 w-5 text-blue-700" strokeWidth={TIER_ICON_STROKE} />,
    ring: 'ring-blue-200',
    text: 'text-blue-700',
  },
  {
    tone: 'caution',
    range: '55–74',
    label: 'Caution',
    blurb: 'Meaningful risk',
    icon: <AlertTriangle className="h-5 w-5 text-amber-700" strokeWidth={TIER_ICON_STROKE} />,
    ring: 'ring-amber-200',
    text: 'text-amber-700',
  },
  {
    tone: 'concern',
    range: '30–54',
    label: 'Concern',
    blurb: 'Elevated exposure risk',
    icon: <AlertTriangle className="h-5 w-5 text-orange-700" strokeWidth={TIER_ICON_STROKE} />,
    ring: 'ring-orange-200',
    text: 'text-orange-700',
  },
  {
    tone: 'highrisk',
    range: '0–29',
    label: 'High Risk',
    blurb: 'High exposure risk',
    icon: <AlertTriangle className="h-5 w-5 text-red-700" strokeWidth={TIER_ICON_STROKE} />,
    ring: 'ring-red-200',
    text: 'text-red-700',
  },
] as const

const FEATURED_SUBCATEGORIES = [
  {
    label: 'Water Bottles & Drinkware',
    db: 'Water Bottles and Drinkware',
    image: categoryWaterBottles,
  },
  { label: 'Food Storage', db: 'Food Storage', image: categoryFoodStorage },
  { label: 'Cookware', db: 'Cookware', image: categoryCookware },
  { label: 'Cooking Utensils', db: 'Cooking Utensils', image: categoryCookingUtensils },
] as const

/** Subcategories outside materials-science scope (formulation products). */
const EXCLUDED_SUBCATEGORIES = new Set(['Dish Soap'])

export function HomePage() {
  const [searchParams] = useSearchParams()
  const focusSearch = searchParams.get('focus') === 'search'
  const categoryRailRef = useRef<HTMLDivElement | null>(null)
  const topRatedRailRef = useRef<HTMLDivElement | null>(null)

  const [allProducts, setAllProducts] = useState<Product[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllProducts(2000)
      .then((d) => setAllProducts(d))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load products'),
      )

    fetchCategories()
      .then(() => {})
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load categories'),
      )
  }, [])

  const showSearch = focusSearch || query.trim().length > 0
  const kitchenProducts = useMemo(
    () => (allProducts ?? []).filter((p) => (p.category ?? '') === 'Kitchen'),
    [allProducts],
  )
  const kitchenSubcategories = useMemo(() => {
    const set = new Set<string>()
    for (const p of kitchenProducts) {
      const s = (p.subcategory ?? '').trim()
      if (s && !EXCLUDED_SUBCATEGORIES.has(s)) set.add(s)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [kitchenProducts])
  const itemsBySubcategory = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of kitchenProducts) {
      const s = (p.subcategory ?? '').trim()
      if (!s || EXCLUDED_SUBCATEGORIES.has(s)) continue
      out[s] = (out[s] ?? 0) + 1
    }
    return out
  }, [kitchenProducts])

  const topRated = useMemo(() => (allProducts ?? []).slice(0, 10), [allProducts])

  async function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    try {
      const d = await searchProducts(q, 24)
      setResults(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const heroSubtitle = useMemo(
    () =>
      'PlasticBegone rates everyday products using the PAC Safety Score — a 0–100 measure of plastic-associated chemical exposure risk (phthalates, bisphenols, PFAS, parabens). Higher is safer.',
    [],
  )

  return (
    <div className="bg-transparent">
      {/* Single centered canvas: same width as hero, cream continues under all sections */}
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-hidden bg-[#fdfcf9]">
          <TopNav variant="overlay" overlayPosition="absolute" />

          <section className="bg-transparent pb-2 pt-0">
            <div className="relative overflow-hidden rounded-[1.65rem] shadow-[0_28px_70px_-28px_rgba(15,61,38,0.45)] ring-1 ring-black/[0.06] md:rounded-[1.85rem]">
            <img
              src={homeHero}
              alt=""
              aria-hidden="true"
              className="pointer-events-none block h-[540px] w-full select-none object-cover object-[58%_45%] sm:h-[580px] lg:h-[620px]"
              loading="eager"
            />

            {/* Readability veil: ONLY behind left copy (don’t fade whole image). */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r from-[#fbfaf7]/95 via-[#fbfaf7]/55 to-transparent sm:w-[64%] md:w-[58%] lg:w-[54%]"
              aria-hidden
            />

            <div className="absolute inset-0 flex flex-col px-4 pb-5 pt-20 sm:px-6 sm:pb-8 sm:pt-24 lg:px-10 lg:pb-10 lg:pt-28">
              <div className="max-w-[22.5rem] sm:max-w-[23.5rem] lg:max-w-[24.5rem]">
                <h1 className="font-display text-balance text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.1rem] xl:text-[3.35rem]">
                  Smarter choices.
                  <br />
                  <span className="italic text-forest">Safer</span>
                  <span className="font-semibold not-italic text-ink-900"> everyday.</span>{' '}
                  <Sparkles
                    className="relative top-[0.125em] inline-block h-[0.92em] w-[0.92em] text-[#c9a227] sm:h-9 sm:w-9"
                    aria-hidden
                    strokeWidth={1.65}
                  />
                </h1>
                <p className="mt-4 text-pretty text-sm font-medium leading-relaxed text-slate-700 sm:text-[0.9375rem] lg:text-base">
                  {heroSubtitle}
                </p>

                <form onSubmit={onSearchSubmit} className="mt-7 w-full max-w-[24.5rem]">
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-sm focus-within:border-forest/35 focus-within:ring-2 focus-within:ring-forest/15">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pl-4">
                      <Search
                        className="pointer-events-none h-[18px] w-[18px] shrink-0 text-slate-400"
                        aria-hidden
                        strokeWidth={2}
                      />
                      <input
                        autoFocus={focusSearch}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search products or brands…"
                        className="min-h-[3.125rem] w-full min-w-0 border-0 bg-transparent py-3 pr-3 text-[0.9375rem] text-ink-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="submit"
                      className="shrink-0 bg-forest px-6 py-3 text-[0.9375rem] font-semibold text-white transition hover:bg-forest-deep active:bg-forest-deep"
                    >
                      Search
                    </button>
                  </div>
                </form>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link
                    to="/categories"
                    className="inline-flex items-center rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
                  >
                    <LayoutGrid className="mr-2 h-4 w-4 text-forest" />
                    Browse all categories
                  </Link>
                  <Link
                    to="/about"
                    className="inline-flex items-center rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:bg-white"
                  >
                    <FlaskConical className="mr-2 h-4 w-4 text-forest" />
                    View methodology
                  </Link>
                </div>

                {error ? (
                  <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
            </div>

            {/* PAC tiers — overlaps bottom of hero card (like mock) */}
            <div className="relative z-20 -mt-10 md:-mt-16">
              <div className="rounded-3xl border border-[#d4ddd1] bg-white p-5 shadow-[0_24px_50px_-20px_rgba(15,61,38,0.22)] backdrop-blur-sm md:p-6 lg:px-7 lg:py-6">
                <div className="grid gap-6 md:flex md:items-stretch md:gap-0 md:divide-x md:divide-slate-200">
                  <div className="md:w-[220px] md:pr-6 md:py-1">
                  <div className="text-sm font-semibold text-ink-900">PAC Safety Score tiers</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-600">
                    Higher scores mean safer products
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:flex md:flex-1 md:items-stretch md:divide-x md:divide-slate-200">
                  {TIER_STRIP.map((t) => (
                    <div
                      key={t.tone}
                      className="flex items-center gap-3 md:flex-1 md:flex-col md:justify-center md:gap-2 md:px-5 md:text-center"
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-transparent ring-1 ${t.ring}`}
                      >
                        {t.icon}
                      </span>
                      <div className="leading-tight md:leading-none">
                        <div className={`text-sm font-semibold ${t.text}`}>{t.range}</div>
                        <div className={`mt-0.5 text-xs font-semibold ${t.text}`}>{t.label}</div>
                      </div>
                      <div className="text-xs leading-snug text-slate-600 md:mt-1 md:whitespace-nowrap">
                        {t.blurb}
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  to="/about"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 md:w-[220px] md:pl-5"
                >
                  <span className="text-xs leading-tight">
                    <span className="block font-semibold text-ink-900">Learn more</span>
                    <span className="block text-slate-600">about how we score products</span>
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-ink-900">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
          </section>

          <section className="bg-transparent px-4 pb-6 pt-4 md:px-6 md:pb-7 md:pt-5">
        {showSearch ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">Search results</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Showing the highest PAC Safety Scores first.
                </p>
              </div>
              {loading ? <div className="text-sm text-slate-600">Searching…</div> : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(results ?? []).map((p) => (
                <ProductCard key={p.product_id} product={p} />
              ))}
            </div>

            {results && results.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
                No matches found. Try a different search term.
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">
                  Browse by category
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Explore products by category to find safer alternatives.
                </p>
              </div>
              <Link
                to="/categories"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                See all categories
              </Link>
            </div>

            <div className="relative mt-5">
              <div
                ref={categoryRailRef}
                className="-mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
                style={{ scrollbarWidth: 'none' }}
              >
                <Link
                  to="/category/Kitchen"
                  className="group flex h-full min-h-0 w-[170px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card hover:bg-slate-50 md:w-[190px]"
                >
                  <div className="shrink-0 bg-white">
                    <img
                      src={categoryKitchen}
                      alt=""
                      aria-hidden="true"
                      className="h-24 w-full object-contain p-3"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="min-h-[40px] text-sm font-semibold leading-snug text-ink-900 line-clamp-2">
                      Kitchen
                    </div>
                    <div className="mt-auto pt-2 text-xs text-slate-600">
                      {kitchenSubcategories.length || 0} subcategories
                    </div>
                  </div>
                </Link>

                {FEATURED_SUBCATEGORIES.map((c) => (
                  <Link
                    key={c.db}
                    to={`/category/Kitchen?subcategory=${encodeURIComponent(c.db)}`}
                    className="group flex h-full min-h-0 w-[170px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card hover:bg-slate-50 md:w-[190px]"
                  >
                    <div className="shrink-0 bg-white">
                      <img
                        src={c.image}
                        alt=""
                        aria-hidden="true"
                        className="h-24 w-full object-contain p-3"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="min-h-[40px] text-sm font-semibold leading-snug text-ink-900 line-clamp-2">
                        {c.label}
                      </div>
                      <div className="mt-auto pt-2 text-xs text-slate-600">
                        {itemsBySubcategory[c.db] ?? 0} items
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <button
                type="button"
                onClick={() => categoryRailRef.current?.scrollBy({ left: 520, behavior: 'smooth' })}
                className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 md:grid"
                aria-label="Scroll categories"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">
                  Top rated products
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Highest scoring products across all categories.
                </p>
              </div>
            </div>

            <div className="relative mt-5">
              <div
                ref={topRatedRailRef}
                className="-mx-4 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {topRated.map((p) => (
                  <TopRatedCard key={p.product_id} product={p} />
                ))}
              </div>

              <button
                type="button"
                onClick={() => topRatedRailRef.current?.scrollBy({ left: 620, behavior: 'smooth' })}
                className="absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 md:grid"
                aria-label="Scroll top rated products"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl bg-forest shadow-[0_26px_60px_-34px_rgba(8,51,32,0.45)]">
              <div className="relative">
                <img
                  src={magicHero}
                  alt=""
                  aria-hidden="true"
                  className="h-[210px] w-full object-cover object-[60%_40%] sm:h-[250px] lg:h-[285px]"
                  loading="lazy"
                />

                {/* 4 zones, top-aligned, no overlap: left text | (subject) | features | white card */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-[28%] bg-gradient-to-r from-forest-deep/85 via-forest-deep/38 to-transparent"
                  aria-hidden
                />
                {/* Intentionally no right veil: keep subject + bottle totally clean. */}

                <div className="absolute inset-0 px-4 py-4 sm:px-6 sm:py-5 min-[1100px]:px-7 min-[1100px]:py-6">
                  {/* Desktop: lock layout with explicit positioning to avoid overlap. */}
                  <div className="h-full">
                    <div className="min-[1100px]:absolute min-[1100px]:left-7 min-[1100px]:top-7">
                      <div className="max-w-[18rem] text-white sm:max-w-[20rem]">
                        <div className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                          We make plastic <span className="italic text-[#c9a227]">disappear</span>.
                        </div>
                        <div className="mt-3 text-sm font-medium text-white/85 sm:text-base">
                          So you can live healthier,
                          <br />
                          safer, every day.
                        </div>
                      </div>
                    </div>

                    {/* Block 3: place it immediately to the right of the bottle. */}
                    <div className="hidden min-[1100px]:block">
                      <div className="absolute left-[55%] top-1/2 -translate-y-1/2">
                        <div className="min-h-[248px] w-[220px] rounded-2xl bg-forest-deep/55 p-4 ring-1 ring-white/10 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.55)] backdrop-blur-sm">
                          <div className="grid gap-3">
                            <div className="flex gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                <FlaskConical className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">Science-first</div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-white/80">
                                  Grounded in materials science, toxicology, and emerging research.
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                <Shield className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">Transparent</div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-white/80">
                                  Clear scoring, evidence tiers,
                                  <br />
                                  and methodology.
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                                <Users className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-white">Consumer-first</div>
                                <div className="mt-0.5 text-[11px] leading-relaxed text-white/80">
                                  Designed to help you make
                                  <br />
                                  safer, everyday choices.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Block 4: white card in the empty space to the right. */}
                    <div className="hidden min-[1100px]:block">
                      <div className="absolute left-[min(calc(55%+220px+70px),calc(100%-20px-220px))] top-1/2 -translate-y-1/2">
                        <div className="w-[220px] min-h-[248px] rounded-2xl bg-white/95 p-4 shadow-[0_22px_55px_-30px_rgba(0,0,0,0.55)] ring-1 ring-black/10 backdrop-blur-sm">
                          <div className="text-xs font-semibold tracking-wide text-forest">
                            Our scientific foundation
                          </div>

                          <div className="mt-2 text-[12px] font-medium leading-relaxed text-slate-700">
                            PlasticBegone translates emerging science into practical buying decisions. We incorporate
                            validated findings, including the PERTH Trial published in Nature Medicine (2024), into our
                            scoring where appropriate.
                          </div>

                          <div className="mt-4">
                            <Link
                              to="/about#methodology"
                              className="inline-flex w-full items-center justify-between gap-3 rounded-xl bg-slate-100/80 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-black/5 transition hover:bg-slate-100"
                            >
                              Learn about our science
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
                <AssuranceCard
                  icon={<Shield className="h-7 w-7 text-emerald-700" />}
                  title="Score basis categories"
                  body="Each product includes a badge that shows our confidence and methodology."
                  cta="See all score basis types"
                  to="/about"
                />
                <AssuranceCard
                  icon={<RefreshCcw className="h-7 w-7 text-blue-700" />}
                  title="Updated regularly"
                  body="We continuously review new evidence and update scores as science evolves."
                  cta="How updates work"
                  to="/about"
                />
                <AssuranceCard
                  icon={<Scale className="h-7 w-7 text-violet-700" />}
                  title="Independent & unbiased"
                  body="Scores are based solely on scientific methodology. We do not accept paid placements."
                  cta="Our integrity promise"
                  to="/about"
                />
                <AssuranceCard
                  icon={<Link2 className="h-7 w-7 text-amber-700" />}
                  title="Affiliate disclosure"
                  body="PlasticBegone may earn commissions on purchases made through affiliate links. This does not influence ratings."
                  cta="Read full disclosure"
                  to="/about"
                />
            </div>

            {!allProducts ? <div className="mt-6 text-sm text-slate-600">Loading…</div> : null}
          </>
        )}
          </section>
        </div>
      </div>
    </div>
  )
}

function TopRatedCard({ product }: { product: Product }) {
  const score = product.pac_safety_score ?? 0
  const tier = product.tier ?? tierForScore(score)
  const tierLabel = tier
  const tierStyles = colorForTier(tier)
  const tierColor = tierStyles.text
  const tierRing = tierStyles.ring

  return (
    <Link
      to={`/product/${product.product_id}`}
      className="group flex h-full min-h-0 w-[220px] shrink-0 snap-start flex-col self-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card hover:bg-slate-50 md:w-[240px]"
    >
      <div className="relative shrink-0 bg-white ring-1 ring-slate-100">
        <div className="absolute left-3 top-3">
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl bg-white ring-1 ${tierRing} shadow-sm`}
            aria-label={`PAC Safety Score ${score} (${tier})`}
            title={`PAC Safety Score ${score} (${tier})`}
          >
            <div className="text-center">
              <div className={`text-2xl font-bold tabular-nums leading-none ${tierColor}`}>{score}</div>
              <div className={`mt-1 text-[10px] font-bold leading-none ${tierColor}`}>{tierLabel}</div>
            </div>
          </div>
        </div>
        <div className="h-28 w-full p-3">
          <ProductImage
            src={product.image_url}
            name={product.product_name}
            fit="contain"
            className="bg-transparent"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 bg-slate-50 p-4">
        <div className="min-h-[40px] text-sm font-semibold leading-snug text-ink-900 line-clamp-2">
          {product.product_name}
        </div>
        <div className="mt-1 text-xs text-slate-600">{product.brand ?? '—'}</div>

        <div className="mt-3 min-h-[28px]">
          {product.score_basis ? (
            <ScoreBasisBadge basis={product.score_basis} className="bg-white" />
          ) : null}
        </div>

        <div className="mt-3 min-h-[32px] text-xs leading-snug text-slate-600 line-clamp-2">
          {product.category ?? '—'}
          {product.subcategory ? ` • ${product.subcategory}` : ''}
        </div>

        <div className="mt-auto pt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="text-emerald-900">View details</span>{' '}
          <ArrowRight className="h-4 w-4 text-emerald-900" />
        </div>
      </div>
    </Link>
  )
}

function AssuranceCard({
  icon,
  title,
  body,
  cta,
  to,
}: {
  icon: React.ReactNode
  title: string
  body: string
  cta: string
  to: string
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" aria-hidden="true">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink-900">{title}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-600">{body}</div>
        </div>
      </div>

      <Link to={to} className="mt-auto inline-flex items-center gap-2 text-xs font-semibold text-ink-900">
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

