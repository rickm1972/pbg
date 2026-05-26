import { displayOptions, type WhyThisScoreFields } from '../lib/whyThisScoreApi'

const SECTIONS: Array<{
  key: keyof WhyThisScoreFields
  title: string
}> = [
  { key: 'primary_material_options', title: 'Primary material' },
  { key: 'secondary_materials_options', title: 'Secondary materials' },
  { key: 'coatings_finishes_options', title: 'Coatings & finishes' },
  { key: 'use_conditions_options', title: 'Use conditions' },
  { key: 'disclosure_quality_options', title: 'Disclosure quality' },
  { key: 'certifications_options', title: 'Certifications & testing' },
]

type Props = {
  fields: WhyThisScoreFields
  className?: string
}

export function WhyThisScore({ fields, className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-card ${className}`}
    >
      <h2 className="text-sm font-semibold text-ink-900">Why this score?</h2>
      <dl className="mt-4 space-y-4">
        {SECTIONS.map(({ key, title }) => {
          const options = fields[key]
          const visible = displayOptions(options)
          const isNoneOnly = options.length === 1 && options[0] === 'None'

          return (
            <div key={key}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title}
              </dt>
              <dd className="mt-1.5">
                {visible.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 leading-relaxed">
                    {visible.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                ) : isNoneOnly ? (
                  <p className="text-slate-500">None</p>
                ) : (
                  <p className="text-slate-500">None</p>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
