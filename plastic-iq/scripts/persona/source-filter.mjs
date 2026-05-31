/**
 * Drop generic sales-coaching / objection-handling sources from VOC angles.
 */
import { isMalformedOrSpamUrl, isPlaceholderClaim } from './url-guard.mjs'

const BLOCKED_HOSTS = new Set([
  'inman.com',
  'www.inman.com',
  'salesman.com',
  'www.salesman.com',
  'allego.com',
  'www.allego.com',
  'atlassian.com',
  'www.atlassian.com',
  'lumenlearning.com',
  'courses.lumenlearning.com',
  'sbigrowth.com',
  'www.sbigrowth.com',
  'owenvansyckle.com',
  'www.owenvansyckle.com',
  'hubspot.com',
  'www.hubspot.com',
  'salesforce.com',
  'www.salesforce.com',
  'gong.io',
  'www.gong.io',
  'close.com',
  'www.close.com',
  'pipedrive.com',
  'www.pipedrive.com',
])

const SALES_URL_PATH_RE =
  /\/(sales|selling|objections?|closing|pipeline|crm|realtor|broker|b2b-sales|sales-training|sales-tips|sales-coach)/i

const SALES_TEXT_RE =
  /\b(sales objection|handle objections?|overcome objections?|sales coaching|sales technique|sales training|sales playbook|sales rep|sales team|sales funnel|closing techniques?|objection handling|buyer objections?\s+(in\s+)?sales|trust indicators?\s+for\s+sales)\b/i

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * @param {{ url?: string, source_title?: string, claim?: string, excerpt?: string }} item
 */
export function isGenericSalesSource(item) {
  const url = String(item?.url ?? '')
  const host = hostFromUrl(url)
  const hostBare = host.replace(/^www\./, '')
  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(hostBare)) return true

  try {
    const path = new URL(url).pathname
    if (SALES_URL_PATH_RE.test(path) && !/reddit\.com|amazon\.com|babycenter|whattoexpect/i.test(host)) {
      return true
    }
  } catch {
    /* ignore */
  }

  const text = [item?.source_title, item?.claim, item?.excerpt].filter(Boolean).join(' ')
  if (SALES_TEXT_RE.test(text)) return true

  return false
}

/**
 * @param {object[]} excerpts
 * @param {{ angleId?: string, log?: (msg: string) => void }} [opts]
 */
export function filterExcerptsForAngle(excerpts, { angleId, log } = {}) {
  const kept = []
  let dropped = 0
  for (const ex of excerpts) {
    if (isMalformedOrSpamUrl(ex.url) || isPlaceholderClaim(ex.claim)) {
      dropped++
      continue
    }
    if (angleId !== 'objections_trust') {
      kept.push(ex)
      continue
    }
    if (isGenericSalesSource(ex)) {
      dropped++
      log?.(`  Discarded generic sales source: ${ex.url}`)
      continue
    }
    kept.push({ ...ex, source_type: 'voc' })
  }
  if (dropped > 0 && angleId === 'objections_trust') {
    log?.(`  Filtered ${dropped} excerpt(s) from objections angle (sales/spam/placeholder)`)
  } else if (dropped > 0) {
    log?.(`  Filtered ${dropped} excerpt(s) (malformed/spam/placeholder)`)
  }
  return kept
}
