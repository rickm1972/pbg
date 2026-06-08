import { useMemo } from 'react'
import { buildGate1SourcesReview, type Gate1SourceRow, type Gate1SourceSection } from '../../lib/gate1SourcesReview'
import type { ProductEvidence } from '../../types/agent'

const SECTION_HEADINGS: Record<Gate1SourceSection, string> = {
  primary_product: 'Primary product sources',
  required_check: 'Required-check sources',
  other_context: 'Other / context sources',
  rejected_mismatch: 'Rejected / mismatch (not primary)',
}

const STATUS_STYLES: Record<string, string> = {
  primary: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  supporting: 'bg-sky-100 text-sky-900 border-sky-200',
  'context-only': 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-red-100 text-red-900 border-red-200',
  mismatch: 'bg-amber-100 text-amber-950 border-amber-300',
}

function CoverageChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const ok = value === 'present' || value === 'not_applicable'
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 text-[10px] ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}
    >
      <span className="font-semibold">{label}:</span>{' '}
      <span className="uppercase">{value.replace(/_/g, ' ')}</span>
    </div>
  )
}

function SourceRowCard({ row }: { row: Gate1SourceRow }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">{row.title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{row.reviewerLabel}</p>
          {row.technicalSourceType ? (
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">{row.technicalSourceType}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[row.usageStatus] ?? STATUS_STYLES['context-only']}`}
        >
          {row.usageStatus.replace(/-/g, ' ')}
        </span>
      </div>
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs font-semibold text-indigo-800 underline hover:text-indigo-950"
      >
        Open source
      </a>
      {row.reason ? (
        <p className="mt-2 text-xs text-amber-950">{row.reason}</p>
      ) : null}
      {row.requiredCheckLabel ? (
        <p className="mt-1 text-[10px] text-indigo-800">
          <span className="font-semibold">Required check:</span> {row.requiredCheckLabel}
        </p>
      ) : null}
      {row.fieldsSupported.length > 0 ? (
        <p className="mt-2 text-[10px] text-slate-600">
          <span className="font-semibold text-slate-500">Fields supported:</span>{' '}
          {row.fieldsSupported.join(' · ')}
        </p>
      ) : null}
      {row.checkedAt ? (
        <p className="mt-1 text-[10px] text-slate-400">
          Checked {new Date(row.checkedAt).toLocaleString()}
        </p>
      ) : null}
    </li>
  )
}

function SourceSection({
  sectionKey,
  rows,
}: {
  sectionKey: Gate1SourceSection
  rows: Gate1SourceRow[]
}) {
  if (rows.length === 0) return null
  return (
    <div>
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {SECTION_HEADINGS[sectionKey]}
      </h5>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <SourceRowCard key={row.url} row={row} />
        ))}
      </ul>
    </div>
  )
}

type Props = {
  evidence: ProductEvidence
}

export function Gate1SourcesReviewedPanel({ evidence }: Props) {
  const model = useMemo(() => buildGate1SourcesReview(evidence), [evidence])
  const { coverage, sections, missingUrlNotes, allRows } = model

  if (allRows.length === 0 && missingUrlNotes.length === 0) {
    return (
      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        No source URLs on this evidence packet. Re-run Agent 1 if sources should be present.
      </section>
    )
  }

  return (
    <section className="mt-4 space-y-4 rounded-xl border-2 border-sky-200 bg-sky-50/40 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">
          Source verification
        </p>
        <h4 className="mt-1 text-sm font-semibold text-ink-900">Sources reviewed</h4>
        <p className="mt-1 text-xs text-slate-700">
          Every URL Agent 1 used or attempted, with reviewer-friendly labels. Open links to verify
          Amazon, manufacturer, and regulatory basis without expanding raw extraction.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <CoverageChip label="Amazon URL" value={coverage.amazon} />
        <CoverageChip label="Manufacturer URL" value={coverage.manufacturer} />
        <CoverageChip label="Regulatory source" value={coverage.regulatory} />
        <CoverageChip label="PFOA/PFAS distinction" value={coverage.pfoaPfasDistinction} />
        <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
          <span className="font-semibold">Rejected / mismatched:</span> {coverage.rejectedMismatchCount}
        </div>
      </div>

      {missingUrlNotes.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-2 pl-8 pr-3 text-xs text-red-950">
          {missingUrlNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4">
        <SourceSection sectionKey="primary_product" rows={sections.primary_product} />
        <SourceSection sectionKey="required_check" rows={sections.required_check} />
        <SourceSection sectionKey="other_context" rows={sections.other_context} />
        <SourceSection sectionKey="rejected_mismatch" rows={sections.rejected_mismatch} />
      </div>
    </section>
  )
}
