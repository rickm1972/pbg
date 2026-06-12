import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Filter,
  Info,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import type { Product, ProductTier } from '../types'
import { cn } from '../lib/cn'
import { fetchProductsByCategory } from '../lib/productsApi'
import { filterPublicListProducts, hasPublicDisplayScore } from '../lib/publicProductDisplay'
import {
  LEGACY_LUMPED_DRINKWARE_SUBCATEGORY,
  productMatchesPublicSubcategory,
  sortPublicSubcategoryLabels,
} from '../lib/publicTaxonomyBrowse'
import { tierForScore } from '../lib/score'
import { ScoreMark } from '../components/ScoreMark'
import { ProductImage } from '../components/ProductImage'
import categoryFoodStorage from '../assets/category-food-storage.png'
import categoryCookware from '../assets/category-cookware.png'
import categoryCookingUtensils from '../assets/category-cooking-utensils.png'
import categoryWaterBottles from '../assets/category-water-bottles.png'

export function CategoryPage() {
  const { categoryName } = useParams()
  const category = decodeURIComponent(categoryName ?? '')
  const [searchParams] = useSearchParams()
  const subcategory = (searchParams.get('subcategory') ?? '').trim()

  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters / sort (local state; we keep the route stable and only use searchParams for subcategory).
  const [tierFilter, setTierFilter] = useState<Set<ProductTier>>(() => new Set())
  const [primaryMaterialFilter, setPrimaryMaterialFilter] = useState<Set<string>>(() => new Set())
  const [bpaFilter, setBpaFilter] = useState<Set<'Yes' | 'No'>>(() => new Set())
  const [featureFilter, setFeatureFilter] = useState<Set<string>>(() => new Set())
  const [sort, setSort] = useState<'highest' | 'lowest'>('highest')

  useEffect(() => {
    if (!category) return
    setProducts(null)
    setError(null)
    // Always load every product in the category; subcategory is filtered client-side via ?subcategory=
    // so pill counts stay accurate and users can switch subs without refetching.
    fetchProductsByCategory({ category })
      .then((d) => setProducts(d))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load category products'),
      )
  }, [category])

  useEffect(() => {
    // Reset filters when navigating between subcategories/categories.
    setTierFilter(new Set())
    setPrimaryMaterialFilter(new Set())
    setBpaFilter(new Set())
    setFeatureFilter(new Set())
    setSort('highest')
  }, [category, subcategory])

  const publicProducts = useMemo(
    () => (products ? filterPublicListProducts(products) : null),
    [products],
  )

  const scopedProducts = useMemo(() => {
    if (!publicProducts) return null
    if (!subcategory) return publicProducts
    return publicProducts.filter((p) => productMatchesPublicSubcategory(p, subcategory))
  }, [publicProducts, subcategory])

  const subcategoryCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of publicProducts ?? []) {
      const s = (p.subcategory ?? '').trim()
      if (!s || !isPublicSubcategory(s)) continue
      out[s] = (out[s] ?? 0) + 1
    }
    return out
  }, [publicProducts])

  const subcategoryOptions = useMemo(
    () =>
      sortSubcategoryLabels(
        Object.keys(subcategoryCounts).filter(isPublicSubcategory),
        category,
      ),
    [subcategoryCounts, category],
  )

  const subcategoryImage = useMemo(() => {
    const key = subcategory || ''
    if (key === 'Food Storage') return categoryFoodStorage
    if (key === 'Cookware') return categoryCookware
    if (key === 'Cooking Utensils') return categoryCookingUtensils
    if (key === 'Water Bottles and Drinkware') return categoryWaterBottles
    return null
  }, [subcategory])

  const facets = useMemo(() => buildFacets(scopedProducts ?? []), [scopedProducts])

  const filtered = useMemo(() => {
    if (!scopedProducts) return null
    const list = scopedProducts.filter((p) => {
      if (!hasPublicDisplayScore(p)) return false
      const score = p.pac_safety_score as number
      const tier = p.tier ?? tierForScore(score)
      if (tierFilter.size > 0 && !tierFilter.has(tier)) return false

      const pm = (p.primary_material ?? '').trim() || 'Other'
      if (primaryMaterialFilter.size > 0 && !primaryMaterialFilter.has(pm)) return false

      const bpa = (p.bpa_free ?? 'Unknown') as string
      if (bpaFilter.size > 0) {
        if (bpa !== 'Yes' && bpa !== 'No') return false
        if (!bpaFilter.has(bpa as 'Yes' | 'No')) return false
      }

      if (featureFilter.size > 0) {
        const feats = inferFeatures(p)
        for (const f of featureFilter) {
          if (!feats.has(f)) return false
        }
      }

      return true
    })

    list.sort((a, b) => {
      const as = a.pac_safety_score as number
      const bs = b.pac_safety_score as number
      return sort === 'highest' ? bs - as : as - bs
    })

    return list
  }, [scopedProducts, tierFilter, primaryMaterialFilter, bpaFilter, featureFilter, sort])

  const activeChips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = []
    for (const t of tierFilter) out.push({ key: `tier:${t}`, label: t, onRemove: () => toggleSet(tierFilter, setTierFilter, t) })
    for (const m of primaryMaterialFilter)
      out.push({
        key: `pm:${m}`,
        label: `Material: ${m}`,
        onRemove: () => toggleSet(primaryMaterialFilter, setPrimaryMaterialFilter, m),
      })
    for (const b of bpaFilter)
      out.push({
        key: `bpa:${b}`,
        label: `BPA Free: ${b}`,
        onRemove: () => toggleSet(bpaFilter, setBpaFilter, b),
      })
    for (const f of featureFilter)
      out.push({
        key: `feat:${f}`,
        label: f,
        onRemove: () => toggleSet(featureFilter, setFeatureFilter, f),
      })
    return out
  }, [tierFilter, primaryMaterialFilter, bpaFilter, featureFilter])

  return (
    <div className="bg-[#fdfcf9]">
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-8 md:px-6 md:pt-6 md:pb-10">
      <div className="text-xs font-medium text-slate-500">
        <Link to="/" className="hover:text-ink-900">
          Home
        </Link>
        <span className="mx-2 text-slate-300">›</span>
        <Link to="/categories" className="hover:text-ink-900">
          Categories
        </Link>
        <span className="mx-2 text-slate-300">›</span>
        <Link to={`/category/${encodeURIComponent(category)}`} className="hover:text-ink-900">
          {category}
        </Link>
        {subcategory ? (
          <>
            <span className="mx-2 text-slate-300">›</span>
            <span className="text-slate-600">{subcategory}</span>
          </>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-8">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {subcategory ? category : 'Category'}
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink-900 md:text-5xl">
            {subcategory || category}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700">
            {subcategory
              ? 'Food storage products help keep your food fresh and safe. Explore highly rated options made from safer materials.'
              : 'Explore products in this category, sorted by PAC Safety Score.'}
          </p>
          <div className="mt-4 text-xs font-medium text-slate-500">
            {filtered
              ? `${filtered.length} products`
              : scopedProducts
                ? `${scopedProducts.length} products`
                : products
                  ? `${products.length} products`
                  : '—'}
          </div>
        </div>

        <div className="md:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm font-semibold text-ink-900">What is the PAC Safety Score?</div>
              <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-50 ring-1 ring-slate-200">
                <Info className="h-4 w-4 text-slate-500" />
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              The PAC Safety Score rates products on a 0–100 scale based on plastic-associated chemical exposure
              risk. Higher scores are safer.
            </p>
            <Link
              to="/about"
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 hover:text-emerald-800"
            >
              Learn more about how we score <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {!products ? <div className="mt-6 text-sm text-slate-600">Loading…</div> : null}

      {products && subcategoryOptions.length > 0 ? (
        <div className="mt-8">
          <div className="text-xs font-semibold text-slate-700">Subcategory</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/category/${encodeURIComponent(category)}`}
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition',
                !subcategory
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              All ({products.length})
            </Link>
            {subcategoryOptions.map((s) => (
              <Link
                key={s}
                to={`/category/${encodeURIComponent(category)}?subcategory=${encodeURIComponent(s)}`}
                className={cn(
                  'rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition',
                  subcategory === s
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {s}{' '}
                <span className="font-medium text-slate-500">({subcategoryCounts[s] ?? 0})</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {products ? (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Filter className="h-4 w-4 text-slate-500" />
                Filters
              </button>

              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.onRemove}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  {c.label}
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              ))}

              {activeChips.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setTierFilter(new Set())
                    setPrimaryMaterialFilter(new Set())
                    setBpaFilter(new Set())
                    setFeatureFilter(new Set())
                  }}
                  className="ml-1 text-xs font-semibold text-emerald-900 hover:text-emerald-800"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="text-slate-500">Sort:</span>
              <button
                type="button"
                onClick={() => setSort((s) => (s === 'highest' ? 'lowest' : 'highest'))}
                className="inline-flex items-center gap-1 hover:text-ink-900"
              >
                {sort === 'highest' ? 'Highest score' : 'Lowest score'} <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-12">
            <aside className="md:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card md:sticky md:top-24">
                <div className="text-xs font-semibold text-slate-700">Filter by</div>

                <FacetSection
                  title="PAC Safety Score"
                  items={[
                    { id: 'Excellent', label: '90–100 (Excellent)', count: facets.tier.Excellent },
                    { id: 'Good', label: '75–89 (Good)', count: facets.tier.Good },
                    { id: 'Caution', label: '55–74 (Caution)', count: facets.tier.Caution },
                    { id: 'Concern', label: '30–54 (Concern)', count: facets.tier.Concern },
                    { id: 'High Risk', label: '0–29 (High Risk)', count: facets.tier['High Risk'] },
                  ]}
                  selected={tierFilter}
                  onToggle={(id) => toggleSet(tierFilter, setTierFilter, id as any)}
                />

                <FacetSection
                  title="Primary Material"
                  items={facets.primaryMaterials.map((m) => ({ id: m.value, label: m.value, count: m.count }))}
                  selected={primaryMaterialFilter}
                  onToggle={(id) => toggleSet(primaryMaterialFilter, setPrimaryMaterialFilter, id)}
                />

                <FacetSection
                  title="BPA Free"
                  items={[
                    { id: 'Yes', label: 'Yes', count: facets.bpa.Yes },
                    { id: 'No', label: 'No', count: facets.bpa.No },
                  ]}
                  selected={bpaFilter}
                  onToggle={(id) => toggleSet(bpaFilter, setBpaFilter, id as any)}
                />

                <FacetSection
                  title="Features"
                  items={facets.features.map((f) => ({ id: f.value, label: f.value, count: f.count }))}
                  selected={featureFilter}
                  onToggle={(id) => toggleSet(featureFilter, setFeatureFilter, id)}
                />
              </div>
            </aside>

            <div className="md:col-span-9">
              {scopedProducts && scopedProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
                  No products in this subcategory. Choose another subcategory above or{' '}
                  <Link to={`/category/${encodeURIComponent(category)}`} className="font-semibold text-emerald-900 hover:underline">
                    view all in {category}
                  </Link>
                  .
                </div>
              ) : filtered ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((p) => (
                    <SubcategoryProductCard key={p.product_id} product={p} />
                  ))}
                </div>
              ) : null}

              {filtered && filtered.length === 0 && scopedProducts && scopedProducts.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
                  No products match these filters.
                </div>
              ) : null}
            </div>
          </div>

          {subcategory ? (
            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-[#F4FBF2] shadow-card">
              <div className="grid gap-6 p-6 md:grid-cols-12 md:items-center md:gap-8 md:p-8">
                <div className="md:col-span-7">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/70 ring-1 ring-emerald-100">
                      <ShieldCheck className="h-5 w-5 text-emerald-800" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">
                        Why choose higher scoring {subcategory.toLowerCase()}?
                      </div>
                      <div className="mt-2 text-sm leading-relaxed text-slate-700">
                        Higher scoring products are made with safer materials and are less likely to
                        leach plastic-associated chemicals into your food, especially when exposed
                        to heat, acidity, or fat.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-5">
                  {subcategoryImage ? (
                    <div className="grid place-items-center">
                      <img src={subcategoryImage} alt="" aria-hidden="true" className="h-28 w-28 object-contain" />
                    </div>
                  ) : (
                    <div className="grid place-items-center text-sm text-slate-500">
                      <CircleHelp className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {products && products.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
          No products found in this category.
        </div>
      ) : null}
      </div>
    </div>
  )
}

/** Subcategories hidden from public catalog (materials-science scope only). */
const EXCLUDED_SUBCATEGORIES = new Set(['Dish Soap'])

function isPublicSubcategory(label: string): boolean {
  return label.trim().length > 0 && !EXCLUDED_SUBCATEGORIES.has(label.trim())
}

function sortSubcategoryLabels(labels: string[], categoryName: string): string[] {
  return sortPublicSubcategoryLabels(labels, categoryName)
}

function FacetSection<T extends string>({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string
  items: { id: T; label: string; count: number }[]
  selected: Set<T>
  onToggle: (id: T) => void
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700">{title}</div>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <label
            key={it.id}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(it.id)}
                onChange={() => onToggle(it.id)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-2 focus:ring-emerald-200"
              />
              <span>{it.label}</span>
            </span>
            <span className="text-slate-400">({it.count})</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function toggleSet<T>(set: Set<T>, setter: (next: Set<T>) => void, item: T) {
  const next = new Set(set)
  if (next.has(item)) next.delete(item)
  else next.add(item)
  setter(next)
}

function buildFacets(products: Product[]) {
  const tierCounts: Record<ProductTier, number> = {
    Excellent: 0,
    Good: 0,
    Caution: 0,
    Concern: 0,
    'High Risk': 0,
  }
  const primary: Record<string, number> = {}
  const bpa: Record<'Yes' | 'No', number> = { Yes: 0, No: 0 }
  const feats: Record<string, number> = {}

  for (const p of products) {
    if (!hasPublicDisplayScore(p)) continue
    const score = p.pac_safety_score as number
    const tier = p.tier ?? tierForScore(score)
    tierCounts[tier]++

    const pm = (p.primary_material ?? '').trim() || 'Other'
    primary[pm] = (primary[pm] ?? 0) + 1

    const b = p.bpa_free
    if (b === 'Yes' || b === 'No') bpa[b]++

    for (const f of inferFeatures(p)) feats[f] = (feats[f] ?? 0) + 1
  }

  const primaryMaterials = Object.entries(primary)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))

  const features = Object.entries(feats)
    .map(([value, count]) => ({ value, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 8)

  return { tier: tierCounts, primaryMaterials, bpa, features }
}

function inferFeatures(p: Product) {
  const text = `${p.product_name ?? ''} ${p.description ?? ''} ${p.secondary_material ?? ''}`.toLowerCase()
  const out = new Set<string>()
  if (text.includes('airtight')) out.add('Airtight Seal')
  if (text.includes('microwave')) out.add('Microwave Safe')
  if (text.includes('dishwasher')) out.add('Dishwasher Safe')
  if (text.includes('freezer')) out.add('Freezer Safe')
  return out
}

function SubcategoryProductCard({ product }: { product: Product }) {
  if (!hasPublicDisplayScore(product)) return null

  const score = product.pac_safety_score as number
  const tier = product.tier ?? tierForScore(score)
  const tags = useMemo(() => {
    const out: string[] = []
    const pm = (product.primary_material ?? '').trim()
    if (pm) out.push(pm)
    const bpa = product.bpa_free
    if (bpa === 'Yes') out.push('BPA Free')
    for (const f of inferFeatures(product)) out.push(f)
    return out.slice(0, 3)
  }, [product])

  return (
    <Link
      to={`/product/${product.product_id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative bg-white ring-1 ring-slate-100">
        <div className="absolute left-4 top-4 z-10">
          <ScoreMark score={score} tier={tier} size="sm" />
        </div>
        <div className="h-36 w-full p-4 pt-12">
          <ProductImage
            src={product.image_url}
            name={product.product_name}
            fit="contain"
            className="bg-transparent"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-slate-50 p-4">
        <div className="min-h-[40px] text-sm font-semibold text-ink-900 line-clamp-2">
          {product.product_name}
        </div>
        <div className="mt-1 text-xs text-slate-600">{product.brand ?? '—'}</div>

        <div className="mt-3 h-8 overflow-hidden">
          <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {t}
            </span>
          ))}
          </div>
        </div>

        <div className="mt-auto pt-4 inline-flex items-center gap-2 text-xs font-semibold text-emerald-900">
          <span className="group-hover:underline">View details</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}

