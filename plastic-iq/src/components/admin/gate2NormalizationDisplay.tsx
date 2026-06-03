import type { ReactNode } from 'react'
import { applyHazardSortToWhyThisScoreFields } from '../../lib/whyThisScoreSort'
import type {
  NormalizationComponent,
  NormalizationInputs,
  NormalizationLayer4a,
  ScoringInputRow,
} from '../../types/agent'
import type { WhyThisScoreFields } from '../../lib/whyThisScoreApi'
import { WhyThisScore } from '../WhyThisScore'

export function Gate2Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  )
}

export function NormalizationComponentBlock({ component }: { component: NormalizationComponent }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
      <h4 className="font-semibold text-ink-900">{component.component_name}</h4>
      <p className="mt-1 text-sm text-slate-700">{component.material}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Material Hazard" value={component.material_hazard} />
        <Metric label="Migration Potential" value={component.adjusted_migration_potential} />
        <Metric label="Contact Intimacy" value={component.contact_intimacy} />
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Severity ({component.exposure_severity})
          </p>
          <p className="mt-1 text-sm text-slate-700">{component.severity_justification}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Duration ({component.exposure_duration})
          </p>
          <p className="mt-1 text-sm text-slate-700">{component.duration_justification}</p>
        </div>
      </div>
      {component.inert_protection_applies ? (
        <p className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
          Inert protection applies
        </p>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  )
}

export function ProductDescriptionSection({ inputs }: { inputs: NormalizationInputs }) {
  const failed = inputs.status === 'description_generation_failed'
  const text = inputs.product_description?.trim()

  if (failed && !text) {
    return (
      <Gate2Section title="Product description">
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <span className="font-semibold">Generation failed.</span>{' '}
          {inputs.flagged_missing_fields?.length
            ? `Missing or invalid: ${inputs.flagged_missing_fields.join(', ')}`
            : 'See human review reason.'}
        </p>
      </Gate2Section>
    )
  }

  if (!text) {
    return (
      <Gate2Section title="Product description">
        <p className="text-sm text-slate-500">No product description on this packet.</p>
      </Gate2Section>
    )
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  const genVersion = inputs.normalization_metadata?.description_generator_version
  return (
    <Gate2Section title="Product description">
      <p className="text-xs text-slate-500">
        Template-driven copy ({wordCount} words).
        {genVersion ? ` Generator: ${genVersion}.` : ''}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{text}</p>
    </Gate2Section>
  )
}

export function Layer4aSection({ layer4a }: { layer4a: NormalizationLayer4a }) {
  const positives = formatLayer4aAdjustments(layer4a.positive_adjustments)
  const negatives = formatLayer4aAdjustments(layer4a.negative_adjustments)

  return (
    <Gate2Section title="Layer 4A adjustments">
      {positives.length > 0 ? (
        <div className="mt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Positive</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {positives.map((row, i) => (
              <li key={`pos-${i}`}>
                {row.label}
                {row.value != null ? (
                  <span className="ml-1 font-semibold tabular-nums text-emerald-800">
                    {row.value > 0 ? `+${row.value}` : row.value}
                  </span>
                ) : null}
                {row.basis ? (
                  <span className="block text-xs text-slate-500">{row.basis}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {negatives.length > 0 ? (
        <div className={positives.length > 0 ? 'mt-3' : 'mt-1'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Negative</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {negatives.map((row, i) => (
              <li key={`neg-${i}`}>
                {row.label}
                {row.value != null ? (
                  <span className="ml-1 font-semibold tabular-nums text-red-800">{row.value}</span>
                ) : null}
                {row.basis ? (
                  <span className="block text-xs text-slate-500">{row.basis}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {positives.length === 0 && negatives.length === 0 ? (
        <p className="text-sm text-slate-600">No itemized adjustments listed.</p>
      ) : null}
      <p className="mt-3 text-sm text-slate-700">
        Net adjustment: <strong className="tabular-nums">{layer4a.net_adjustment ?? 0}</strong>
      </p>
    </Gate2Section>
  )
}

function formatLayer4aAdjustments(
  items?: NormalizationLayer4a['positive_adjustments'],
): Array<{ label: string; value: number | null; basis?: string }> {
  if (!items?.length) return []
  return items.map((item) => {
    if (typeof item === 'string') return { label: item, value: null }
    const label = item.reason ?? item.label ?? 'Adjustment'
    const value = item.value ?? item.points ?? null
    return { label, value: value != null ? value : null, basis: item.basis }
  })
}

export function whyFieldsFromScoringInput(
  row: ScoringInputRow,
  components?: NormalizationComponent[] | null,
): WhyThisScoreFields | null {
  const primary = row.primary_material_options ?? []
  if (!Array.isArray(primary) || primary.length === 0) return null
  const fields: WhyThisScoreFields = {
    primary_material_options: primary,
    secondary_materials_options: row.secondary_materials_options ?? ['None'],
    coatings_finishes_options: row.coatings_finishes_options ?? ['None'],
    use_conditions_options: row.use_conditions_options ?? ['None'],
    disclosure_quality_options: row.disclosure_quality_options ?? ['None'],
    certifications_options: row.certifications_options ?? ['Third-party verification absent'],
  }
  return applyHazardSortToWhyThisScoreFields(fields, components)
}

export function NormalizationGeneratorStamps({ inputs }: { inputs: NormalizationInputs }) {
  const meta = inputs.normalization_metadata
  if (!meta) return null
  return (
    <Gate2Section title="Generator stamps">
      <ul className="space-y-1 text-sm text-slate-700">
        {meta.agent_version ? <li>Agent version: {meta.agent_version}</li> : null}
        {meta.algorithm_version ? <li>Algorithm: {meta.algorithm_version}</li> : null}
        {meta.description_generator_version ? (
          <li>Description generator: {meta.description_generator_version}</li>
        ) : null}
        {meta.run_timestamp ? (
          <li>Run: {new Date(meta.run_timestamp).toLocaleString()}</li>
        ) : null}
      </ul>
    </Gate2Section>
  )
}

export function getNormalizationWarnings(
  scoringInput: ScoringInputRow,
  inputs: NormalizationInputs,
): string[] {
  const warnings: string[] = []
  if (scoringInput.human_review_required) {
    warnings.push(
      scoringInput.human_review_reason ??
        inputs.human_review_reason ??
        'Human review required on this normalization packet.',
    )
  }
  if (inputs.flagged_missing_fields?.length) {
    warnings.push(
      `Flagged fields: ${inputs.flagged_missing_fields.join(', ')}`,
    )
  }
  if (inputs.status === 'description_generation_failed') {
    warnings.push('Product description generation failed.')
  }
  return warnings
}

export function NormalizationReadOnlyBody({
  scoringInput,
  inputs,
}: {
  scoringInput: ScoringInputRow
  inputs: NormalizationInputs
}) {
  const whyFields = whyFieldsFromScoringInput(scoringInput, inputs.components)

  return (
    <>
      <ProductDescriptionSection inputs={inputs} />
      <Gate2Section title={`Components (${inputs.components?.length ?? 0})`}>
        <div className="space-y-4">
          {(inputs.components ?? []).map((component, i) => (
            <NormalizationComponentBlock
              key={`${component.component_name}-${i}`}
              component={component}
            />
          ))}
        </div>
      </Gate2Section>
      {inputs.layer_4b ? (
        <Gate2Section title="Transparency badge & confidence interval">
          <p className="text-sm font-semibold text-ink-900">
            {inputs.layer_4b.transparency_badge ?? '—'}
            {inputs.layer_4b.confidence_interval != null
              ? ` · ±${inputs.layer_4b.confidence_interval}`
              : ''}
          </p>
          {inputs.layer_4b.badge_justification ? (
            <p className="mt-2 text-sm text-slate-700">{inputs.layer_4b.badge_justification}</p>
          ) : null}
        </Gate2Section>
      ) : null}
      {whyFields ? (
        <Gate2Section title="Why this score (structured)">
          <WhyThisScore fields={whyFields} className="mt-2 border-0 p-0 shadow-none" />
        </Gate2Section>
      ) : null}
      {inputs.layer_4a ? <Layer4aSection layer4a={inputs.layer_4a} /> : null}
      {inputs.normalization_notes ? (
        <Gate2Section title="Normalization notes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{inputs.normalization_notes}</p>
        </Gate2Section>
      ) : null}
      <NormalizationGeneratorStamps inputs={inputs} />
    </>
  )
}
