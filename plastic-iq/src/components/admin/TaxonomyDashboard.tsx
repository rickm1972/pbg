import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  archiveManagedCategory,
  archiveManagedSubcategory,
  createManagedCategory,
  createManagedSubcategory,
  loadTaxonomyWithCounts,
  SUBCATEGORY_DEFAULTS_STATUS_LABELS,
  taxonomyStoreErrorMessage,
  updateManagedCategory,
  updateManagedSubcategory,
  type ProductCategoryRow,
  type ProductSubcategoryRow,
  type SubcategoryDefaultsStatus,
} from '../../lib/managedTaxonomy'

type Props = {
  authUserEmail: string | null
  onNotice: (msg: string | null) => void
  onError: (msg: string | null) => void
}

export function TaxonomyDashboard({ authUserEmail, onNotice, onError }: Props) {
  const [showArchived, setShowArchived] = useState(false)
  const [categories, setCategories] = useState<ProductCategoryRow[]>([])
  const [subcategories, setSubcategories] = useState<ProductSubcategoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const data = await loadTaxonomyWithCounts({ includeArchived: showArchived })
      setCategories(data.categories)
      setSubcategories(data.subcategories)
      if (!selectedCategoryId && data.categories[0]) {
        setSelectedCategoryId(data.categories[0].category_id)
      }
    } catch (e: unknown) {
      onError(taxonomyStoreErrorMessage(e, 'Failed to load taxonomy'))
    } finally {
      setLoading(false)
    }
  }, [showArchived, selectedCategoryId, onError])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.category_id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  )

  const categorySubcategories = useMemo(
    () =>
      subcategories
        .filter((s) => s.category_id === selectedCategoryId)
        .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99)),
    [subcategories, selectedCategoryId],
  )

  async function guardAuth() {
    if (!authUserEmail) throw new Error('Sign in with Supabase Auth to manage taxonomy.')
  }

  async function onAddCategory() {
    try {
      await guardAuth()
      const name = newCategoryName.trim()
      if (!name) throw new Error('Category name is required')
      await createManagedCategory(name, categories.length + 1)
      setNewCategoryName('')
      onNotice(`Created category "${name}"`)
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Create category failed')
    }
  }

  async function onAddSubcategory() {
    try {
      await guardAuth()
      if (!selectedCategoryId) throw new Error('Select a category first')
      const name = newSubcategoryName.trim()
      if (!name) throw new Error('Subcategory name is required')
      await createManagedSubcategory({
        category_id: selectedCategoryId,
        name,
        display_order: categorySubcategories.length + 1,
        defaults_status: 'unset',
        defaults_source: 'admin_created',
      })
      setNewSubcategoryName('')
      onNotice(`Created subcategory "${name}"`)
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Create subcategory failed')
    }
  }

  async function onSaveCategory(cat: ProductCategoryRow, name: string) {
    try {
      await guardAuth()
      await updateManagedCategory(cat.category_id, { name: name.trim() })
      setEditingCategoryId(null)
      onNotice('Category updated')
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Update category failed')
    }
  }

  async function onSaveSubcategory(
    sub: ProductSubcategoryRow,
    patch: {
      name: string
      default_severity: string
      default_duration: string
      defaults_status: SubcategoryDefaultsStatus
    },
  ) {
    try {
      await guardAuth()
      const defaults_status = patch.defaults_status
      const default_severity =
        defaults_status === 'complete' && patch.default_severity.trim()
          ? Number(patch.default_severity)
          : null
      const default_duration =
        defaults_status === 'complete' && patch.default_duration.trim()
          ? Number(patch.default_duration)
          : null
      await updateManagedSubcategory(sub.subcategory_id, {
        name: patch.name.trim(),
        default_severity,
        default_duration,
        defaults_status,
      })
      setEditingSubcategoryId(null)
      onNotice('Subcategory updated')
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Update subcategory failed')
    }
  }

  async function onArchiveCategory(cat: ProductCategoryRow) {
    try {
      await guardAuth()
      const count = (cat as ProductCategoryRow & { product_count?: number }).product_count ?? 0
      if (count > 0 && !window.confirm(`Archive "${cat.name}" (${count} products attached)?`)) return
      await archiveManagedCategory(cat.category_id, count > 0 ? 'has_attached_products' : null)
      onNotice(`Archived category "${cat.name}"`)
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Archive category failed')
    }
  }

  async function onArchiveSubcategory(sub: ProductSubcategoryRow) {
    try {
      await guardAuth()
      const count = sub.product_count ?? 0
      if (count > 0 && !window.confirm(`Archive "${sub.name}" (${count} products attached)?`)) return
      await archiveManagedSubcategory(sub.subcategory_id, count > 0 ? 'has_attached_products' : null)
      onNotice(`Archived subcategory "${sub.name}"`)
      await refresh()
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Archive subcategory failed')
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Taxonomy</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage categories, subcategory scoring defaults, and archive inactive taxonomy. Products
            reference IDs — renaming does not orphan rows.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading taxonomy…</p> : null}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="text-sm font-semibold text-ink-900">Categories</div>
          <ul className="mt-3 space-y-2">
            {categories.map((cat) => {
              const count = (cat as ProductCategoryRow & { product_count?: number }).product_count
              const editing = editingCategoryId === cat.category_id
              return (
                <li
                  key={cat.category_id}
                  className={`rounded-xl border px-3 py-2 ${
                    selectedCategoryId === cat.category_id
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedCategoryId(cat.category_id)}
                  >
                    <div className="font-semibold text-ink-900">
                      {cat.name}
                      {cat.is_archived ? (
                        <span className="ml-2 text-xs text-slate-500">(archived)</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">{count ?? 0} products</div>
                  </button>
                  {editing ? (
                    <CategoryEditForm
                      initialName={cat.name}
                      onSave={(name) => onSaveCategory(cat, name)}
                      onCancel={() => setEditingCategoryId(null)}
                    />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-700"
                        onClick={() => setEditingCategoryId(cat.category_id)}
                      >
                        Edit
                      </button>
                      {!cat.is_archived ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700"
                          onClick={() => onArchiveCategory(cat)}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onAddCategory().catch(() => {})}
              className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Add
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="text-sm font-semibold text-ink-900">
            Subcategories {selectedCategory ? `— ${selectedCategory.name}` : ''}
          </div>
          {!selectedCategory ? (
            <p className="mt-3 text-sm text-slate-600">Select a category.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {categorySubcategories.map((sub) => (
                <li key={sub.subcategory_id} className="rounded-xl border border-slate-200 p-3">
                  {editingSubcategoryId === sub.subcategory_id ? (
                    <SubcategoryEditForm
                      sub={sub}
                      onSave={(patch) => onSaveSubcategory(sub, patch)}
                      onCancel={() => setEditingSubcategoryId(null)}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-ink-900">
                            {sub.name}
                            {sub.is_archived ? (
                              <span className="ml-2 text-xs text-slate-500">(archived)</span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {sub.product_count ?? 0} products · Status:{' '}
                            {SUBCATEGORY_DEFAULTS_STATUS_LABELS[sub.defaults_status]}
                            {sub.defaults_status !== 'complete' ? (
                              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                                Warning
                              </span>
                            ) : null}
                          </div>
                          {sub.defaults_status === 'complete' ? (
                            <div className="mt-1 text-xs text-slate-600">
                              Severity {sub.default_severity} / duration {sub.default_duration}
                            </div>
                          ) : null}
                          {sub.registry_key || sub.matrix_key || sub.scoring_assumption_ref ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {sub.registry_key ? `registry: ${sub.registry_key}` : null}
                              {sub.matrix_key ? ` · matrix: ${sub.matrix_key}` : null}
                              {sub.scoring_assumption_ref
                                ? ` · assumption: ${sub.scoring_assumption_ref}`
                                : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-indigo-700"
                            onClick={() => setEditingSubcategoryId(sub.subcategory_id)}
                          >
                            Edit
                          </button>
                          {!sub.is_archived ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-700"
                              onClick={() => onArchiveSubcategory(sub)}
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {selectedCategory ? (
            <div className="mt-4 flex gap-2">
              <input
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="New subcategory name"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => onAddSubcategory().catch(() => {})}
                className="rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Add subcategory
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CategoryEditForm({
  initialName,
  onSave,
  onCancel,
}: {
  initialName: string
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  return (
    <div className="mt-2 flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
      />
      <button
        type="button"
        className="text-xs font-semibold text-indigo-700"
        onClick={() => onSave(name)}
      >
        Save
      </button>
      <button type="button" className="text-xs text-slate-600" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

function SubcategoryEditForm({
  sub,
  onSave,
  onCancel,
}: {
  sub: ProductSubcategoryRow
  onSave: (patch: {
    name: string
    default_severity: string
    default_duration: string
    defaults_status: SubcategoryDefaultsStatus
  }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(sub.name)
  const [defaultsStatus, setDefaultsStatus] = useState<SubcategoryDefaultsStatus>(sub.defaults_status)
  const [severity, setSeverity] = useState(String(sub.default_severity ?? ''))
  const [duration, setDuration] = useState(String(sub.default_duration ?? ''))

  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
      />
      <select
        value={defaultsStatus}
        onChange={(e) => setDefaultsStatus(e.target.value as SubcategoryDefaultsStatus)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm"
      >
        <option value="complete">Complete</option>
        <option value="unset">Unset</option>
        <option value="role_split">Role split</option>
      </select>
      {defaultsStatus === 'complete' ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            placeholder="Severity"
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Duration"
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-indigo-700"
          onClick={() =>
            onSave({
              name,
              default_severity: severity,
              default_duration: duration,
              defaults_status: defaultsStatus,
            })
          }
        >
          Save
        </button>
        <button type="button" className="text-xs text-slate-600" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
