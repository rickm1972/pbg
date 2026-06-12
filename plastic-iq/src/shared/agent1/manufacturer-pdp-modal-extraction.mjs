/**
 * Bounded manufacturer PDP modal/dialog/accordion evidence extraction.
 * Targets hidden static HTML blocks (not broad site crawl).
 */

const EVIDENCE_UI_MARKER_RE =
  /Free From Forever Chemicals|PFAS[-\s]?free|PTFE[-\s]?free|PFOA[-\s]?free|forever chemicals|Learn More|lab results|test results|third[-\s]?party lab|verified by 3rd party|Light Labs|Non-Detect|TableLab|popup-labs|global-modal|js-global-modal-trigger/i

const LAB_EVIDENCE_RE =
  /test\s*results\s*verified|third[-\s]?party\s*lab|non[-\s]?detect|pfos|ptfe|pfoa|pfas|light\s*labs|tablelab/i

const MAX_MODAL_BLOCKS = 5
const DEFAULT_TIMEOUT_MS = 20_000

/**
 * @param {string} html
 */
export function htmlToTextPreserveAlt(html) {
  let h = String(html ?? '')
  h = h.replace(/<img[^>]*\salt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  h = h.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  h = h.replace(/<[^>]+>/g, ' ')
  return h.replace(/\s+/g, ' ').trim()
}

/**
 * Extract bounded evidence-bearing modal/dialog regions from static HTML.
 * @param {string} html
 * @param {{ maxBlocks?: number }} [options]
 */
export function extractModalEvidenceBlocks(html, options = {}) {
  const maxBlocks = options.maxBlocks ?? MAX_MODAL_BLOCKS
  const raw = String(html ?? '')
  if (!raw.trim()) return []

  /** @type {{ marker: string, text: string, kind: string }[]} */
  const blocks = []
  const seen = new Set()

  const markers = [
    'Test Results Verified by 3rd Party Lab',
    'TableLab',
    'popup-labs',
    'data-modal-target-id',
    'Non-Detect',
    'PFOS',
    'Free From Forever Chemicals',
    'TerraBond',
  ]

  for (const marker of markers) {
    let idx = 0
    while (blocks.length < maxBlocks) {
      const pos = raw.indexOf(marker, idx)
      if (pos < 0) break
      const chunk = raw.slice(Math.max(0, pos - 600), Math.min(raw.length, pos + 4000))
      const text = htmlToTextPreserveAlt(chunk)
      if (!LAB_EVIDENCE_RE.test(text) && !EVIDENCE_UI_MARKER_RE.test(text)) {
        idx = pos + marker.length
        continue
      }
      const key = text.slice(0, 200)
      if (!seen.has(key)) {
        seen.add(key)
        blocks.push({
          marker,
          text: text.slice(0, 2800),
          kind: /test\s*results\s*verified|non[-\s]?detect|tablelab/i.test(text)
            ? 'lab_modal'
            : 'material_modal',
        })
      }
      idx = pos + marker.length
    }
  }

  return blocks.slice(0, maxBlocks)
}

/**
 * @param {string} html
 * @param {{ maxVisibleChars?: number, maxModalChars?: number, maxBlocks?: number }} [options]
 */
export function buildManufacturerPdpExcerpt(html, options = {}) {
  const maxVisibleChars = options.maxVisibleChars ?? 5000
  const maxModalChars = options.maxModalChars ?? 3500
  const modalBlocks = extractModalEvidenceBlocks(html, { maxBlocks: options.maxBlocks })
  const fullText = htmlToTextPreserveAlt(html)
  const visible_excerpt = fullText.slice(0, maxVisibleChars)
  const modal_excerpt = modalBlocks
    .map((b) => b.text)
    .join('\n\n')
    .slice(0, maxModalChars)
  const combined_excerpt = [
    visible_excerpt,
    modal_excerpt ? `--- manufacturer PDP modal/dialog evidence ---\n${modal_excerpt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 8000)

  return {
    visible_excerpt,
    modal_excerpt,
    modal_blocks: modalBlocks,
    combined_excerpt,
    has_lab_modal_evidence: /test\s*results\s*verified|non[-\s]?detect|3rd\s*party\s*lab/i.test(
      modal_excerpt,
    ),
    has_material_modal_evidence: /terrabond|pfas[-\s]?free|forever chemicals/i.test(
      combined_excerpt,
    ),
  }
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 */
export async function fetchManufacturerPdpHtml(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'PlasticIQ-Agent1/3.7 (manufacturer-pdp-modal)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  }
  return res.text()
}

/**
 * Fetch provided manufacturer PDP and extract visible + modal/dialog evidence.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 */
export async function fetchManufacturerPdpEvidence(url, options = {}) {
  const html = await fetchManufacturerPdpHtml(url, options)
  const excerpt = buildManufacturerPdpExcerpt(html, options)
  return { url, html_length: html.length, ...excerpt }
}

/**
 * @param {string} text
 */
export function textContainsLabModalEvidence(text) {
  return /test\s*results\s*verified|third[-\s]?party\s*lab|non[-\s]?detect.*pfos|pfos\s*passed\s*non[-\s]?detect/i.test(
    String(text ?? ''),
  )
}
