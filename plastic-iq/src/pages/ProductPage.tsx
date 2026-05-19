import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Leaf,
  Package,
  ShieldCheck,
  Square,
  UtensilsCrossed,
} from 'lucide-react'
import type { Product, ProductTier } from '../types'
import { fetchProduct, fetchProductsByCategory } from '../lib/productsApi'
import { fetchApprovedProductScore, type ApprovedProductScore } from '../lib/productScoresApi'
import { fetchVerifiedCertificationNames } from '../lib/productEvidenceApi'
import { VerifiedCertifications } from '../components/VerifiedCertifications'
import { ScoreMark } from '../components/ScoreMark'
import { FormulationSafetyScores } from '../components/FormulationSafetyScores'
import { ScoreBasisBadge } from '../components/ScoreBasisBadge'
import { TransparencyBadge } from '../components/TransparencyBadge'
import { transparencyBadgeSummary } from '../lib/transparencyBadge'
import { PacTierLegend } from '../components/PacTierLegend'
import { ProductImage } from '../components/ProductImage'
import { colorForTier, tierForScore } from '../lib/score'
import { orderedRetailerLinks, RetailerBuyButtons } from '../components/RetailerBuyButtons'

export function ProductPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [approvedScore, setApprovedScore] = useState<ApprovedProductScore | null>(null)
  const [verifiedCertifications, setVerifiedCertifications] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<Product[] | null>(null)

  useEffect(() => {
    if (!productId) return
    setProduct(null)
    setApprovedScore(null)
    setVerifiedCertifications([])
    setError(null)
    fetchProduct(productId)
      .then((d) => setProduct(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load product'))
    fetchApprovedProductScore(productId)
      .then((row) => setApprovedScore(row))
      .catch(() => setApprovedScore(null))
    fetchVerifiedCertificationNames(productId)
      .then((names) => setVerifiedCertifications(names))
      .catch(() => setVerifiedCertifications([]))
  }, [productId])

  const score = approvedScore?.pac_safety_score ?? product?.pac_safety_score ?? 0
  const ingredientScore = approvedScore?.ingredient_transparency_score ?? null
  const isFormulationProduct = ingredientScore != null
  const tier = useMemo(
    () => approvedScore?.tier ?? (product?.tier ? product.tier : tierForScore(score)),
    [approvedScore, product, score],
  )

  useEffect(() => {
    const shouldShow = tier === 'Caution' || tier === 'High Risk'
    if (!shouldShow) {
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
        setAlternatives(items.filter((p) => p.product_id !== product.product_id).slice(0, 3))
      })
      .catch(() => {
        if (cancelled) return
        setAlternatives([])
      })

    return () => {
      cancelled = true
    }
  }, [product?.category, product?.subcategory, product?.product_id, tier])

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
        <div className="text-sm text-slate-600">Loading…</div>
      </div>
    )
  }

  const retailerLinks = orderedRetailerLinks(product)
  const buySectionTitle =
    tier === 'Caution' || tier === 'High Risk' ? 'Where to view' : 'Where to buy'

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
        <span className="text-slate-600">{product.product_name}</span>
      </div>

      <div className="grid gap-6 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <div className="text-sm font-semibold text-slate-500">{product.brand ?? '—'}</div>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-ink-900 md:text-5xl">
            {product.product_name}
          </h1>

          <div className="mt-6 flex flex-wrap items-start gap-4">
            {isFormulationProduct ? (
              <FormulationSafetyScores
                materialsScore={score}
                ingredientScore={ingredientScore}
                materialsTier={tier}
              />
            ) : (
              <ScoreMark score={score} tier={tier} size="lg" />
            )}
            <div className="min-w-[12rem] space-y-3">
              {!isFormulationProduct ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    PAC Safety Score
                  </div>
                  {product.score_basis ? (
                    <div className="mt-2">
                      <ScoreBasisBadge basis={product.score_basis} />
                    </div>
                  ) : null}
                </div>
              ) : product.score_basis ? (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Score basis
                  </div>
                  <div className="mt-2">
                    <ScoreBasisBadge basis={product.score_basis} />
                  </div>
                </div>
              ) : null}
              {approvedScore ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {approvedScore.displayed_confidence_range ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Confidence range
                      </div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-ink-900">
                        {approvedScore.displayed_confidence_range}
                      </div>
                      {isFormulationProduct ? (
                        <p className="mt-1 text-xs text-slate-500">Applies to Materials Safety score</p>
                      ) : null}
                    </div>
                  ) : null}
                  {approvedScore.transparency_badge ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Transparency
                      </div>
                      <div className="mt-1.5">
                        <TransparencyBadge badge={approvedScore.transparency_badge} />
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                          {transparencyBadgeSummary(approvedScore.transparency_badge)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {product.description ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-card">
              {product.description}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="divide-y divide-slate-100">
              <SpecRow icon={UtensilsCrossed} label="Category" value={product.category ?? '—'} />
              <SpecRow icon={Package} label="Subcategory" value={product.subcategory ?? '—'} />
              <SpecRow icon={Square} label="Primary Material" value={product.primary_material ?? '—'} />
              <SpecRow
                icon={Leaf}
                label="Secondary Material"
                value={product.secondary_material ?? '—'}
              />
              <SpecRow icon={ShieldCheck} label="BPA Free" value={product.bpa_free ?? '—'} />
              <SpecRow
                icon={FlaskConical}
                label="Phthalate-Free Claim"
                value={product.phthalate_free_claim ?? '—'}
              />
            </div>
          </div>

          <VerifiedCertifications
            certificationNames={verifiedCertifications}
            className="mt-6"
          />

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-card">
            <div className="text-sm font-semibold text-ink-900">Why this score?
            </div>
            {approvedScore?.explanation_draft ? (
              <p className="mt-2 leading-relaxed">{approvedScore.explanation_draft}</p>
            ) : (
              <>
                <p className="mt-2 leading-relaxed">
                  PAC Safety Score reflects expected exposure risk from plastic-associated chemicals,
                  based on materials, construction, and available data. Higher scores indicate less
                  likely chemical exposure during normal use.
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>
                      Scores penalize direct food/liquid contact with plastics, especially under heat,
                      acidity, or fat exposure.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>
                      “Score basis” communicates confidence: lab verification &gt; materials science &gt;
                      AI estimate &gt; testing queue.
                    </span>
                  </li>
                </ul>
              </>
            )}
          </div>

          {(tier === 'Caution' || tier === 'High Risk') && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-ink-900">Safer alternatives</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Higher PAC scores, lower exposure risk.
                  </div>
                </div>
                {product.category && product.subcategory ? (
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
                <div className="mt-3 text-sm text-slate-600">No alternatives found.</div>
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
                      These alternatives have higher PAC Safety Scores and lower expected chemical
                      exposure.
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
        </div>

        <aside className="md:col-span-5">
          <div className="sticky top-20 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="aspect-[4/3] w-full">
                <ProductImage
                  src={product.image_url}
                  name={product.product_name}
                  fit="contain"
                  className="text-xl"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="text-sm font-semibold text-ink-900">{buySectionTitle}</div>
              <p className="mt-1 text-sm text-slate-600">Links open in a new tab.</p>
              {retailerLinks.length > 0 ? (
                <div className="mt-4">
                  <RetailerBuyButtons tier={tier} links={retailerLinks} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No retailer links yet. Add Amazon, Target, or Walmart URLs in Admin.
                </p>
              )}
              {retailerLinks.length > 0 ? (
                <div className="mt-3 text-xs leading-relaxed text-slate-500">
                  FTC disclosure: PACScore may earn a commission if you purchase through affiliate
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

function AlternativeRow({ product }: { product: Product }) {
  const score = product.pac_safety_score ?? 0
  const tier = product.tier ?? tierForScore(score)
  const altLinks = orderedRetailerLinks(product)
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
        {altLinks.length > 0 ? (
          <RetailerBuyButtons tier={tier} links={altLinks} size="compact" />
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

function SpecRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-2.5">
      <div className="flex items-center gap-3">
        <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
          <Icon className="h-3.5 w-3.5 text-emerald-700" />
        </div>
        <div className="text-[13px] font-medium text-slate-600">{label}</div>
      </div>
      <div className="text-right text-[13px] font-semibold text-ink-900">{value}</div>
    </div>
  )
}

