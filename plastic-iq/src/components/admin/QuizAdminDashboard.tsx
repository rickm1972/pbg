import { useEffect, useMemo, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { formatSupabaseUnknownError, supabase } from '../../lib/supabaseClient'
import { cn } from '../../lib/cn'
import { AWARENESS_QUESTIONS, SCORED_QUESTIONS } from '../../quiz/quizModel'

type QuizResponseRow = {
  response_id: string
  created_at: string
  completed_at: string | null
  first_name: string | null
  user_email: string | null
  final_score: number | null
  letter_grade: string | null
  tier: string | null
  scored_answers: Record<string, unknown> | null
  awareness_answers: Record<string, unknown> | null
  motivation_answers: Record<string, unknown> | null
}

type Filters = {
  createdFrom: string
  createdTo: string
  scoreMin: string
  scoreMax: string
  grades: Set<string>
  hasKids: 'all' | 'yes' | 'no'
  wouldBuy: 'all' | 'Yes' | 'No' | 'Maybe'
  completedOnly: boolean
}

const DEFAULT_FILTERS: Filters = {
  createdFrom: '',
  createdTo: '',
  scoreMin: '',
  scoreMax: '',
  grades: new Set<string>(),
  hasKids: 'all',
  wouldBuy: 'all',
  completedOnly: false,
}

function shortId(uuid: string): string {
  const clean = String(uuid || '').replace(/-/g, '')
  return clean.slice(-6) || uuid
}

function asBool(v: unknown): boolean | null {
  if (v === true) return true
  if (v === false) return false
  return null
}

function motivationText(row: QuizResponseRow, key: string): string | null {
  const obj = row.motivation_answers ?? {}
  const v = (obj as Record<string, unknown>)[key]
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function answerYesRate(rows: QuizResponseRow[], blobKey: 'scored_answers' | 'awareness_answers', qId: string): number {
  const answered = rows
    .map((r) => (r[blobKey] ?? {}) as Record<string, unknown>)
    .map((obj) => asBool(obj[qId]))
    .filter((v): v is boolean => v !== null)
  if (!answered.length) return 0
  const yes = answered.filter((v) => v === true).length
  return yes / answered.length
}

function median(nums: number[]): number | null {
  const n = nums.length
  if (!n) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function toCsv(rows: QuizResponseRow[]): string {
  const header = [
    'response_id',
    'created_at',
    'completed_at',
    'first_name',
    'user_email',
    'final_score',
    'letter_grade',
    'tier',
    // scored q1-q14
    ...Array.from({ length: 14 }, (_, i) => `q${i + 1}`),
    // awareness q15-q17
    'q15',
    'q16',
    'q17',
    // motivation
    'q18',
    'q18b',
    'q19',
    'q20',
    'q21',
  ]

  function esc(v: unknown): string {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const lines = [header.join(',')]
  for (const r of rows) {
    const scored = (r.scored_answers ?? {}) as Record<string, unknown>
    const aware = (r.awareness_answers ?? {}) as Record<string, unknown>
    const mot = (r.motivation_answers ?? {}) as Record<string, unknown>

    const line = [
      r.response_id,
      r.created_at,
      r.completed_at ?? '',
      r.first_name ?? '',
      r.user_email ?? '',
      r.final_score ?? '',
      r.letter_grade ?? '',
      r.tier ?? '',
      ...Array.from({ length: 14 }, (_, i) => {
        const v = asBool(scored[`q${i + 1}`])
        return v === null ? '' : v ? 'Yes' : 'No'
      }),
      ...(['q15', 'q16', 'q17'] as const).map((k) => {
        const v = asBool(aware[k])
        return v === null ? '' : v ? 'Yes' : 'No'
      }),
      ...(['q18', 'q18b', 'q19', 'q20', 'q21'] as const).map((k) => {
        const v = mot[k]
        return v == null ? '' : String(v)
      }),
    ]
    lines.push(line.map(esc).join(','))
  }
  return lines.join('\n')
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function gradeTierLabel(grade: string): { range: string } {
  if (grade === 'A') return { range: '90–100' }
  if (grade === 'B') return { range: '75–89' }
  if (grade === 'C') return { range: '55–74' }
  if (grade === 'D') return { range: '30–54' }
  return { range: '17–29' }
}

export function QuizAdminDashboard({
  authUserEmail,
  onNotice,
  onError,
}: {
  authUserEmail: string | null
  onNotice: (m: string) => void
  onError: (m: string) => void
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [rows, setRows] = useState<QuizResponseRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<null | { mode: 'row' | 'bulk' | 'filtered'; ids: string[] }>(null)

  async function load() {
    if (!authUserEmail) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      let q = supabase
        .from('quiz_responses')
        .select(
          'response_id,created_at,completed_at,first_name,user_email,final_score,letter_grade,tier,scored_answers,awareness_answers,motivation_answers',
        )
        .order('created_at', { ascending: false })

      if (filters.createdFrom) q = q.gte('created_at', filters.createdFrom)
      if (filters.createdTo) q = q.lte('created_at', filters.createdTo)
      if (filters.scoreMin) q = q.gte('final_score', Number(filters.scoreMin))
      if (filters.scoreMax) q = q.lte('final_score', Number(filters.scoreMax))
      if (filters.completedOnly) q = q.not('completed_at', 'is', null)
      if (filters.grades.size > 0) q = q.in('letter_grade', Array.from(filters.grades))

      // JSONB filters (PostgREST): column->>key
      if (filters.hasKids === 'yes') q = q.filter('motivation_answers->>q18', 'eq', 'Yes')
      if (filters.hasKids === 'no') q = q.filter('motivation_answers->>q18', 'eq', 'No')
      if (filters.wouldBuy !== 'all') q = q.filter('motivation_answers->>q21', 'eq', filters.wouldBuy)

      const { data, error } = await q.limit(5000)
      if (error) throw error
      setRows((data ?? []) as QuizResponseRow[])
      setSelected(new Set())
      setExpanded(new Set())
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Failed to load quiz responses'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserEmail])

  // Filters apply to metrics too, so refetch on change.
  useEffect(() => {
    const t = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authUserEmail,
    filters.createdFrom,
    filters.createdTo,
    filters.scoreMin,
    filters.scoreMax,
    filters.completedOnly,
    Array.from(filters.grades).join(','),
    filters.hasKids,
    filters.wouldBuy,
  ])

  const metrics = useMemo(() => {
    const list = rows ?? []
    const total = list.length
    const completed = list.filter((r) => r.completed_at).length
    const email = list.filter((r) => r.user_email && r.user_email.trim()).length
    const completedScores = list
      .map((r) => r.final_score)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))

    const avg =
      completedScores.length > 0
        ? completedScores.reduce((a, b) => a + b, 0) / completedScores.length
        : null
    const med = median(completedScores)

    return {
      total,
      completionRate: total ? completed / total : 0,
      emailRate: total ? email / total : 0,
      avgScore: avg,
      medianScore: med,
    }
  }, [rows])

  const tierCounts = useMemo(() => {
    const list = rows ?? []
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    for (const r of list) {
      const g = (r.letter_grade ?? '').trim().toUpperCase()
      if (g in counts) counts[g]++
    }
    return counts
  }, [rows])

  const voc = useMemo(() => {
    const list = rows ?? []

    const combos: Record<string, number> = {}
    let moved = 0
    let movedDenom = 0

    for (const r of list) {
      const pre = motivationText(r, 'q19')
      const post = motivationText(r, 'q20')
      if (pre && post) {
        const key = `${pre} → ${post}`
        combos[key] = (combos[key] ?? 0) + 1
        const preIsLow = pre === 'Not concerned' || pre === 'Somewhat concerned'
        if (preIsLow) {
          movedDenom++
          if (post === 'More concerned') moved++
        }
      }
    }

    const wouldBuyCounts: Record<string, number> = { Yes: 0, No: 0, Maybe: 0 }
    for (const r of list) {
      const v = motivationText(r, 'q21')
      if (v && v in wouldBuyCounts) wouldBuyCounts[v]++
    }

    const kidsCounts: Record<string, number> = { Yes: 0, No: 0 }
    const kidAges: Record<string, number> = { 'Under 5': 0, '5-12': 0, Both: 0 }
    for (const r of list) {
      const k = motivationText(r, 'q18')
      if (k === 'Yes') {
        kidsCounts.Yes++
        const age = motivationText(r, 'q18b')
        if (age && age in kidAges) kidAges[age]++
      } else if (k === 'No') {
        kidsCounts.No++
      }
    }

    return {
      concernCombos: combos,
      movedMoreConcernedPct: movedDenom ? moved / movedDenom : 0,
      wouldBuyCounts,
      kidsCounts,
      kidAges,
    }
  }, [rows])

  const questionStats = useMemo(() => {
    const list = rows ?? []
    const scored = SCORED_QUESTIONS.map((q) => ({
      id: q.id,
      label: q.id.toUpperCase(),
      text: q.text,
      yesRate: answerYesRate(list, 'scored_answers', q.id),
    })).sort((a, b) => b.yesRate - a.yesRate)

    const awareness = AWARENESS_QUESTIONS.map((q) => ({
      id: q.id,
      label: q.id.toUpperCase(),
      text: q.text,
      yesRate: answerYesRate(list, 'awareness_answers', q.id),
    }))

    return { scored, awareness }
  }, [rows])

  async function deleteIds(ids: string[]) {
    if (!authUserEmail) {
      onError('Sign in with Supabase Auth to delete.')
      return
    }
    if (ids.length === 0) return
    try {
      const { error } = await supabase.from('quiz_responses').delete().in('response_id', ids)
      if (error) throw error
      onNotice(`Deleted ${ids.length} response${ids.length === 1 ? '' : 's'}.`)
      setConfirm(null)
      await load()
    } catch (e: unknown) {
      onError(formatSupabaseUnknownError(e, 'Delete failed'))
    }
  }

  const hasSelection = selected.size > 0
  const selectedIds = Array.from(selected)

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">Quiz responses</div>
            <div className="mt-1 text-xs text-slate-600">
              Filters apply to metrics, distribution, insights, and the response table.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                if (!rows) return
                const csv = toCsv(rows)
                download(`quiz_responses_${new Date().toISOString().slice(0, 10)}.csv`, csv)
              }}
              disabled={!rows || rows.length === 0}
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
              onClick={() => setConfirm({ mode: 'filtered', ids: (rows ?? []).map((r) => r.response_id) })}
              disabled={!rows || rows.length === 0}
              title="Delete all currently filtered rows"
            >
              <Trash2 className="h-4 w-4" />
              Delete all filtered ({rows?.length ?? 0})
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-12">
          <label className="md:col-span-3">
            <div className="text-xs font-semibold text-slate-600">Created from</div>
            <input
              type="datetime-local"
              value={filters.createdFrom}
              onChange={(e) => setFilters((f) => ({ ...f, createdFrom: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-3">
            <div className="text-xs font-semibold text-slate-600">Created to</div>
            <input
              type="datetime-local"
              value={filters.createdTo}
              onChange={(e) => setFilters((f) => ({ ...f, createdTo: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-600">Score min</div>
            <input
              inputMode="numeric"
              value={filters.scoreMin}
              onChange={(e) => setFilters((f) => ({ ...f, scoreMin: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-600">Score max</div>
            <input
              inputMode="numeric"
              value={filters.scoreMax}
              onChange={(e) => setFilters((f) => ({ ...f, scoreMax: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-600">Completed only</div>
            <div className="mt-1 flex h-[2.5rem] items-center gap-2 rounded-xl border border-slate-200 px-3">
              <input
                type="checkbox"
                checked={filters.completedOnly}
                onChange={(e) => setFilters((f) => ({ ...f, completedOnly: e.target.checked }))}
              />
              <span className="text-sm text-slate-700">Yes</span>
            </div>
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="text-xs font-semibold text-slate-600">Letter grade</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => {
                const on = filters.grades.has(g)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setFilters((f) => {
                        const next = new Set(f.grades)
                        if (next.has(g)) next.delete(g)
                        else next.add(g)
                        return { ...f, grades: next }
                      })
                    }
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs font-semibold',
                      on
                        ? 'border-ink-900 bg-ink-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {g}
                  </button>
                )
              })}
              {filters.grades.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, grades: new Set() }))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <label className="md:col-span-4">
            <div className="text-xs font-semibold text-slate-600">Has kids</div>
            <select
              value={filters.hasKids}
              onChange={(e) => setFilters((f) => ({ ...f, hasKids: e.target.value as Filters['hasKids'] }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          <label className="md:col-span-4">
            <div className="text-xs font-semibold text-slate-600">Would buy safer</div>
            <select
              value={filters.wouldBuy}
              onChange={(e) => setFilters((f) => ({ ...f, wouldBuy: e.target.value as Filters['wouldBuy'] }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Maybe">Maybe</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-12">
        <SummaryCard className="md:col-span-3" title="Total responses" value={metrics.total.toLocaleString()} />
        <SummaryCard
          className="md:col-span-3"
          title="Completion rate"
          value={`${Math.round(metrics.completionRate * 100)}%`}
          subtitle={`${metrics.total ? Math.round(metrics.completionRate * metrics.total) : 0}/${metrics.total}`}
        />
        <SummaryCard
          className="md:col-span-2"
          title="Email capture rate"
          value={`${Math.round(metrics.emailRate * 100)}%`}
        />
        <SummaryCard
          className="md:col-span-2"
          title="Average score"
          value={metrics.avgScore == null ? '—' : metrics.avgScore.toFixed(1)}
        />
        <SummaryCard
          className="md:col-span-2"
          title="Median score"
          value={metrics.medianScore == null ? '—' : String(metrics.medianScore)}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink-900">Score distribution</div>
          <div className="mt-4 space-y-3">
            {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => {
              const count = tierCounts[g] ?? 0
              const pct = metrics.total ? count / metrics.total : 0
              return (
                <div key={g}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold text-ink-900">
                      {g} <span className="text-xs font-semibold text-slate-500">({gradeTierLabel(g).range})</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">
                      {count} ({Math.round(pct * 100)}%)
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div className="h-full bg-ink-900" style={{ width: `${Math.round(pct * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink-900">VOC insights</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InsightBlock
              title="Concern shift"
              value={`${Math.round(voc.movedMoreConcernedPct * 100)}%`}
              subtitle="Moved from not/somewhat concerned → more concerned"
            />
            <InsightBlock
              title="Purchase intent"
              lines={[
                `Yes: ${voc.wouldBuyCounts.Yes}`,
                `Maybe: ${voc.wouldBuyCounts.Maybe}`,
                `No: ${voc.wouldBuyCounts.No}`,
              ]}
            />
            <InsightBlock
              title="Kids segmentation"
              lines={[
                `Kids: ${voc.kidsCounts.Yes}`,
                `No kids: ${voc.kidsCounts.No}`,
                `Under 5: ${voc.kidAges['Under 5']}`,
                `5-12: ${voc.kidAges['5-12']}`,
                `Both: ${voc.kidAges.Both}`,
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-12">
        <div className="md:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink-900">Question-level (scored)</div>
          <div className="mt-1 text-xs text-slate-600">Percent who answered Yes (sorted highest first).</div>
          <div className="mt-4 space-y-2">
            {questionStats.scored.map((q) => (
              <QuestionStatRow
                key={q.id}
                label={q.label}
                text={q.text}
                yesRate={q.yesRate}
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink-900">Question-level (awareness)</div>
          <div className="mt-1 text-xs text-slate-600">Percent who answered Yes.</div>
          <div className="mt-4 space-y-2">
            {questionStats.awareness.map((q) => (
              <QuestionStatRow
                key={q.id}
                label={q.label}
                text={q.text}
                yesRate={q.yesRate}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">Response browser</div>
            <div className="mt-1 text-xs text-slate-600">
              Click a row to expand details. Deletes are permanent.
            </div>
          </div>
          {hasSelection ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
              onClick={() => setConfirm({ mode: 'bulk', ids: selectedIds })}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected ({selectedIds.length})
            </button>
          ) : null}
        </div>

        {!rows ? (
          <div className="mt-4 text-sm text-slate-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-600">No results for current filters.</div>
        ) : (
          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === rows.length}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setSelected(checked ? new Set(rows.map((r) => r.response_id)) : new Set())
                      }}
                    />
                  </th>
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">First name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Score</th>
                  <th className="px-2 py-2">Grade</th>
                  <th className="px-2 py-2">Has kids</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2">Completed</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((r) => {
                  const isExpanded = expanded.has(r.response_id)
                  const isSelected = selected.has(r.response_id)
                  const kids = motivationText(r, 'q18')
                  return (
                    <>
                      <tr
                        key={r.response_id}
                        className="hover:bg-slate-50"
                        onClick={() =>
                          setExpanded((s) => {
                            const next = new Set(s)
                            if (next.has(r.response_id)) next.delete(r.response_id)
                            else next.add(r.response_id)
                            return next
                          })
                        }
                      >
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setSelected((s) => {
                                const next = new Set(s)
                                if (checked) next.add(r.response_id)
                                else next.delete(r.response_id)
                                return next
                              })
                            }}
                          />
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-slate-700">{shortId(r.response_id)}</td>
                        <td className="px-2 py-3">{r.first_name ?? '—'}</td>
                        <td className="px-2 py-3">{r.user_email ?? '—'}</td>
                        <td className="px-2 py-3">{r.final_score ?? '—'}</td>
                        <td className="px-2 py-3 font-semibold">{r.letter_grade ?? '—'}</td>
                        <td className="px-2 py-3">{kids ?? '—'}</td>
                        <td className="px-2 py-3 text-xs text-slate-600">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-2 py-3 text-xs text-slate-600">
                          {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                            onClick={() => setConfirm({ mode: 'row', ids: [r.response_id] })}
                            aria-label="Delete response"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr key={`${r.response_id}-details`}>
                          <td colSpan={10} className="bg-slate-50 px-4 py-4">
                            <ResponseDetails row={r} />
                          </td>
                        </tr>
                      ) : null}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirm ? (
        <ConfirmModal
          count={confirm.ids.length}
          onCancel={() => setConfirm(null)}
          onConfirm={() => deleteIds(confirm.ids)}
        />
      ) : null}

      {loading ? (
        <div className="mt-3 text-xs font-semibold text-slate-500">Refreshing…</div>
      ) : null}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  className,
}: {
  title: string
  value: string
  subtitle?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-card', className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
    </div>
  )
}

function InsightBlock({
  title,
  value,
  subtitle,
  lines,
}: {
  title: string
  value?: string
  subtitle?: string
  lines?: string[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_40px_-24px_rgba(15,61,38,0.15)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {value ? <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div> : null}
      {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
      {lines?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ConfirmModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-lg font-semibold text-ink-900">Confirm delete</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          Delete {count} response{count === 1 ? '' : 's'}? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionStatRow({
  label,
  text,
  yesRate,
}: {
  label: string
  text: string
  yesRate: number
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="w-10 shrink-0 text-sm font-semibold text-ink-900">{label}</div>
      <div className="min-w-0 flex-1 text-sm leading-snug text-slate-700">{text}</div>
      <div className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
        {Math.round(yesRate * 100)}%
      </div>
    </div>
  )
}

function ResponseDetails({ row }: { row: QuizResponseRow }) {
  const scored = (row.scored_answers ?? {}) as Record<string, unknown>
  const awareness = (row.awareness_answers ?? {}) as Record<string, unknown>
  const motivation = (row.motivation_answers ?? {}) as Record<string, unknown>

  const scoredItems = SCORED_QUESTIONS.map((q) => {
    const v = asBool(scored[q.id])
    return {
      id: q.id,
      text: q.text,
      answer: v === null ? '—' : v ? 'Yes' : 'No',
    }
  })
  const awarenessItems = AWARENESS_QUESTIONS.map((q) => {
    const v = asBool(awareness[q.id])
    return {
      id: q.id,
      text: q.text,
      answer: v === null ? '—' : v ? 'Yes' : 'No',
    }
  })
  const motivationLines = ['q18', 'q18b', 'q19', 'q20', 'q21'].map((id) => {
    const v = motivation[id]
    return `${id.toUpperCase()}: ${v == null ? '—' : String(v)}`
  })

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <DetailBlock title="Scored answers" items={scoredItems} />
      <DetailBlock title="Awareness answers" items={awarenessItems} />
      <DetailBlock title="Motivation answers" lines={motivationLines} />
    </div>
  )
}

function DetailBlock({
  title,
  items,
  lines,
}: {
  title: string
  items?: Array<{ id: string; text: string; answer: string }>
  lines?: string[]
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {items ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex gap-2">
                <span className="w-9 shrink-0 text-xs font-semibold text-ink-900">
                  {item.id.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 text-xs leading-snug text-slate-700">{item.text}</span>
              </div>
              <div className="mt-1 pl-9 text-xs font-semibold text-slate-600">{item.answer}</div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {(lines ?? []).map((l) => (
            <li key={l} className="font-mono text-xs">
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

