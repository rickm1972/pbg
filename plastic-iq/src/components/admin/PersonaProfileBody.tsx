import { forwardRef } from 'react'
import type { PersonaContent, PersonaRow, PersonaSource } from '../../types/persona'
import { formatPersonaDisplayName, personaTagline } from '../../lib/personaDisplay'

export const PERSONA_CORE_SECTIONS: Array<{ title: string; keys: (keyof PersonaContent)[] }> = [
  { title: 'Summary', keys: ['summary'] },
  { title: 'Who they are', keys: ['demographics', 'role_lifestyle_context'] },
  { title: 'Goals & pain', keys: ['main_goal', 'main_pain_point', 'buying_trigger'] },
  {
    title: 'Buying journey',
    keys: ['barriers', 'decision_criteria', 'information_needs', 'objections', 'proof_needed'],
  },
  { title: 'Reach & message', keys: ['trusted_sources', 'channels', 'messaging_angle', 'cta'] },
]

export const PERSONA_PB_SECTIONS: Array<{ title: string; keys: (keyof PersonaContent)[] }> = [
  {
    title: 'PlasticBegone traits',
    keys: [
      'pac_awareness_level',
      'overwhelm_risk',
      'safety_motivation',
      'replacement_readiness',
      'trust_threshold',
      'eighty_twenty_mindset_fit',
      'product_category_priority',
      'risk_communication_sensitivity',
      'preferred_safer_alternative_type',
      'certification_literacy',
    ],
  },
]

export const PERSONA_FIELD_LABELS: Record<keyof PersonaContent, string> = {
  persona_name: 'Persona name',
  persona_nickname: 'Nickname',
  segment: 'Segment',
  summary_one_liner: 'One-line summary',
  summary: 'Summary',
  demographics: 'Demographics',
  role_lifestyle_context: 'Role / lifestyle',
  main_goal: 'Main goal',
  main_pain_point: 'Main pain point',
  buying_trigger: 'Buying trigger',
  barriers: 'Barriers',
  decision_criteria: 'Decision criteria',
  information_needs: 'Information needs',
  trusted_sources: 'Trusted sources',
  channels: 'Channels',
  messaging_angle: 'Messaging angle',
  objections: 'Objections',
  proof_needed: 'Proof needed',
  cta: 'CTA',
  voice_of_customer_quote: 'Voice of customer',
  data_sources: 'Data sources (summary)',
  pac_awareness_level: 'PAC awareness',
  overwhelm_risk: 'Overwhelm risk',
  safety_motivation: 'Safety motivation',
  replacement_readiness: 'Replacement readiness',
  trust_threshold: 'Trust threshold',
  eighty_twenty_mindset_fit: '80/20 mindset',
  product_category_priority: 'Category priority',
  risk_communication_sensitivity: 'Risk communication',
  preferred_safer_alternative_type: 'Preferred materials',
  certification_literacy: 'Certification literacy',
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

type FieldProps = {
  label: string
  value: string
  editing?: boolean
  onChange?: (v: string) => void
}

function isUsableSource(s: PersonaSource): boolean {
  const excerpt = (s.excerpt ?? '').trim()
  if (!excerpt) return false
  return !/^referenced in retrieval$/i.test(excerpt)
}

function sectionHasVisibleFields(
  section: { keys: (keyof PersonaContent)[] },
  content: PersonaContent,
  editing: boolean,
): boolean {
  if (editing) return true
  return section.keys.some((k) => (content[k] ?? '').trim().length > 0)
}

function PersonaField({ label, value, editing, onChange }: FieldProps) {
  if (!value && !editing) return null
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {editing && onChange ? (
        <textarea
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-ink-900"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{value}</p>
      )}
    </div>
  )
}

type Props = {
  row: PersonaRow
  content: PersonaContent
  editing?: boolean
  onFieldChange?: (key: keyof PersonaContent, value: string) => void
  showMeta?: boolean
}

export const PersonaProfileBody = forwardRef<HTMLDivElement, Props>(function PersonaProfileBody(
  { row, content, editing = false, onFieldChange, showMeta = true },
  ref,
) {
  const headline =
    formatPersonaDisplayName(content) || row.persona_name || 'Untitled persona'
  const tagline = personaTagline(content, row.target_segment)
  const sources = (row.sources ?? []).filter(isUsableSource)
  const allSections = [...PERSONA_CORE_SECTIONS, ...PERSONA_PB_SECTIONS]

  return (
    <div ref={ref} className="persona-profile-export bg-white text-ink-900">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">{headline}</h1>
        {editing && onFieldChange ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Persona name</span>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={content.persona_name ?? ''}
                onChange={(e) => onFieldChange('persona_name', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Nickname</span>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={content.persona_nickname ?? ''}
                onChange={(e) => onFieldChange('persona_nickname', e.target.value)}
              />
            </label>
          </div>
        ) : null}
        {tagline ? <p className="mt-2 text-sm leading-snug text-slate-600">{tagline}</p> : null}
        {showMeta ? (
          <p className="mt-2 text-xs text-slate-500">
            {content.segment || row.segment ? (
              <span className="font-medium text-slate-700">{content.segment || row.segment} · </span>
            ) : null}
            Target: {row.target_segment}
          </p>
        ) : null}
      </header>

      {content.voice_of_customer_quote ? (
        <blockquote className="persona-voc-quote mt-6 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 px-6 py-5 text-base italic leading-relaxed text-emerald-950">
          “{content.voice_of_customer_quote}”
        </blockquote>
      ) : null}

      <div className="persona-profile-sections mt-6 columns-1 gap-6 lg:columns-2 [column-gap:1.5rem]">
        {allSections.map((section) => {
          if (!sectionHasVisibleFields(section, content, editing)) return null
          return (
            <section
              key={section.title}
              className="persona-section-card mb-6 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-card [box-decoration-break:clone]"
            >
              <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.keys.map((key) => (
                  <PersonaField
                    key={key}
                    label={PERSONA_FIELD_LABELS[key]}
                    value={content[key] ?? ''}
                    editing={editing}
                    onChange={
                      onFieldChange ? (v) => onFieldChange(key, v) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {sources.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Sources</h2>
          <ul className="mt-3 space-y-2">
            {sources.map((s: PersonaSource) => (
              <li key={s.url} className="py-0.5 pl-3 text-sm text-slate-700">
                <span className="font-medium">{s.title || hostLabel(s.url)}</span>
                <span className="text-slate-500"> — </span>
                <a
                  href={s.url}
                  className="break-all text-emerald-900 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.url}
                </a>
                {s.excerpt ? (
                  <p className="mt-0.5 text-xs text-slate-500">{s.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
})
