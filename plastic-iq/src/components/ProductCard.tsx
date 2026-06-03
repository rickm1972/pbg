import { Link } from 'react-router-dom'
import type { Product } from '../types'
import { hasPublicDisplayScore } from '../lib/publicProductDisplay'
import { tierForScore } from '../lib/score'
import { ScoreMark } from './ScoreMark'
import { ProductImage } from './ProductImage'

export function ProductCard({ product }: { product: Product }) {
  if (!hasPublicDisplayScore(product)) return null

  const score = product.pac_safety_score as number
  const tier = product.tier ?? tierForScore(score)

  return (
    <Link
      to={`/product/${product.product_id}`}
      className="group block rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex gap-4 p-4">
        <ScoreMark score={score} tier={tier} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink-900">
                {product.product_name}
              </div>
              <div className="truncate text-sm text-slate-600">{product.brand ?? '—'}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-600">{tier}</span>
            <span className="text-xs font-medium text-slate-600">
              {product.category}
              {product.subcategory ? ` • ${product.subcategory}` : ''}
            </span>
          </div>
        </div>

        <div className="h-16 w-16 flex-none overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
          <ProductImage src={product.image_url} name={product.product_name} fit="contain" />
        </div>
      </div>

      {product.description ? (
        <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700 line-clamp-3">
          {product.description}
        </div>
      ) : null}
    </Link>
  )
}

