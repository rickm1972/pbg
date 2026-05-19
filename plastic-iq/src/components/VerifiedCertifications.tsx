import { BadgeCheck } from 'lucide-react'

type Props = {
  certificationNames: string[]
  className?: string
}

export function VerifiedCertifications({ certificationNames, className = '' }: Props) {
  if (certificationNames.length === 0) return null

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-label="Verified certifications"
    >
      <h2 className="text-sm font-semibold text-ink-900">Verified certifications</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {certificationNames.map((name) => (
          <li key={name}>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold leading-snug text-emerald-900 ring-1 ring-emerald-200">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-700" strokeWidth={2.5} />
              <span className="text-pretty">{name}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
