import type { AprDisplayWhyThisScoreSection } from '../types/apr'

type Props = {
  sections: AprDisplayWhyThisScoreSection[]
  className?: string
}

export function WhyThisScore({ sections, className = '' }: Props) {
  if (!sections.length) return null

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-card ${className}`}
    >
      <h2 className="text-sm font-semibold text-ink-900">Why this score?</h2>
      <dl className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </dt>
            <dd className="mt-1.5">
              <ul className="list-none space-y-2 pl-0 leading-relaxed">
                {section.items.map((item) => (
                  <li key={`${section.title}-${item.text}`}>
                    <div>{item.text}</div>
                    {item.note ? (
                      <p className="mt-1 text-xs leading-snug text-slate-500">{item.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
