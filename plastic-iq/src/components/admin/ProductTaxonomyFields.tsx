import { useEffect, useMemo, useState } from 'react'
import {
  evaluateSubcategoryScoringReadiness,
  loadManagedCategories,
  loadManagedSubcategories,
  subcategoryDefaultsWarning,
  SUBCATEGORY_DEFAULTS_STATUS_LABELS,
  type ProductCategoryRow,
  type ProductSubcategoryRow,
} from '../../lib/managedTaxonomy'
import { formatSupabaseUnknownError } from '../../lib/supabaseClient'
import type { Product } from '../../types'

type Props = {
  product: Product
  onChange: (patch: Partial<Product>) => void
}

export function ProductTaxonomyFields({ product, onChange }: Props) {
  const [categories, setCategories] = useState<ProductCategoryRow[] | null>(null)
  const [subcategories, setSubcategories] = useState<ProductSubcategoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadManagedCategories()
      .then(setCategories)
      .catch((e: unknown) => setError(formatSupabaseUnknownError(e, 'Failed to load categories')))
  }, [])

  useEffect(() => {
    if (!product.category_id) {
      setSubcategories([])
      return
    }
    loadManagedSubcategories({ categoryId: product.category_id })
      .then(setSubcategories)
      .catch((e: unknown) =>
        setError(formatSupabaseUnknownError(e, 'Failed to load subcategories')),
      )
  }, [product.category_id])

  const selectedSubcategory = useMemo(
    () => subcategories?.find((s) => s.subcategory_id === product.subcategory_id) ?? null,
    [subcategories, product.subcategory_id],
  )

  const readiness = evaluateSubcategoryScoringReadiness(selectedSubcategory)
  const defaultsNotice = subcategoryDefaultsWarning(selectedSubcategory?.defaults_status)

  function onCategoryChange(categoryId: string) {
    const cat = categories?.find((c) => c.category_id === categoryId) ?? null
    onChange({
      category_id: categoryId || null,
      category: cat?.name ?? null,
      subcategory_id: null,
      subcategory: null,
    })
  }

  function onSubcategoryChange(subcategoryId: string) {
    const sub = subcategories?.find((s) => s.subcategory_id === subcategoryId) ?? null
    onChange({
      subcategory_id: subcategoryId || null,
      subcategory: sub?.name ?? null,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <div className="text-xs font-semibold text-slate-600">
            Category <span className="text-red-600">*</span>
          </div>
          <select
            value={product.category_id ?? ''}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            required
          >
            <option value="">Select category…</option>
            {(categories ?? []).map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-600">
            Subcategory <span className="text-red-600">*</span>
          </div>
          <select
            value={product.subcategory_id ?? ''}
            onChange={(e) => onSubcategoryChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            required
            disabled={!product.category_id}
          >
            <option value="">Select subcategory…</option>
            {(subcategories ?? []).map((s) => (
              <option key={s.subcategory_id} value={s.subcategory_id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {product.category && product.subcategory && !product.category_id ? (
        <p className="text-xs text-amber-800">
          Legacy text taxonomy: {product.category} / {product.subcategory}. Select managed taxonomy
          rows above to enable FK-backed intake.
        </p>
      ) : null}

      {selectedSubcategory ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
          <div>
            Defaults status:{' '}
            <span className="font-semibold">
              {SUBCATEGORY_DEFAULTS_STATUS_LABELS[selectedSubcategory.defaults_status]}
            </span>
            {selectedSubcategory.defaults_status !== 'complete' ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                Review required
              </span>
            ) : null}
          </div>
          {selectedSubcategory.defaults_status === 'complete' ? (
            <div>
              Severity {selectedSubcategory.default_severity} / duration{' '}
              {selectedSubcategory.default_duration}
            </div>
          ) : null}
          {selectedSubcategory.registry_key ? (
            <div className="text-slate-500">Registry: {selectedSubcategory.registry_key}</div>
          ) : null}
        </div>
      ) : null}

      {defaultsNotice ? (
        <div
          className={`rounded-xl border p-3 text-xs ${
            selectedSubcategory?.defaults_status === 'unset'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {defaultsNotice}
        </div>
      ) : null}

      {!readiness.scoring_ready && selectedSubcategory ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          Scoring readiness blocked for this subcategory. Resolve taxonomy defaults or material path
          before running agents.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  )
}
