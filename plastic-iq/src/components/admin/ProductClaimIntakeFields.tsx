import {
  ADVANCED_CLAIM_INTAKE_TYPES,
  CLAIM_INTAKE_DISCLAIMER,
  CLAIM_INTAKE_LABELS,
  REQUIRED_CLAIM_INTAKE_TYPES,
  type ClaimIntakeMap,
  type ClaimIntakeType,
  type ClaimIntakeValue,
} from '../../lib/productClaimIntake'

type Props = {
  claims: ClaimIntakeMap
  onChange: (claimType: ClaimIntakeType, value: ClaimIntakeValue) => void
}

function ClaimSelect({
  claimType,
  value,
  onChange,
}: {
  claimType: ClaimIntakeType
  value: ClaimIntakeValue
  onChange: (value: ClaimIntakeValue) => void
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-600">{CLAIM_INTAKE_LABELS[claimType]}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ClaimIntakeValue)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>
  )
}

export function ProductClaimIntakeFields({ claims, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Intake claims (evidence hints)
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{CLAIM_INTAKE_DISCLAIMER}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {REQUIRED_CLAIM_INTAKE_TYPES.map((claimType) => (
          <ClaimSelect
            key={claimType}
            claimType={claimType}
            value={claims[claimType] ?? 'unknown'}
            onChange={(v) => onChange(claimType, v)}
          />
        ))}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          Advanced claim fields
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {ADVANCED_CLAIM_INTAKE_TYPES.map((claimType) => (
            <ClaimSelect
              key={claimType}
              claimType={claimType}
              value={claims[claimType] ?? 'unknown'}
              onChange={(v) => onChange(claimType, v)}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
