import type { Gate1SourceCitation as Citation } from '../../lib/gate1SourcesReview'

type Props = {
  citation: Citation
}

export function Gate1SourceCitationBlock({ citation }: Props) {
  if (!citation.url) {
    return <span className="text-slate-500">—</span>
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-800">
        {citation.reviewerLabel}
        <span className="font-normal text-slate-500"> · {citation.title}</span>
      </p>
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs font-semibold text-indigo-800 underline hover:text-indigo-950"
      >
        Open source
      </a>
      {citation.quote ? (
        <p className="text-[10px] leading-snug text-slate-600" title={citation.quote}>
          <span className="font-semibold text-slate-500">Quote:</span> “{citation.quote}”
        </p>
      ) : null}
      {citation.confidence ? (
        <p className="text-[10px] text-slate-500">
          <span className="font-semibold">Confidence:</span>{' '}
          {citation.confidence.replace(/_/g, ' ')}
          {citation.technicalSourceType ? (
            <span className="text-slate-400"> · source type: {citation.technicalSourceType.replace(/_/g, ' ')}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
