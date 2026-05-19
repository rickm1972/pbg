import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CookingPot, FlaskConical, ShieldCheck, Users } from 'lucide-react'
import type { Product } from '../types'
import { fetchAllProducts } from '../lib/productsApi'
import categoriesHero from '../assets/categories-hero.png'
import { TopNav } from '../components/nav/TopNav'
import categoryFoodStorage from '../assets/category-food-storage.png'
import categoryCookware from '../assets/category-cookware.png'
import categoryCookingUtensils from '../assets/category-cooking-utensils.png'
import categoryWaterBottles from '../assets/category-water-bottles.png'
import categoryDishSoap from '../assets/category-dish-soap.png'

export function CategoriesPage() {
  const [allProducts, setAllProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllProducts(2000)
      .then((d) => setAllProducts(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load categories'))
  }, [])

  const kitchenProducts = useMemo(
    () => (allProducts ?? []).filter((p) => (p.category ?? '') === 'Kitchen'),
    [allProducts],
  )

  const countsBySubcategory = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of kitchenProducts) {
      const s = (p.subcategory ?? '').trim()
      if (!s) continue
      out[s] = (out[s] ?? 0) + 1
    }
    return out
  }, [kitchenProducts])

  return (
    <div className="bg-transparent">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="relative overflow-hidden bg-[#fdfcf9]">
          <TopNav variant="overlay" overlayPosition="absolute" />

          <section className="bg-transparent pb-0 pt-0">
            <div className="relative isolate overflow-hidden rounded-[1.65rem] bg-[#fdfcf9] shadow-[0_28px_70px_-28px_rgba(15,61,38,0.35)] ring-1 ring-black/[0.04] md:rounded-[1.85rem]">
              <img
                src={categoriesHero}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover object-[58%_44%]"
                loading="eager"
              />

              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[78%] bg-gradient-to-r from-[#fdfcf9]/96 via-[#fdfcf9]/65 to-transparent sm:w-[70%] md:w-[62%] lg:w-[56%]"
                aria-hidden
              />

              <div className="relative z-10 flex flex-col px-4 pb-5 pt-20 sm:px-6 sm:pb-6 sm:pt-24 lg:px-10 lg:pb-7 lg:pt-28">
                <div className="max-w-[22.5rem] sm:max-w-[23.5rem] lg:max-w-[24.5rem]">
                  <div className="text-xs font-medium text-slate-600">
                    <Link to="/" className="hover:text-ink-900">
                      Home
                    </Link>
                    <span className="mx-2 text-slate-300">›</span>
                    <span className="text-slate-700">Categories</span>
                  </div>

                  <h1 className="mt-4 font-display text-balance text-[2.25rem] font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.1rem] xl:text-[3.35rem]">
                    Categories
                  </h1>
                  <p className="mt-4 text-pretty text-sm font-medium leading-relaxed text-slate-700 sm:text-[0.9375rem] lg:text-base">
                    Browse PlasticBegone product categories and explore safer alternatives for everyday living.
                  </p>

                  {/* Keep all copy + trust row in the left column so nothing sits on the product photo */}
                  <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:gap-3.5">
                    <MiniHeroPoint
                      icon={<ShieldCheck className="h-[22px] w-[22px] text-forest" />}
                      title="Science-first"
                      body="Products scored using validated methodology."
                    />
                    <MiniHeroPoint
                      icon={<FlaskConical className="h-[22px] w-[22px] text-forest" />}
                      title="Transparent"
                      body="Clear scoring, evidence tiers, and methodology."
                    />
                    <MiniHeroPoint
                      icon={<Users className="h-[22px] w-[22px] text-forest" />}
                      title="Consumer-first"
                      body="Designed to help you make safer, everyday choices."
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {!allProducts ? <div className="mt-6 text-sm text-slate-600">Loading…</div> : null}

          <section className="bg-transparent px-4 pb-8 pt-6 md:px-6 md:pb-10 md:pt-8">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink-900">
                Browse by category <span className="text-[#c9a227]">✨</span>
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Explore product categories to find safer alternatives for your home and lifestyle.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#F4FBF2] ring-1 ring-emerald-100">
                  <CookingPot className="h-5 w-5 text-emerald-800" />
                </div>
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink-900">
                  Kitchen
                </h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Safer products for cooking, storage, cleaning, and hydration.
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kitchen subcategories
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
              <SubcategoryCard
                ariaTitle="Food Storage"
                title="Food Storage"
                image={categoryFoodStorage}
                haloClass="bg-emerald-50"
                count={countsBySubcategory['Food Storage'] ?? 0}
                to={`/category/${encodeURIComponent('Kitchen')}?subcategory=${encodeURIComponent('Food Storage')}`}
              />
              <SubcategoryCard
                ariaTitle="Cookware"
                title="Cookware"
                image={categoryCookware}
                haloClass="bg-blue-50"
                count={countsBySubcategory['Cookware'] ?? 0}
                to={`/category/${encodeURIComponent('Kitchen')}?subcategory=${encodeURIComponent('Cookware')}`}
              />
              <SubcategoryCard
                ariaTitle="Cooking Utensils"
                title="Cooking Utensils"
                image={categoryCookingUtensils}
                haloClass="bg-amber-50"
                count={countsBySubcategory['Cooking Utensils'] ?? 0}
                to={`/category/${encodeURIComponent('Kitchen')}?subcategory=${encodeURIComponent('Cooking Utensils')}`}
              />
              <SubcategoryCard
                ariaTitle="Water Bottles and Drinkware"
                title={
                  <>
                    Water Bottles &<br />
                    Drinkware
                  </>
                }
                image={categoryWaterBottles}
                haloClass="bg-emerald-50"
                count={countsBySubcategory['Water Bottles and Drinkware'] ?? 0}
                to={`/category/${encodeURIComponent('Kitchen')}?subcategory=${encodeURIComponent('Water Bottles and Drinkware')}`}
              />
              <SubcategoryCard
                ariaTitle="Dish Soap"
                title="Dish Soap"
                image={categoryDishSoap}
                haloClass="bg-violet-50"
                count={countsBySubcategory['Dish Soap'] ?? 0}
                to={`/category/${encodeURIComponent('Kitchen')}?subcategory=${encodeURIComponent('Dish Soap')}`}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function MiniHeroPoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 ring-1 ring-black/5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-snug text-ink-900 sm:text-[0.9375rem] lg:text-base">
          {title}
        </div>
        <div className="mt-1 text-pretty text-sm font-medium leading-relaxed text-slate-700 sm:text-[0.9375rem] lg:text-base">
          {body}
        </div>
      </div>
    </div>
  )
}

function SubcategoryCard({
  ariaTitle,
  title,
  image,
  haloClass,
  count,
  to,
}: {
  ariaTitle: string
  title: React.ReactNode
  image: string
  haloClass: string
  count: number
  to: string
}) {
  return (
    <Link
      to={to}
      aria-label={`${ariaTitle}: ${count} products. View products.`}
      className="group flex min-h-[300px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <div className="relative grid place-items-center overflow-hidden rounded-2xl bg-white px-4 py-6">
        <div className={`pointer-events-none absolute inset-0 ${haloClass}`} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
          <div className="h-[9.5rem] w-[9.5rem] rounded-full bg-white/55" />
        </div>
        <img src={image} alt="" aria-hidden="true" className="relative h-28 w-28 object-contain" />
      </div>

      <div className="mt-5 flex flex-1 flex-col items-center">
        <div className="min-h-10 text-center text-sm font-semibold text-ink-900">{title}</div>
        <div className="mt-2 text-center text-xs font-medium text-slate-500">{count} products</div>
        <div className="flex-1" />
      </div>
      <div className="mt-6 inline-flex items-center justify-center gap-2 text-xs font-semibold text-emerald-900 group-hover:text-emerald-950">
        View products <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

