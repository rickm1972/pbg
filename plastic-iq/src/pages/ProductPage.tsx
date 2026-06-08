import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import type { Product, ProductTier } from '../types'
import type { AprPublicRenderInput } from '../types/apr'
import { fetchProduct, fetchProductsByCategory } from '../lib/productsApi'
import { pickSaferAlternatives } from '../lib/saferAlternatives'
import { fetchAprPublicRenderInput } from '../lib/apr/fetchPublicApr'
import { WhyThisScore } from '../components/WhyThisScore'
import { CertificationBadges } from '../components/CertificationBadges'
import { RiskDashboard } from '../components/RiskDashboard'
import { Sources } from '../components/Sources'
import { ScoreMark } from '../components/ScoreMark'
import { TransparencyBadge } from '../components/TransparencyBadge'
import { PacTierLegend } from '../components/PacTierLegend'
import { ProductImage } from '../components/ProductImage'
import {
  PUBLIC_SCORE_PENDING_MESSAGE,
  SAFER_ALTERNATIVES_COMING_SOON,
} from '../lib/apr/pageChrome'
import { alternativeProductBuyCtas } from '../lib/apr/alternativeBuyCta'
import { colorForTier, isGoodOrExcellentProduct, showsSaferAlternatives } from '../lib/score'
import { RetailerBuyButtons } from '../components/RetailerBuyButtons'

export function ProductPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [apr, setApr] = useState<AprPublicRenderInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<Product[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) return
    setLoading(true)
    setProduct(null)
    setApr(null)
    setError(null)

    fetchProduct(productId)
      .then(async (p) => {
        setProduct(p)
        const renderInput = await fetchAprPublicRenderInput(p)
        setApr(renderInput)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load product'))
      .finally(() => setLoading(false))
  }, [productId])

  const score = apr?.score.pac_safety_score ?? null
  const tier = (apr?.score.tier ?? null) as ProductTier | null
  const hasPageScore = score != null && tier != null

  const showSaferAlternativesSection = useMemo(() => {
    if (score == null || !showsSaferAlternatives(score)) return false
    if (alternatives === null) return true
    if (alternatives.length > 0) return true
    return tier === 'High Risk'
  }, [score, alternatives, tier])

  useEffect(() => {
    if (score == null) {
      setAlternatives(null)
      return
    }
    if (!showsSaferAlternatives(score)) {
      setAlternatives(null)
      return
    }
    if (!product?.category || !product.subcategory) {
      setAlternatives([])
      return
    }

    let cancelled = false
    setAlternatives(null)
    fetchProductsByCategory({ category: product.category, subcategory: product.subcategory })
      .then((items) => {
        if (cancelled) return
        setAlternatives(pickSaferAlternatives(items, product.product_id))
      })
      .catch(() => {
        if (cancelled) return
        setAlternatives([])
      })

    return () => {
      cancelled = true
    }
  }, [product?.category, product?.subcategory, product?.product_id, score])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="text-sm text-slate-600">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
          Product not found.
        </div>
      </div>
    )
  }

  const display = apr?.display
  const pageTitle = display?.product_title ?? product.product_name

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="text-xs font-medium text-slate-500 -mt-1">
        <Link to="/" className="hover:text-ink-900">
          Home
        </Link>
        <span className="mx-2 text-slate-300">›</span>
        <Link
          to={`/category/${encodeURIComponent(product.category ?? 'Kitchen')}`}
          className="hover:text-ink-900"
        >
          {product.category ?? 'Kitchen'}
        </Link>
        {product.subcategory ? (
          <>
            <span className="mx-2 text-slate-300">›</span>
            <span className="text-slate-600">{product.subcategory}</span>
          </>
        ) : null}
        <span className="mx-2 text-slate-300">›</span>
        <span className="text-slate-600">{pageTitle}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <div className="text-sm font-semibold text-slate-500">{product.brand ?? '—'}</div>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-ink-900 md:text-5xl">
            {pageTitle}
          </h1>

          <div className="mt-6 flex flex-wrap items-start gap-5">
            <div className="flex flex-col items-center gap-2">
              {hasPageScore && score != null && tier != null ? (
                <ScoreMark score={score} tier={tier} size="lg" />
              ) : (
                <ScorePendingMark />
              )}
            </div>
            <div className="min-w-[12rem] space-y-3 pt-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                PAC Safety Score
              </div>
              {hasPageScore && tier ? (
                <p className="text-sm font-semibold text-ink-900">{tier}</p>
              ) : null}
              {!hasPageScore ? (
                <p className="text-sm leading-relaxed text-slate-600">{PUBLIC_SCORE_PENDING_MESSAGE}</p>
              ) : null}
              {apr?.score.transparency_badge ? (
                <div>
                  <TransparencyBadge badge={apr.score.transparency_badge} />
                  {display?.badge_summary ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{display.badge_summary}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {display?.product_description ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-card">
              {display.product_description}
            </div>
          ) : null}

          {display?.risk_bars && display.risk_bars.length > 0 ? (
            <RiskDashboard riskBars={display.risk_bars} className="mt-6" />
          ) : null}

          {productId ? <CertificationBadges productId={productId} className="mt-6" /> : null}

          {display?.why_this_score.sections && display.why_this_score.sections.length > 0 ? (
            <WhyThisScore sections={display.why_this_score.sections} className="mt-6" />
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-card">
              <div className="text-sm font-semibold text-ink-900">Why this score?</div>
              <p className="mt-2 leading-relaxed">
                Structured score breakdown will appear after normalization is approved for this
                product.
              </p>
            </div>
          )}

          {showSaferAlternativesSection && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink-900">Safer alternatives</div>
                  {display?.safer_alternatives_subhead ? (
                    <div className="mt-1 text-sm text-slate-500">
                      {display.safer_alternatives_subhead}
                    </div>
                  ) : null}
                </div>
                {product.category && product.subcategory && alternatives && alternatives.length > 0 ? (
                  <Link
                    to={`/category/${encodeURIComponent(product.category)}?subcategory=${encodeURIComponent(product.subcategory)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
                  >
                    {product.subcategory}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </div>

              {alternatives === null ? (
                <div className="mt-3 text-sm text-slate-600">Loading alternatives…</div>
              ) : alternatives.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {SAFER_ALTERNATIVES_COMING_SOON}
                </p>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  <div className="divide-y divide-slate-100">
                    {alternatives.map((p) => (
                      <AlternativeRow key={p.product_id} product={p} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white">
                <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
                  <div className="flex items-start gap-3 text-xs leading-relaxed text-slate-500">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div className="pt-1">
                      {display?.safer_alternatives_footer}
                    </div>
                  </div>
                  {product.category && product.subcategory ? (
                    <Link
                      to={`/category/${encodeURIComponent(product.category)}?subcategory=${encodeURIComponent(product.subcategory)}`}
                      className="inline-flex items-center justify-end gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-900"
                    >
                      See more alternatives <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {display && display.sources.length > 0 ? (
            <Sources
              sourcesIntro={display.sources_intro}
              sources={display.sources}
              className="mt-6"
            />
          ) : null}
        </div>

        <aside className="md:col-span-5">
          <div className="sticky top-20 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="aspect-[4/3] w-full">
                <ProductImage
                  src={product.image_url}
                  name={pageTitle}
                  fit="contain"
                  className="text-xl"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm font-semibold text-ink-900">
                {display?.buy_section_title ?? 'Where to buy'}
              </div>
              <p className="mt-1 text-sm text-slate-600">Links open in a new tab.</p>
              {display?.buy_cta && display.buy_cta.length > 0 ? (
                <div className="mt-4">
                  {hasPageScore && score != null && tier != null ? (
                    <RetailerBuyButtons tier={tier} buyCta={display.buy_cta} />
                  ) : (
                    <RetailerBuyButtons tier="Good" buyCta={display.buy_cta} />
                  )}
                  {display.retailer_caution_note ? (
                    <p className="mt-3 text-xs leading-relaxed text-highrisk">
                      {display.retailer_caution_note}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No verified retailer listings for this product yet.
                </p>
              )}
              {display?.buy_cta &&
              display.buy_cta.length > 0 &&
              hasPageScore &&
              score != null &&
              isGoodOrExcellentProduct(score, tier) ? (
                <div className="mt-3 text-xs leading-relaxed text-slate-500">
                  FTC disclosure: PlasticBegone may earn a commission if you purchase through affiliate
                  links. Ratings are independent and based on our PAC Safety Score methodology.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm font-semibold text-ink-900">PAC Safety Score tiers</div>
              <PacTierLegend className="mt-3" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ScorePendingMark() {
  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-2xl bg-white px-2 text-center ring-1 ring-slate-200 shadow-sm"
      aria-label={PUBLIC_SCORE_PENDING_MESSAGE}
    >
      <div className="text-[11px] font-semibold leading-tight text-slate-600">
        {PUBLIC_SCORE_PENDING_MESSAGE}
      </div>
    </div>
  )
}

function AlternativeRow({ product }: { product: Product }) {
  if (typeof product.pac_safety_score !== 'number') return null

  const score = product.pac_safety_score
  const tier = (product.tier ?? 'Good') as ProductTier
  const altBuyCta = alternativeProductBuyCtas(product, tier)
  const pill = scorePillStyle(tier)

  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-4 px-4 py-5 md:grid-cols-[104px_1fr_auto] md:px-6">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100 shadow-sm">
        <div className="aspect-square w-[92px] p-2 md:w-[104px] md:p-2.5">
          <ProductImage
            src={product.image_url}
            name={product.product_name}
            fit="contain"
            className="rounded-xl"
            decorative
          />
        </div>
      </div>

      <div className="min-w-0">
        <div className="min-w-0 text-pretty text-[15px] font-semibold leading-snug text-ink-900 md:text-base">
          {product.product_name}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="font-medium">{product.brand ?? '—'}</span>
          <span className="text-slate-300">•</span>
          <span className={`inline-flex items-center gap-2 rounded-xl px-2.5 py-1 text-xs font-semibold ${pill}`}>
            <span className="tabular-nums">{score}</span>
            <span>{tier}</span>
          </span>
        </div>
      </div>

      <div className="col-span-2 mt-3 w-full md:col-auto md:mt-0 md:min-w-[148px] md:max-w-[200px]">
        {altBuyCta.length > 0 ? (
          <RetailerBuyButtons tier={tier} buyCta={altBuyCta} size="compact" />
        ) : (
          <span className="text-xs text-slate-400">No retailer link</span>
        )}
      </div>
    </div>
  )
}

function scorePillStyle(tier: ProductTier) {
  const c = colorForTier(tier)
  return `${c.bg} ${c.text} ring-1 ${c.ring}`
}
