/**
 * Approved Gate 3 / product_scores truth for published baseline snapshots.
 * Used by baseline backfill and diff-gate — never by regression fixtures.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizationComponent, ProductEvidence, ScoringInputRow } from '../../types/agent'
import type { AprPublicRenderInput } from '../../types/apr'
import type { Product, ProductTier } from '../../types'
import type { ProductPageScore } from '../productScoresApi'
import { applyHazardSortToWhyThisScoreFields } from '../whyThisScoreSort'
import { CERT_VERIFICATION_ABSENT } from '../whyThisScoreVocabulary'
import type { WhyThisScoreFields } from '../whyThisScoreApi'
import {
  assembleAprPublicRenderInput,
  type AssembleDisplayInput,
} from './assembleDisplay'
import {
  createPublishedDisplaySnapshotRecord,
  stripCommerceFromRenderInput,
  type PublishedDisplaySnapshotRecord,
} from './publishedDisplaySnapshot'
import { PUBLISHED_BASELINE_PRODUCT_IDS, PUBLISHED_BASELINE_SLUGS } from './publishedBaselineIds'

export type ApprovedPublishedScoreTruth = {
  product_id: string
  pac_safety_score: number
  tier: ProductTier
  displayed_confidence_range: string | null
  transparency_badge: string | null
  score_id: string | null
  input_id: string | null
  run_timestamp: string | null
  source: 'product_scores' | 'get_product_page_score' | 'products_fallback'
}

export type PublishedBaselineSpec = {
  slug: (typeof PUBLISHED_BASELINE_SLUGS)[number]
  product_id: string
}

export const PUBLISHED_BASELINE_SPECS: PublishedBaselineSpec[] = [
  { slug: 'lodge', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.lodge },
  { slug: 'all-clad', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.allClad },
  { slug: 'caraway', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.caraway },
  { slug: 't-fal', product_id: PUBLISHED_BASELINE_PRODUCT_IDS.tfal },
]

export class ApprovedTruthMismatchError extends Error {
  constructor(
    message: string,
    readonly productId: string,
    readonly field: string,
    readonly expected: unknown,
    readonly actual: unknown,
  ) {
    super(message)
    this.name = 'ApprovedTruthMismatchError'
  }
}

function whyFieldsFromScoringInputRow(
  row: ScoringInputRow,
  components?: NormalizationComponent[] | null,
): WhyThisScoreFields | null {
  const primary = row.primary_material_options ?? []
  if (!Array.isArray(primary) || primary.length === 0) return null
  const fields: WhyThisScoreFields = {
    primary_material_options: primary,
    secondary_materials_options: row.secondary_materials_options ?? ['None'],
    coatings_finishes_options: row.coatings_finishes_options ?? ['None'],
    use_conditions_options: row.use_conditions_options ?? ['None'],
    disclosure_quality_options: row.disclosure_quality_options ?? ['None'],
    certifications_options: row.certifications_options ?? [CERT_VERIFICATION_ABSENT],
  }
  return applyHazardSortToWhyThisScoreFields(fields, components)
}

function parseRpcPageScore(data: unknown): ProductPageScore | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (typeof row.pac_safety_score !== 'number') return null
  const tier = String(row.tier ?? '').trim() as ProductTier
  if (!tier) return null
  return {
    pac_safety_score: row.pac_safety_score,
    tier,
    ingredient_transparency_score: null,
    displayed_confidence_range:
      typeof row.displayed_confidence_range === 'string'
        ? row.displayed_confidence_range.trim() || null
        : null,
    transparency_badge:
      typeof row.transparency_badge === 'string' ? row.transparency_badge.trim() || null : null,
    explanation_draft:
      typeof row.explanation_draft === 'string' ? row.explanation_draft.trim() || null : null,
  }
}

/** Load approved score truth — fail closed if missing. */
export async function loadApprovedPublishedScoreTruth(
  client: SupabaseClient,
  productId: string,
): Promise<ApprovedPublishedScoreTruth> {
  const { data: scoreRows, error: scoresError } = await client
    .from('product_scores')
    .select(
      'score_id, product_id, input_id, pac_safety_score, tier, displayed_confidence_range, transparency_badge, run_timestamp, review_status',
    )
    .eq('product_id', productId)
    .eq('review_status', 'approved')
    .order('run_timestamp', { ascending: false })
    .limit(1)

  if (scoresError) throw scoresError

  const approved = scoreRows?.[0]
  if (approved && typeof approved.pac_safety_score === 'number') {
    const tier = String(approved.tier ?? '').trim() as ProductTier
    if (!tier) throw new Error(`Approved product_scores row for ${productId} missing tier`)
    return {
      product_id: productId,
      pac_safety_score: approved.pac_safety_score,
      tier,
      displayed_confidence_range: approved.displayed_confidence_range?.trim() || null,
      transparency_badge: approved.transparency_badge?.trim() || null,
      score_id: approved.score_id ?? null,
      input_id: approved.input_id ?? null,
      run_timestamp: approved.run_timestamp ?? null,
      source: 'product_scores',
    }
  }

  const { data: rpcData, error: rpcError } = await client.rpc('get_product_page_score', {
    p_product_id: productId,
  })
  if (rpcError) throw rpcError
  const rpcScore = parseRpcPageScore(rpcData)
  if (rpcScore) {
    return {
      product_id: productId,
      pac_safety_score: rpcScore.pac_safety_score,
      tier: rpcScore.tier,
      displayed_confidence_range: rpcScore.displayed_confidence_range,
      transparency_badge: rpcScore.transparency_badge,
      score_id: null,
      input_id: null,
      run_timestamp: null,
      source: 'get_product_page_score',
    }
  }

  const { data: product, error: productError } = await client
    .from('products')
    .select('pac_safety_score, tier')
    .eq('product_id', productId)
    .maybeSingle()
  if (productError) throw productError
  if (product && typeof product.pac_safety_score === 'number') {
    const tier = String(product.tier ?? '').trim() as ProductTier
    if (!tier) throw new Error(`products row for ${productId} missing tier fallback`)
    return {
      product_id: productId,
      pac_safety_score: product.pac_safety_score,
      tier,
      displayed_confidence_range: null,
      transparency_badge: null,
      score_id: null,
      input_id: null,
      run_timestamp: null,
      source: 'products_fallback',
    }
  }

  throw new Error(
    `No approved published score truth for product ${productId} — product_scores, RPC, and products fallback all empty`,
  )
}

async function rpcWhyThisScore(
  client: SupabaseClient,
  productId: string,
): Promise<WhyThisScoreFields | null> {
  const { data, error } = await client.rpc('get_why_this_score', { p_product_id: productId })
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const parse = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []
  const fields: WhyThisScoreFields = {
    primary_material_options: parse(row.primary_material_options),
    secondary_materials_options: parse(row.secondary_materials_options),
    coatings_finishes_options: parse(row.coatings_finishes_options),
    use_conditions_options: parse(row.use_conditions_options),
    disclosure_quality_options: parse(row.disclosure_quality_options),
    certifications_options: parse(row.certifications_options),
  }
  if (!fields.primary_material_options.length) return null
  return fields
}

async function rpcProductDescription(
  client: SupabaseClient,
  productId: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('get_product_description', {
    p_product_id: productId,
  })
  if (error) throw error
  if (typeof data !== 'string') return null
  const trimmed = data.trim()
  return trimmed.length ? trimmed : null
}

async function rpcNormalizationComponents(
  client: SupabaseClient,
  productId: string,
): Promise<NormalizationComponent[] | null> {
  const { data, error } = await client.rpc('get_normalization_components', {
    p_product_id: productId,
  })
  if (error) throw error
  if (!data || !Array.isArray(data) || data.length === 0) return null
  return data as NormalizationComponent[]
}

async function rpcEvidencePack(
  client: SupabaseClient,
  productId: string,
): Promise<ProductEvidence | null> {
  const { data, error } = await client.rpc('get_product_evidence_display_pack', {
    p_product_id: productId,
  })
  if (error) {
    if (error.code === 'PGRST202' || /does not exist/i.test(error.message ?? '')) return null
    throw error
  }
  if (!data || typeof data !== 'object') return null
  return data as ProductEvidence
}

function approvedPageScoreFromTruth(truth: ApprovedPublishedScoreTruth): ProductPageScore {
  return {
    pac_safety_score: truth.pac_safety_score,
    tier: truth.tier,
    ingredient_transparency_score: null,
    displayed_confidence_range: truth.displayed_confidence_range,
    transparency_badge: truth.transparency_badge,
    explanation_draft: null,
  }
}

/** Load DB-backed assembly inputs for a published baseline product. */
export async function loadApprovedAssemblyInputFromDb(
  client: SupabaseClient,
  product: Product,
  approvedScore: ApprovedPublishedScoreTruth,
): Promise<AssembleDisplayInput> {
  const productId = product.product_id
  const [whyThisScore, productDescription, normalizationComponents, evidence] = await Promise.all([
    rpcWhyThisScore(client, productId),
    rpcProductDescription(client, productId),
    rpcNormalizationComponents(client, productId),
    rpcEvidencePack(client, productId),
  ])

  if (!whyThisScore && approvedScore.input_id) {
    const { data: inputRow, error } = await client
      .from('scoring_inputs')
      .select(
        'input_id, primary_material_options, secondary_materials_options, coatings_finishes_options, use_conditions_options, disclosure_quality_options, certifications_options, inputs',
      )
      .eq('input_id', approvedScore.input_id)
      .maybeSingle()
    if (error) throw error
    if (inputRow) {
      const components =
        normalizationComponents ??
        ((inputRow.inputs as { components?: NormalizationComponent[] } | null)?.components ??
          null)
      const fromInput = whyFieldsFromScoringInputRow(
        inputRow as ScoringInputRow,
        components,
      )
      if (fromInput) {
        return {
          product,
          evidence,
          pageScore: approvedPageScoreFromTruth(approvedScore),
          whyThisScore: fromInput,
          productDescription,
          normalizationComponents: components,
          rawSources: [],
        }
      }
    }
  }

  if (!whyThisScore) {
    throw new Error(
      `Missing Why This Score fields for published baseline product ${productId}`,
    )
  }

  return {
    product,
    evidence,
    pageScore: approvedPageScoreFromTruth(approvedScore),
    whyThisScore,
    productDescription,
    normalizationComponents,
    rawSources: [],
  }
}

/** Copy score block from approved truth — never recompute during snapshot creation. */
export function applyApprovedScoreToRenderInput(
  input: AprPublicRenderInput,
  approved: ApprovedPublishedScoreTruth,
): AprPublicRenderInput {
  return {
    ...input,
    score: {
      pac_safety_score: approved.pac_safety_score,
      tier: approved.tier,
      displayed_confidence_range: approved.displayed_confidence_range ?? '',
      transparency_badge: approved.transparency_badge ?? input.score.transparency_badge ?? '',
    },
  }
}

export function assertSnapshotScoreMatchesApprovedTruth(
  snapshotScore: AprPublicRenderInput['score'],
  approved: ApprovedPublishedScoreTruth,
  productId = approved.product_id,
): void {
  if (snapshotScore.pac_safety_score !== approved.pac_safety_score) {
    throw new ApprovedTruthMismatchError(
      `Snapshot score ${snapshotScore.pac_safety_score} !== approved ${approved.pac_safety_score} for ${productId}`,
      productId,
      'pac_safety_score',
      approved.pac_safety_score,
      snapshotScore.pac_safety_score,
    )
  }
  if (snapshotScore.tier !== approved.tier) {
    throw new ApprovedTruthMismatchError(
      `Snapshot tier ${snapshotScore.tier} !== approved ${approved.tier} for ${productId}`,
      productId,
      'tier',
      approved.tier,
      snapshotScore.tier,
    )
  }
  if (approved.displayed_confidence_range != null && approved.displayed_confidence_range !== '') {
    const snapRange = snapshotScore.displayed_confidence_range?.trim() || ''
    if (snapRange !== approved.displayed_confidence_range) {
      throw new ApprovedTruthMismatchError(
        `Snapshot range "${snapRange}" !== approved "${approved.displayed_confidence_range}" for ${productId}`,
        productId,
        'displayed_confidence_range',
        approved.displayed_confidence_range,
        snapRange,
      )
    }
  }
  if (approved.transparency_badge != null && approved.transparency_badge !== '') {
    const snapBadge = snapshotScore.transparency_badge?.trim() || ''
    if (snapBadge !== approved.transparency_badge) {
      throw new ApprovedTruthMismatchError(
        `Snapshot badge "${snapBadge}" !== approved "${approved.transparency_badge}" for ${productId}`,
        productId,
        'transparency_badge',
        approved.transparency_badge,
        snapBadge,
      )
    }
  }
}

export function assertPublishedSnapshotMatchesApprovedTruth(
  snapshot: PublishedDisplaySnapshotRecord,
  approved: ApprovedPublishedScoreTruth,
): void {
  assertSnapshotScoreMatchesApprovedTruth(snapshot.score, approved, snapshot.product_id)
}

/** Build a published display snapshot record from approved DB truth. */
export async function buildPublishedSnapshotFromApprovedTruth(
  client: SupabaseClient,
  product: Product,
  approvedScore: ApprovedPublishedScoreTruth,
  meta: { published_at: string; snapshot_id: string },
): Promise<PublishedDisplaySnapshotRecord> {
  const assemblyInput = await loadApprovedAssemblyInputFromDb(client, product, approvedScore)
  const assembled = await assembleAprPublicRenderInput(assemblyInput)
  if (!assembled) {
    throw new Error(`Assembly failed for published baseline product ${product.product_id}`)
  }

  const withApprovedScore = applyApprovedScoreToRenderInput(assembled, approvedScore)
  assertSnapshotScoreMatchesApprovedTruth(withApprovedScore.score, approvedScore)

  const payload = stripCommerceFromRenderInput(withApprovedScore, product.product_id, {
    published_at: meta.published_at,
  })
  assertSnapshotScoreMatchesApprovedTruth(payload.score, approvedScore)

  const record = createPublishedDisplaySnapshotRecord(payload, meta.snapshot_id)
  assertPublishedSnapshotMatchesApprovedTruth(record, approvedScore)
  return record
}
