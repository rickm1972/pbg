import type { NormalizationComponent } from '../types/agent'

export type ScoreFactorLabel = {
  key: string
  label: string
  value: number
  valueDisplay: string
  explanation: string
}

function isPtfeFamily(materialId?: string, material?: string): boolean {
  const s = `${materialId ?? ''} ${material ?? ''}`.toLowerCase()
  return /ptfe|teflon|pfas/.test(s)
}

function isPfasFamily(materialId?: string, material?: string): boolean {
  const s = `${materialId ?? ''} ${material ?? ''}`.toLowerCase()
  return /pfas|ptfe|teflon|pfoa|pfos/.test(s)
}

function hazardExplanation(norm?: NormalizationComponent): string {
  if (!norm) {
    return 'Material hazard score from PAC material taxonomy — higher values indicate greater PAC concern for this contact material.'
  }
  const material = norm.material?.trim() || 'Primary contact material'
  if (isPtfeFamily(norm.material_id, norm.material)) {
    return `${material} — high PAC concern because PTFE is a PFAS-family food-contact coating.`
  }
  if (norm.material_hazard_table_entry) {
    return `${material} — ${norm.material_hazard_table_entry}.`
  }
  return `${material} — hazard ${norm.material_hazard} from PAC material taxonomy table.`
}

function migrationExplanation(norm?: NormalizationComponent): string {
  if (norm?.migration_table_entry) {
    if (isPtfeFamily(norm.material_id, norm.material)) {
      return `High migration/release concern due to nonstick coating wear, heat exposure, and food-contact use (${norm.migration_table_entry}).`
    }
    return norm.migration_table_entry
  }
  if (isPtfeFamily(norm?.material_id, norm?.material)) {
    return 'High migration/release concern due to nonstick coating wear, heat exposure, and food-contact use.'
  }
  return 'Adjusted migration potential reflects how much chemical release is expected under normal use conditions.'
}

function contactIntimacyExplanation(norm?: NormalizationComponent, ci?: number): string {
  const tableEntry = (norm as { contact_intimacy_table_entry?: string } | undefined)
    ?.contact_intimacy_table_entry
  if (tableEntry) {
    if (/direct food contact|food contact during cooking/i.test(tableEntry)) {
      return 'Direct food-contact surface.'
    }
    return tableEntry.replace(/\s*—\s*[\d.]+$/, '.').trim()
  }
  const role = norm?.component_role ?? norm?.role
  if (ci === 1 || role === 'primary_food_contact' || role === 'coating') {
    return 'Direct food-contact surface.'
  }
  if (ci === 0.5 || role === 'handle') {
    return 'Intermittent hand contact during use — not a primary food surface.'
  }
  if (ci != null && ci <= 0.3) {
    return 'Indirect or minimal contact — lower intimacy than primary food surfaces.'
  }
  return `Contact intimacy ${ci ?? '—'} reflects how directly this component touches food or the body during use.`
}

function severityExplanation(norm?: NormalizationComponent, severity?: number): string {
  if (norm?.severity_justification) {
    const j = norm.severity_justification
    if (/cookware stovetop default/i.test(j)) {
      return 'Cookware stovetop default 0.88 + fatty food exposure 0.08 = 0.96.'
    }
    return j
  }
  const base = (norm as { severity_base?: number })?.severity_base
  const additions = (norm as { severity_additions?: Array<{ factor?: string; value?: number }> })
    ?.severity_additions
  if (base != null && additions?.length) {
    const parts = additions.map((a) => `${a.factor ?? 'modifier'} ${a.value ?? 0}`)
    const sum = base + additions.reduce((s, a) => s + Number(a.value ?? 0), 0)
    return `Base ${base} + ${parts.join(' + ')} = ${sum.toFixed(2)}.`
  }
  return `Exposure severity ${severity ?? '—'} reflects heat, fat, abrasion, and foreseeable use conditions for this component.`
}

function durationExplanation(norm?: NormalizationComponent): string {
  if (norm?.duration_justification) {
    if (/15 min daily|cooking pan/i.test(norm.duration_justification)) {
      return 'Default cooking pan use, approximately 15 minutes daily.'
    }
    return norm.duration_justification
  }
  return 'Exposure duration reflects typical daily contact time for this product category and component role.'
}

const SCALE_FACTOR_EXPLANATION =
  'Algorithm scaling constant used to convert multiplied risk factors into NPR.'

export type ComponentFactorLabelOptions = {
  inertProtectionApplied?: boolean
  gate2Severity?: number
  gate2Duration?: number
}

export function buildComponentFactorLabels(
  hazard: number,
  migration: number,
  contactIntimacy: number,
  severity: number,
  duration: number,
  baseNpr: number,
  norm?: NormalizationComponent,
  inertOpts?: ComponentFactorLabelOptions,
): ScoreFactorLabel[] {
  const inert = Boolean(inertOpts?.inertProtectionApplied)
  const gate2Sev = inertOpts?.gate2Severity
  const gate2Dur = inertOpts?.gate2Duration

  return [
    {
      key: 'hazard',
      label: 'Material Hazard',
      value: hazard,
      valueDisplay: hazard.toFixed(2),
      explanation: hazardExplanation(norm),
    },
    {
      key: 'migration',
      label: 'Migration Potential',
      value: migration,
      valueDisplay: migration.toFixed(2),
      explanation: migrationExplanation(norm),
    },
    {
      key: 'contactIntimacy',
      label: 'Contact Intimacy',
      value: contactIntimacy,
      valueDisplay: contactIntimacy.toFixed(2),
      explanation: contactIntimacyExplanation(norm, contactIntimacy),
    },
    {
      key: 'severity',
      label: 'Exposure Severity',
      value: severity,
      valueDisplay: inert && gate2Sev != null
        ? `${severity.toFixed(4)} scoring · Gate 2 ${gate2Sev.toFixed(2)}`
        : severity.toFixed(4),
      explanation: inert && gate2Sev != null
        ? `${severityExplanation(norm, gate2Sev)} Agent 3 V2.3.4 inert protection: Gate 2 severity × 0.20 = ${severity.toFixed(4)} for NPR (migration ≤ 0.05).`
        : severityExplanation(norm, severity),
    },
    {
      key: 'duration',
      label: 'Exposure Duration',
      value: duration,
      valueDisplay: inert && gate2Dur != null
        ? `${duration.toFixed(4)} scoring · Gate 2 ${gate2Dur.toFixed(2)}`
        : duration.toFixed(4),
      explanation: inert && gate2Dur != null
        ? `${durationExplanation(norm)} Agent 3 V2.3.4 inert protection: Gate 2 duration × 0.20 = ${duration.toFixed(4)} for NPR.`
        : durationExplanation(norm),
    },
    {
      key: 'scale',
      label: 'Scale Factor',
      value: 1000,
      valueDisplay: '1000',
      explanation: SCALE_FACTOR_EXPLANATION,
    },
    {
      key: 'baseNpr',
      label: 'Base NPR',
      value: baseNpr,
      valueDisplay: baseNpr.toFixed(1),
      explanation: 'Net Product Risk before escalator — product of all factors above.',
    },
  ]
}

export type EscalatorThresholdCheck = {
  label: string
  value: string
  passes: boolean
}

export function buildEscalatorThresholdChecks(
  escalatorId: string,
  component: {
    migration: number
    severity: number
    materialLabel?: string
    materialId?: string
    material?: string
  },
): EscalatorThresholdCheck[] {
  if (escalatorId === 'escalator_1') {
    return [
      {
        label: 'Migration Potential',
        value: `${component.migration.toFixed(2)} → passes threshold (≥ 0.60)`,
        passes: component.migration >= 0.6,
      },
      {
        label: 'Exposure Severity',
        value: `${component.severity.toFixed(2)} → passes threshold (≥ 0.88)`,
        passes: component.severity >= 0.88,
      },
      {
        label: 'Material',
        value: isPfasFamily(component.materialId, component.material)
          ? 'PTFE/PFAS food-contact coating → qualifies'
          : `${component.materialLabel ?? 'Food-contact material'} → qualifies under cookware escalation rules`,
        passes: true,
      },
    ]
  }

  if (escalatorId === 'escalator_2') {
    return [
      {
        label: 'Migration Potential',
        value: `${component.migration.toFixed(2)} → ${component.migration >= 0.6 ? 'passes' : 'does not pass'} (≥ 0.60)`,
        passes: component.migration >= 0.6,
      },
      {
        label: 'Exposure Severity',
        value: `${component.severity.toFixed(2)} → ${component.severity >= 0.88 ? 'passes' : 'does not pass'} (≥ 0.88)`,
        passes: component.severity >= 0.88,
      },
      {
        label: 'Product category',
        value: "Children's / infant product escalation case",
        passes: true,
      },
    ]
  }

  return []
}
