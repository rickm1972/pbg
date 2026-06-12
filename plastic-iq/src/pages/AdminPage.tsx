import { useEffect, useMemo, useState } from 'react'
import { Agent1ReviewDashboard } from '../components/admin/Agent1ReviewDashboard'
import { Agent2ReviewDashboard } from '../components/admin/Agent2ReviewDashboard'
import { Agent3ReviewDashboard } from '../components/admin/Agent3ReviewDashboard'
import { Agent4ReviewDashboard } from '../components/admin/Agent4ReviewDashboard'
import { BatchPublishDashboard } from '../components/admin/BatchPublishDashboard'
import { LockedSnapshotDraftDashboard } from '../components/admin/LockedSnapshotDraftDashboard'
import { consumePipelineFocus } from '../lib/adminPipelineNav'
import { QuizAdminDashboard } from '../components/admin/QuizAdminDashboard'
import { ChannelDashboard } from '../components/admin/ChannelDashboard'
import { PersonaDashboard } from '../components/admin/PersonaDashboard'
import { ProductClaimIntakeFields } from '../components/admin/ProductClaimIntakeFields'
import { ProductTaxonomyFields } from '../components/admin/ProductTaxonomyFields'
import { TaxonomyDashboard } from '../components/admin/TaxonomyDashboard'
import { PublicDescriptionOverridePanel } from '../components/admin/PublicDescriptionOverridePanel'
import {
  ADMIN_PIPELINE_READONLY_FIELDS,
  formatAdminReadOnlyFieldValue,
} from '../lib/adminProductEditor'
import { saveAdminProduct } from '../lib/adminProductSave'
import { SIMPLE_PRODUCT_INTAKE_FIELDS } from '../lib/simpleProductIntake'
import { formatSupabaseUnknownError, supabase } from '../lib/supabaseClient'
import {
  normalizeProductRow,
  PRODUCT_SELECT_WITH_SCORE,
  type ProductRowWithScoreDetails,
} from '../lib/retailerLinksSidecar'
import { KITCHEN_CATEGORY_ID } from '../lib/managedTaxonomy/seedIds'
import { emptyClaimIntakeMap, type ClaimIntakeMap } from '../lib/productClaimIntake'
import {
  buildClaimIntakeFromProduct,
  loadProductClaimIntake,
} from '../lib/productClaimIntakeStore'
import type { Product } from '../types'

type AdminTab =
  | 'products'
  | 'taxonomy'
  | 'agent1'
  | 'agent2'
  | 'agent3'
  | 'agent4'
  | 'publish'
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
  const [pipelineFocusProductId, setPipelineFocusProductId] = useState<string | null>(null)
  const [editorClaims, setEditorClaims] = useState<ClaimIntakeMap>(emptyClaimIntakeMap())

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

  function navigateToGate(gateTab: 'agent1' | 'agent2' | 'agent3', productId: string) {
    setPipelineFocusProductId(productId)
    setTab(gateTab)
  }

  useEffect(() => {
    const ok = localStorage.getItem('pacscore_admin_ok') === '1'
    setAuthorized(ok)
    const focus = consumePipelineFocus()
    if (focus) {
      setTab(focus.tab === 'publish' ? 'publish' : focus.tab)
      setPipelineFocusProductId(focus.productId)
    }
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
      .or('is_archived.is.null,is_archived.eq.false')
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
                tab === 'taxonomy'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => setTab('taxonomy')}
            >
              Taxonomy
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
                tab === 'publish'
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-slate-600 hover:text-ink-900'
              }`}
              onClick={() => {
                setTab('publish')
                setPipelineFocusProductId(null)
              }}
            >
              Publish (Gate 4)
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
          initialProductId={pipelineFocusProductId}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'agent2' ? (
        <Agent2ReviewDashboard
          authUserEmail={authUserEmail}
          initialProductId={pipelineFocusProductId}
          onNavigateToGate={navigateToGate}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'agent3' ? (
        <Agent3ReviewDashboard
          authUserEmail={authUserEmail}
          initialProductId={pipelineFocusProductId}
          onNavigateToGate={navigateToGate}
          onNotice={setMessage}
          onError={setError}
        />
      ) : null}

      {tab === 'publish' ? (
        <>
          <BatchPublishDashboard onNotice={setMessage} onError={setError} />
          <LockedSnapshotDraftDashboard
            authUserEmail={authUserEmail}
            onNotice={setMessage}
            onError={setError}
          />
        </>
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

      {tab === 'taxonomy' ? (
        <TaxonomyDashboard
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
                  const claims = emptyClaimIntakeMap()
                  setEditorClaims(claims)
                  setSelected({
                    product_id: '',
                    product_name: '',
                    brand: null,
                    category_id: KITCHEN_CATEGORY_ID,
                    subcategory_id: null,
                    category: 'Kitchen',
                    subcategory: null,
                    description: null,
                    pac_safety_score: null,
                    tier: null,
                    score_basis: null,
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
                    manufacturer_product_url: null,
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
                        onClick={() => {
                          setSelected(p)
                          if (p.product_id) {
                            loadProductClaimIntake(p.product_id)
                              .then(setEditorClaims)
                              .catch(() => setEditorClaims(buildClaimIntakeFromProduct(p)))
                          } else {
                            setEditorClaims(buildClaimIntakeFromProduct(p))
                          }
                        }}
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
                claimIntake={editorClaims}
                onClaimIntakeChange={setEditorClaims}
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
                    if (!p.category_id) throw new Error('Managed category is required')
                    if (!p.subcategory_id) throw new Error('Managed subcategory is required')

                    const { product, message: saveMsg } = await saveAdminProduct(p, {
                      claimIntake: editorClaims,
                    })
                    setSelected(product)
                    setMessage(saveMsg)
                    await loadAll()
                  } catch (e: unknown) {
                    let msg = formatSupabaseUnknownError(e, 'Save failed')
                    if (/schema cache/i.test(msg) && /products/i.test(msg)) {
                      msg +=
                        ' If this persists, run npm run db:repair (needs SUPABASE_DB_PASSWORD in .env) or apply supabase/migrations/0040_product_source_intake.sql.'
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
  claimIntake,
  onClaimIntakeChange,
  onSave,
  saving,
}: {
  product: Product
  onChange: (p: Product) => void
  claimIntake: ClaimIntakeMap
  onClaimIntakeChange: (claims: ClaimIntakeMap) => void
  onSave: (p: Product) => Promise<void>
  saving: boolean
}) {
  function set<K extends keyof Product>(key: K, value: Product[K]) {
    onChange({ ...product, [key]: value })
  }

  function setClaim(claimType: keyof ClaimIntakeMap, value: ClaimIntakeMap[keyof ClaimIntakeMap]) {
    onClaimIntakeChange({ ...claimIntake, [claimType]: value })
  }

  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(product).catch(() => {})
      }}
    >
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
            Product intake (before Agent 1)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-950">
            Enter the product title and two URLs Agent 1 cannot reliably discover on its own. Save
            before running Agent 1 on the Agent 1 tab.
          </p>
        </div>
        {SIMPLE_PRODUCT_INTAKE_FIELDS.map((field) => (
          <Field key={field.key} label={field.label} required={field.key === 'product_name'}>
            <input
              value={(product[field.key] as string | null) ?? ''}
              onChange={(e) =>
                set(field.key, (e.target.value || null) as Product[typeof field.key])
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            {field.helper ? (
              <p className="mt-1 text-xs leading-relaxed text-indigo-900">{field.helper}</p>
            ) : null}
          </Field>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Brand">
          <input
            value={product.brand ?? ''}
            onChange={(e) => set('brand', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <ProductTaxonomyFields product={product} onChange={(patch) => onChange({ ...product, ...patch })} />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pipeline-owned (read-only)
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          These values come from approved pipeline gates. To change them, rerun and approve the
          relevant agent — do not edit here.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ADMIN_PIPELINE_READONLY_FIELDS.map((field) => (
            <ReadOnlyField
              key={field.key}
              label={field.label}
              hint={field.hint}
              value={formatAdminReadOnlyFieldValue(field.key, product)}
            />
          ))}
        </div>
      </div>

      <ProductClaimIntakeFields claims={claimIntake} onChange={setClaim} />

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Commerce / buy links</p>
      <p className="text-xs leading-relaxed text-slate-600">
        Affiliate and secondary retailer links for public buy buttons. The Amazon or primary retailer URL
        above is used by Agent 1 for evidence — affiliate links are commerce-only.
      </p>
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

      {product.product_id ? (
        <PublicDescriptionOverridePanel productId={product.product_id} reviewerId="admin-editor" />
      ) : null}

      <Field label="Legacy listing description">
        <textarea
          value={product.description ?? ''}
          onChange={(e) => set('description', e.target.value || null)}
          rows={6}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Legacy listing text (`products.description`) for browse cards only. Product detail pages
          use the approved frozen display snapshot — not this field.
        </p>
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

function ReadOnlyField({
  label,
  hint,
  value,
}: {
  label: string
  hint: string
  value: string
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div
        className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink-900"
        aria-readonly="true"
      >
        {value}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  )
}

