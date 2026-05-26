import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { fetchVerifiedCertifications } from '../lib/productEvidenceApi'
import { isPacRelevant } from '../lib/certificationTaxonomy'

type Props = {
  productId: string
  className?: string
}

function registryHostLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'external site'
  }
}

function certificationAriaLabel(certName: string, sourceUrl: string): string {
  return `${certName} certification — opens ${registryHostLabel(sourceUrl)} in a new tab`
}

export function CertificationBadges({ productId, className = '' }: Props) {
  const [verifiedCerts, setVerifiedCerts] = useState<
    Awaited<ReturnType<typeof fetchVerifiedCertifications>> | null
  >(null)

  useEffect(() => {
    let cancelled = false
    setVerifiedCerts(null)
    fetchVerifiedCertifications(productId)
      .then((certs) => {
        if (!cancelled) setVerifiedCerts(certs)
      })
      .catch(() => {
        if (!cancelled) setVerifiedCerts([])
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const pacRelevantCerts = useMemo(
    () => (verifiedCerts ?? []).filter((cert) => isPacRelevant(cert.cert_name)),
    [verifiedCerts],
  )

  if (verifiedCerts === null || pacRelevantCerts.length === 0) return null

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
      aria-labelledby="verified-safety-certifications-heading"
    >
      <h2
        id="verified-safety-certifications-heading"
        className="text-sm font-semibold text-ink-900"
      >
        Verified safety certifications
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {pacRelevantCerts.map((cert) => (
          <li key={`${cert.cert_name}-${cert.source_url}`}>
            <a
              href={cert.source_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={certificationAriaLabel(cert.cert_name, cert.source_url)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <span className="text-pretty">{cert.cert_name}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
