/**
 * Published-product display regression diff gate.
 */

import type { AprPublicRenderInput } from '../../types/apr'
import type { PublishedDisplaySnapshotRecord } from './publishedDisplaySnapshot'

export type DisplayFieldDiff = {
  product_id: string
  product_name?: string
  field_path: string
  frozen_value: unknown
  assembled_value: unknown
  likely_source?: string
}

export type DisplayRegressionManifestEntry = {
  product_id: string
  field_path: string
  reason: string
  requires_republish: boolean
}

export type DisplayRegressionManifest = {
  version: string
  expected_diffs: DisplayRegressionManifestEntry[]
}

const FIELD_SOURCE_HINTS: Record<string, string> = {
  'display.product_description': 'lib/apr/assembleDisplay.ts',
  'display.product_title': 'lib/apr/assembleDisplay.ts',
  'display.sources': 'lib/apr/assembleDisplay.ts',
  'display.buy_cta': 'lib/commerce/productCommerceLinks.ts',
  'display.secondary_materials': 'lib/apr/assembleDisplay.ts',
  'display.why_this_score': 'lib/apr/assembleDisplay.ts',
  'score.tier': 'lib/apr/assembleDisplay.ts',
  'score.transparency_badge': 'lib/apr/assembleDisplay.ts',
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function collectDiffs(
  productId: string,
  productName: string | undefined,
  path: string,
  frozen: unknown,
  assembled: unknown,
  out: DisplayFieldDiff[],
): void {
  if (Object.is(frozen, assembled)) return
  if (typeof frozen === 'string' && typeof assembled === 'string' && frozen === assembled) return

  if (Array.isArray(frozen) && Array.isArray(assembled)) {
    if (JSON.stringify(frozen) === JSON.stringify(assembled)) return
    out.push({
      product_id: productId,
      product_name: productName,
      field_path: path,
      frozen_value: frozen,
      assembled_value: assembled,
      likely_source: FIELD_SOURCE_HINTS[path],
    })
    return
  }

  if (isObject(frozen) && isObject(assembled)) {
    const keys = new Set([...Object.keys(frozen), ...Object.keys(assembled)])
    for (const key of keys) {
      if (key === 'buy_cta') continue
      collectDiffs(
        productId,
        productName,
        path ? `${path}.${key}` : key,
        frozen[key],
        assembled[key],
        out,
      )
    }
    return
  }

  out.push({
    product_id: productId,
    product_name: productName,
    field_path: path,
    frozen_value: frozen,
    assembled_value: assembled,
    likely_source: FIELD_SOURCE_HINTS[path],
  })
}

export function diffPublishedDisplayAgainstAssembly(
  snapshot: PublishedDisplaySnapshotRecord,
  assembled: AprPublicRenderInput,
  productName?: string,
): DisplayFieldDiff[] {
  const { buy_cta: _buyCta, ...assembledDisplay } = assembled.display
  const diffs: DisplayFieldDiff[] = []
  collectDiffs(snapshot.product_id, productName, 'display', snapshot.display, assembledDisplay, diffs)
  collectDiffs(snapshot.product_id, productName, 'score', snapshot.score, assembled.score, diffs)
  return diffs
}

export function filterUnexpectedDiffs(
  diffs: DisplayFieldDiff[],
  manifest: DisplayRegressionManifest,
): DisplayFieldDiff[] {
  return diffs.filter((d) => {
    return !manifest.expected_diffs.some(
      (e) => e.product_id === d.product_id && e.field_path === d.field_path,
    )
  })
}

export function formatDiffReport(diffs: DisplayFieldDiff[]): string {
  if (diffs.length === 0) return 'No diffs.'
  return diffs
    .map(
      (d) =>
        `- ${d.product_name ?? d.product_id} :: ${d.field_path}\n  frozen: ${JSON.stringify(d.frozen_value)?.slice(0, 120)}\n  assembled: ${JSON.stringify(d.assembled_value)?.slice(0, 120)}\n  source: ${d.likely_source ?? 'unknown'}`,
    )
    .join('\n')
}
