import { useEffect, useMemo, useState } from 'react'
import { Agent1ReviewDashboard } from '../components/admin/Agent1ReviewDashboard'
import { Agent2ReviewDashboard } from '../components/admin/Agent2ReviewDashboard'
import { Agent3ReviewDashboard } from '../components/admin/Agent3ReviewDashboard'
import { Agent4ReviewDashboard } from '../components/admin/Agent4ReviewDashboard'
import { QuizAdminDashboard } from '../components/admin/QuizAdminDashboard'
import { ChannelDashboard } from '../components/admin/ChannelDashboard'
import { PersonaDashboard } from '../components/admin/PersonaDashboard'
import { saveAdminProduct } from '../lib/adminProductSave'
import { formatSupabaseUnknownError, supabase } from '../lib/supabaseClient'
import {
  normalizeProductRow,
  PRODUCT_SELECT_WITH_SCORE,
  type ProductRowWithScoreDetails,
} from '../lib/retailerLinksSidecar'
import type { Product } from '../types'

type AdminTab =
  | 'products'
  | 'agent1'
  | 'agent2'
  | 'agent3'
  | 'agent4'
  | 'quiz'
  | 'personas'
  | 'channels'

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('products')
  const [authorized, setAuthorized] = useState(false)
  const [pw, setPw] = useState('')

  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [products, setProducts] = useState<Product[] | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

  useEffect(() => {
    const ok = localStorage.getItem('pacscore_admin_ok') === '1'
    setAuthorized(ok)
  }, [])

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setAuthUserEmail(data.user?.email ?? null))
      .catch(() => setAuthUserEmail(null))

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserEmail(session?.user?.email ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const canUse = useMemo(() => Boolean(adminPassword && adminPassword.length >= 6), [adminPassword])

  async function loadAll() {
    setError(null)
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_WITH_SCORE)
      .order('date_added', { ascending: false })
      .limit(500)
    if (error) throw error
    setProducts((data as ProductRowWithScoreDetails[]).map(normalizeProductRow))
  }

  useEffect(() => {
    if (!authorized) return
    loadAll().catch((e: unknown) => setError(formatSupabaseUnknownError(e, 'Failed to load')))
  }, [authorized])

  if (!authorized) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Admin</h1>
        <p className="mt-2 text-sm text-slate-700">
          Enter the admin password to access editing tools.
        </p>

        {!canUse ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Set <code className="font-mono">VITE_ADMIN_PASSWORD</code> in your{' '}
            <code className="font-mono">.env</code>.
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!adminPassword) return
            if (pw === adminPassword) {
              localStorage.setItem('pacscore_admin_ok', '1')
              setAuthorized(true)
            } else {
              setError('Incorrect password')
            }
          }}
          className="mt-6 space-y-3"
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white hover:bg-ink-700"
            disabled={!canUse}
          >
            Enter
          </button>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
        </form>
      </div>
    )
  }

  return (
    <div
      className={`mx-auto px-4 py-8 md:px-6 md:py-10 ${tab === 'products' ? 'max-w-6xl' : 'max-w-7xl'}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">Admin</h1>
          <p className="mt-2 text-sm text-slate-700">
            This page is functional (not pretty). Writes require Supabase Auth (authenticated user)
            because the database uses RLS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'products'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('products')}
            >
              Products
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'agent1'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('agent1')}
            >
              Agent 1 review
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'agent2'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('agent2')}
            >
              Agent 2 review
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'agent3'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('agent3')}
            >
              Agent 3 scoring
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'agent4'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('agent4')}
            >
              Agent 4 QA
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'quiz'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('quiz')}
            >
              Quiz
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'personas'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('personas')}
            >
              Personas
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'channels'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('channels')}
            >
              Channels
            </button>
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              localStorage.removeItem('pacscore_admin_ok')
              setAuthorized(false)
            }}
          >
            Lock
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">Supabase Auth</div>
            <div className="mt-1 text-xs text-slate-600">
              Writes require you to be signed in (database RLS).
            </div>
          </div>
          {authUserEmail ? (
            <button
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              onClick={async () => {
                setError(null)
                setMessage(null)
                try {
                  await supabase.auth.signOut()
                  setMessage('Signed out')
                } catch (e: unknown) {
                  setError(formatSupabaseUnknownError(e, 'Sign out failed'))
                }
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>

        {authUserEmail ? (
          <div className="mt-3 text-sm text-slate-700">
            Signed in as <span className="font-semibold text-ink-900">{authUserEmail}</span>
          </div>
        ) : (
          <form
            className="mt-4 grid gap-3 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault()
              setAuthLoading(true)
              setError(null)
              setMessage(null)
              supabase.auth
                .signInWithPassword({ email: authEmail, password: authPassword })
                .then(({ error }) => {
                  if (error) throw error
                  setMessage('Signed in')
                })
                .catch((e: unknown) => {
                  setError(formatSupabaseUnknownError(e, 'Sign in failed'))
                })
                .finally(() => setAuthLoading(false))
            }}
          >
            <label className="block">
              <div className="text-xs font-semibold text-slate-600">Email</div>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@domain.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-600">Password</div>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
                disabled={authLoading || !authEmail || !authPassword}
              >
                {authLoading ? 'Signing in…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={authLoading || !authEmail || !authPassword}
                onClick={async () => {
                  setAuthLoading(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const { error } = await supabase.auth.signUp({
                      email: authEmail,
                      password: authPassword,
                    })
                    if (error) throw error
                    setMessage(
                      'Account created. If email confirmations are enabled, check your email to confirm before signing in.',
                    )
                  } catch (e: unknown) {
                    setError(formatSupabaseUnknownError(e, 'Sign up failed'))
                  } finally {
                    setAuthLoading(false)
                  }
                }}
              >
                Sign up
              </button>
            </div>
          </form>
        )}
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {tab === 'agent1' ? (
        <Agent1ReviewDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'agent2' ? (
        <Agent2ReviewDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'agent3' ? (
        <Agent3ReviewDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'agent4' ? (
        <Agent4ReviewDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'quiz' ? (
        <QuizAdminDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'personas' ? (
        <PersonaDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'channels' ? (
        <ChannelDashboard
          authUserEmail={authUserEmail}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'products' ? (
      <div className="mt-6 grid gap-4 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink-900">Products</div>
              <button
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => {
                  setSelected({
                    product_id: '',
                    product_name: '',
                    brand: null,
                    category: 'Kitchen',
                    subcategory: null,
                    description: null,
                    pac_safety_score: 0,
                    tier: 'Good',
                    score_basis: 'Based on Materials Science',
                    primary_material: null,
                    secondary_material: null,
                    bpa_free: 'Unknown',
                    phthalate_free_claim: 'Unknown',
                    amazon_asin: null,
                    amazon_url: null,
                    affiliate_link: null,
                    target_url: null,
                    walmart_url: null,
                    other_retailer_label: null,
                    other_retailer_url: null,
                    image_url: null,
                    date_added: new Date().toISOString(),
                    date_last_updated: new Date().toISOString(),
                    active: true,
                  })
                }}
              >
                + New
              </button>
            </div>
            {!products ? (
              <div className="mt-4 text-sm text-slate-600">Loading…</div>
            ) : (
              <div className="mt-4 max-h-[70dvh] overflow-auto">
                <ul className="space-y-2">
                  {products.map((p) => (
                    <li key={p.product_id}>
                      <button
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => setSelected(p)}
                      >
                        <div className="font-semibold text-ink-900">{p.product_name}</div>
                        <div className="text-xs text-slate-600">
                          {p.brand ?? '—'} • {p.pac_safety_score ?? '—'} • {p.tier ?? '—'}{' '}
                          {p.active ? '' : '(inactive)'}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="text-sm font-semibold text-ink-900">Editor</div>
            {!selected ? (
              <div className="mt-4 text-sm text-slate-600">Select a product to edit.</div>
            ) : (
              <ProductEditor
                product={selected}
                onChange={setSelected}
                onSave={async (p) => {
                  setLoading(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const { data: userData } = await supabase.auth.getUser()
                    if (!userData.user) {
                      throw new Error('Not signed in. Sign in above to save changes.')
                    }
                    if (!p.product_name.trim()) throw new Error('Product name is required')
                    if (!p.category) throw new Error('Category is required')
                    if (!p.tier) throw new Error('Tier is required')
                    if (!p.score_basis) throw new Error('Score basis is required')

                    const { product, message: saveMsg } = await saveAdminProduct(p)
                    setSelected(product)
                    setMessage(saveMsg)
                    await loadAll()
                  } catch (e: unknown) {
                    let msg = formatSupabaseUnknownError(e, 'Save failed')
                    if (/schema cache/i.test(msg) && /products/i.test(msg)) {
                      msg +=
                        ' If this persists, run npm run db:repair (needs SUPABASE_DB_PASSWORD in .env) or apply supabase/migrations/0006_ensure_product_retailer_columns.sql.'
                    }
                    setError(msg)
                  } finally {
                    setLoading(false)
                  }
                }}
                saving={loading}
              />
            )}
          </div>
        </div>
      </div>
      ) : null}
    </div>
  )
}

function ProductEditor({
  product,
  onChange,
  onSave,
  saving,
}: {
  product: Product
  onChange: (p: Product) => void
  onSave: (p: Product) => Promise<void>
  saving: boolean
}) {
  function set<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...product, [key]: value })
  }

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(product).catch(() => {})
      }}
    >
      <Field label="Product name" required>
        <input
          value={product.product_name}
          onChange={(e) => set('product_name', e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Brand">
          <input
            value={product.brand ?? ''}
            onChange={(e) => set('brand', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category" required>
          <select
            value={product.category ?? ''}
            onChange={(e) => set('category', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="Kitchen">Kitchen</option>
            <option value="Personal Care">Personal Care</option>
            <option value="Home">Home</option>
            <option value="Food and Beverage">Food and Beverage</option>
            <option value="Fitness and Sports">Fitness and Sports</option>
          </select>
        </Field>
      </div>

      <Field label="Subcategory">
        <input
          value={product.subcategory ?? ''}
          onChange={(e) => set('subcategory', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="PAC Safety Score" required>
        <input
          inputMode="numeric"
          value={String(product.pac_safety_score ?? 0)}
          onChange={(e) => set('pac_safety_score', Number(e.target.value))}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tier" required>
          <select
            value={product.tier ?? ''}
            onChange={(e) => set('tier', (e.target.value as Product['tier']) || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="Excellent">Excellent</option>
            <option value="Good">Good</option>
            <option value="Caution">Caution</option>
            <option value="Concern">Concern</option>
            <option value="High Risk">High Risk</option>
          </select>
        </Field>
        <Field label="Score basis" required>
          <select
            value={product.score_basis ?? ''}
            onChange={(e) => set('score_basis', (e.target.value as Product['score_basis']) || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="Lab Verified">Lab Verified</option>
            <option value="Based on Materials Science">Based on Materials Science</option>
            <option value="AI Estimated">AI Estimated</option>
            <option value="In Testing Queue">In Testing Queue</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Primary material">
          <input
            value={product.primary_material ?? ''}
            onChange={(e) => set('primary_material', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Secondary material">
          <input
            value={product.secondary_material ?? ''}
            onChange={(e) => set('secondary_material', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="BPA free">
          <select
            value={product.bpa_free ?? ''}
            onChange={(e) => set('bpa_free', (e.target.value as Product['bpa_free']) || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Unknown">Unknown</option>
          </select>
        </Field>
        <Field label="Phthalate free claim">
          <select
            value={product.phthalate_free_claim ?? ''}
            onChange={(e) =>
              set('phthalate_free_claim', (e.target.value as Product['phthalate_free_claim']) || null)
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="Unknown">Unknown</option>
          </select>
        </Field>
      </div>

      <Field label="Amazon product URL">
        <input
          value={product.amazon_url ?? ''}
          onChange={(e) => set('amazon_url', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Amazon affiliate URL (optional)">
        <input
          value={product.affiliate_link ?? ''}
          onChange={(e) => set('affiliate_link', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Target URL (optional)">
        <input
          value={product.target_url ?? ''}
          onChange={(e) => set('target_url', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Walmart URL (optional)">
        <input
          value={product.walmart_url ?? ''}
          onChange={(e) => set('walmart_url', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <p className="text-xs leading-relaxed text-slate-600">
        Values above reflect what the storefront shows (including built-in catalog defaults for
        Target/Walmart when the database is empty). Saving writes these fields to Supabase.
      </p>
      <Field label="Other retailer name (optional)">
        <input
          value={product.other_retailer_label ?? ''}
          onChange={(e) => set('other_retailer_label', e.target.value || null)}
          placeholder="e.g. Williams Sonoma"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Other retailer URL (optional)">
        <input
          value={product.other_retailer_url ?? ''}
          onChange={(e) => set('other_retailer_url', e.target.value || null)}
          placeholder="Product page at that retailer"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Image URL">
        <input
          value={product.image_url ?? ''}
          onChange={(e) => set('image_url', e.target.value || null)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={product.description ?? ''}
          onChange={(e) => set('description', e.target.value || null)}
          rows={6}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={product.active}
          onChange={(e) => set('active', e.target.checked)}
        />
        Active
      </label>

      <button
        type="submit"
        className="mt-2 inline-flex items-center justify-center rounded-2xl bg-ink-900 px-4 py-3 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-60"
        disabled={saving}
      >
        {saving ? 'Saving…' : product.product_id ? 'Save changes' : 'Create product'}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  )
}

