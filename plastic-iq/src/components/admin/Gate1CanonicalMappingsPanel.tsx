import { useMemo, useState } from 'react'
import type { CanonicalFieldMapping, CanonicalMappingsPayload } from '../../types/agent'
import {
  COOKWARE_SCORE_DRIVING_FIELDS,
  TAXONOMY_EXPANSION_REQUIRED,
  isExpansionRequired,
} from '../../lib/canonicalEvidenceMapping'
import { canonicalReviewKey } from '../../lib/gate1CanonicalReviewKeys'
import { getGate1ContradictionBlockers } from '../../lib/gate1ContradictionBlockers'

const PLAIN_ENGLISH_LABELS: Record<string, string> = {
  primary_contact_material_id: 'Food-contact surface',
  substrate_material_id: 'Pan body / base',
  coating_modifier_id: 'Coating modifier',
  pfas_status_id: 'PFAS status',
}

function displayLabel(fieldKey: string, fallback: string): string {
  return PLAIN_ENGLISH_LABELS[fieldKey] ?? fallback
}

type ReviewStatus = 'unconfirmed' | 'confirmed' | 'edited' | 'blocked'

type Props = {
  mappings: CanonicalMappingsPayload | null | undefined
  structuredForContradictions: { canonical_mappings?: CanonicalMappingsPayload | null } | null
  editable: boolean
  confirmedKeys: Set<string>
  editedKeys: Set<string>
  rejectedKeys: Set<string>
  onConfirmKey: (key: string) => void
  onRejectKey: (key: string) => void
  onUpdateMapping: (fieldKey: string, canonicalId: string, subKey?: string) => void
}

function MappingTableRow({
  reviewKey,
  label,
  row,
  editable,
  status,
  onConfirm,
  onReject,
  onSaveCanonical,
}: {
  reviewKey: string
  label: string
  row: CanonicalFieldMapping | null | undefined
  editable: boolean
  status: ReviewStatus
  onConfirm: () => void
  onReject: () => void
  onSaveCanonical: (canonicalId: string) => void
}) {
  const [editId, setEditId] = useState(row?.canonical_id ?? '')
  const [editing, setEditing] = useState(false)
  const expansion = isExpansionRequired(row?.canonical_id)

  const statusTone: Record<ReviewStatus, string> = {
    unconfirmed: 'bg-slate-100 text-slate-700',
    confirmed: 'bg-emerald-100 text-emerald-900',
    edited: 'bg-violet-100 text-violet-900',
    blocked: 'bg-red-100 text-red-900',
  }

  return (
    <tr className={status === 'blocked' || expansion ? 'bg-red-50/40' : undefined}>
      <td className="px-3 py-2 align-top text-xs font-semibold text-slate-800">{label}</td>
      <td className="px-3 py-2 align-top text-xs text-slate-700">{row?.raw_value ?? '—'}</td>
      <td className="px-3 py-2 align-top">
        {editable && editing ? (
          <input
            className="w-full rounded-lg border border-violet-300 px-2 py-1 font-mono text-xs"
            value={editId}
            onChange={(e) => setEditId(e.target.value)}
          />
        ) : (
          <span className={`font-mono text-xs ${expansion ? 'font-bold text-red-900' : 'text-ink-900'}`}>
            {row?.canonical_id ?? '—'}
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-top font-mono text-[10px] text-slate-600">
        {row?.mapping_rule_id ?? '—'}
      </td>
      <td className="px-3 py-2 align-top text-[10px] text-slate-600">
        {row?.source_url ? (
          <a href={row.source_url} target="_blank" rel="noreferrer" className="underline">
            source
          </a>
        ) : (
          '—'
        )}
        {row?.source_quote ? (
          <p className="mt-1 line-clamp-2 text-slate-500" title={row.source_quote}>
            {row.source_quote}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top text-[10px] text-slate-600">{row?.confidence_label ?? '—'}</td>
      <td className="px-3 py-2 align-top">
        <span
          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusTone[status]}`}
        >
          {status}
        </span>
      </td>
      <td className="px-3 py-2 align-top">
        {editable ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={status === 'blocked'}
              onClick={onConfirm}
              className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={status === 'blocked'}
              onClick={() => setEditing((e) => !e)}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {editing ? 'Done' : 'Edit ID'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  onSaveCanonical(editId.trim())
                  setEditing(false)
                }}
                className="rounded border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900"
              >
                Save
              </button>
            ) : null}
            <button
              type="button"
              onClick={onReject}
              className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 hover:bg-red-100"
            >
              Reject
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-slate-500">Read-only</span>
        )}
      </td>
    </tr>
  )
}

export function Gate1CanonicalMappingsPanel({
  mappings,
  structuredForContradictions,
  editable,
  confirmedKeys,
  editedKeys,
  rejectedKeys,
  onConfirmKey,
  onRejectKey,
  onUpdateMapping,
}: Props) {
  const contradictions = useMemo(
    () => getGate1ContradictionBlockers(structuredForContradictions ?? undefined),
    [structuredForContradictions],
  )

  const expansionRows = useMemo(() => {
    if (!mappings) return []
    const rows: { label: string; row: CanonicalFieldMapping; taxonomyFile: string }[] = []
    for (const req of COOKWARE_SCORE_DRIVING_FIELDS) {
      const row = mappings[req.field_key as keyof CanonicalMappingsPayload] as CanonicalFieldMapping | undefined
      if (row && isExpansionRequired(row.canonical_id)) {
        rows.push({ label: req.label, row, taxonomyFile: req.taxonomy_file })
      }
    }
    for (const flag of mappings.regulatory_flag_ids ?? []) {
      if (isExpansionRequired(flag.canonical_id)) {
        rows.push({
          label: 'Regulatory flag',
          row: flag,
          taxonomyFile: 'regulatory-flag-taxonomy.mjs',
        })
      }
    }
    return rows
  }, [mappings])

  function rowStatus(
    reviewKey: string,
    row: CanonicalFieldMapping | null | undefined,
  ): ReviewStatus {
    if (rejectedKeys.has(reviewKey) || isExpansionRequired(row?.canonical_id)) return 'blocked'
    if (editedKeys.has(reviewKey)) return 'edited'
    if (confirmedKeys.has(reviewKey)) return 'confirmed'
    return 'unconfirmed'
  }

  if (!mappings) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Canonical mappings not applied yet. Save draft or reload to run Phase 3.5 mapping.
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border-2 border-violet-200 bg-violet-50/30 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
          Primary review surface
        </p>
        <h4 className="mt-1 text-sm font-semibold text-ink-900">
          Canonical taxonomy review (Phase 3.5)
        </h4>
        <p className="mt-1 text-xs text-slate-700">
          Agent 2 consumes <strong>canonical IDs only</strong> from this table. Confirm each row
          after review. Raw extraction below is collapsed audit detail only.
        </p>
      </div>

      {contradictions.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-xl border border-red-200 bg-red-50 py-2 pl-8 pr-3 text-xs text-red-950">
          {contradictions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}

      {expansionRows.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">TAXONOMY_EXPANSION_REQUIRED</p>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-xs">
            {expansionRows.map(({ label, row, taxonomyFile }) => (
              <li key={`${label}-${row.raw_value}`}>
                <span className="font-semibold">{label}</span> — raw:{' '}
                <span className="font-mono">{row.raw_value || '—'}</span>
                <span className="block text-slate-600">
                  Suggested taxonomy file: <code className="font-mono">{taxonomyFile}</code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100 text-left">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Review field</th>
              <th className="px-3 py-2">Extracted text</th>
              <th className="px-3 py-2">Canonical ID (Agent 2)</th>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Source / quote</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COOKWARE_SCORE_DRIVING_FIELDS.map((req) => {
              const rk = canonicalReviewKey(req.field_key)
              const row = mappings[req.field_key as keyof CanonicalMappingsPayload] as
                | CanonicalFieldMapping
                | undefined
              return (
                <MappingTableRow
                  key={rk}
                  reviewKey={rk}
                  label={displayLabel(req.field_key, req.label)}
                  row={row}
                  editable={editable}
                  status={rowStatus(rk, row)}
                  onConfirm={() => onConfirmKey(rk)}
                  onReject={() => onRejectKey(rk)}
                  onSaveCanonical={(id) => onUpdateMapping(req.field_key, id)}
                />
              )
            })}
            {(mappings.regulatory_flag_ids ?? []).map((flag, i) => {
              const rk = canonicalReviewKey('regulatory_flag_ids', String(i))
              return (
                <MappingTableRow
                  key={rk}
                  reviewKey={rk}
                  label={`Regulatory flags ${i + 1}`}
                  row={flag}
                  editable={editable}
                  status={rowStatus(rk, flag)}
                  onConfirm={() => onConfirmKey(rk)}
                  onReject={() => onRejectKey(rk)}
                  onSaveCanonical={(id) => onUpdateMapping('regulatory_flag_ids', id, String(i))}
                />
              )
            })}
            {Object.entries(mappings.safety_claim_ids ?? {}).map(([key, row]) => {
              if (!row) return null
              const rk = canonicalReviewKey('safety_claim_ids', key)
              return (
                <MappingTableRow
                  key={rk}
                  reviewKey={rk}
                  label={`Safety claims · ${key.replace(/_/g, ' ')}`}
                  row={row}
                  editable={editable}
                  status={rowStatus(rk, row)}
                  onConfirm={() => onConfirmKey(rk)}
                  onReject={() => onRejectKey(rk)}
                  onSaveCanonical={(id) => onUpdateMapping('safety_claim_ids', id, key)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
