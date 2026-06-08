/**
 * Part C fixtures — description override workflow (not live T-Fal/Caraway product ids).
 */

import type { ApprovedProductRecord } from '../../../types/apr'
import {
  createPublishedDisplaySnapshotRecord,
  PUBLISHED_DISPLAY_CONTRACT_VERSION,
  type PublishedDisplaySnapshotRecord,
} from '../publishedDisplaySnapshot'
import { buildLowScorePtfePatternFixtureApr } from './lowScorePtfePattern.fixture'
import { buildLowScoreUncertaintyPatternFixtureApr } from './lowScoreUncertaintyPattern.fixture'
import { buildTwelveInchSkilletFixtureApr } from './twelveInchSkillet.fixture'

export const FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID = 'fixture-desc-override-ptfe-test'
export const FIXTURE_DESC_OVERRIDE_UNCERTAINTY_PRODUCT_ID = 'fixture-desc-override-uncertainty-test'
export const FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID = 'fixture-desc-override-high-score-test'

export const PTFE_UNSAFE_OVERRIDE_TEXT =
  'T-Fal markets this product as non-toxic, but reviewed materials contradict that marketing claim.'

export const PTFE_SAFE_OVERRIDE_TEXT =
  'Reviewed product materials identify PTFE nonstick coating in the food-contact layer. This product scores lower under the PAC Safety Score methodology because the score reflects food-contact coating material, use conditions, and disclosure quality.'

export const UNCERTAINTY_UNSAFE_OVERRIDE_TEXT = 'The product contains a confirmed chemical hazard.'

export const UNCERTAINTY_SAFE_OVERRIDE_TEXT =
  "This product's score reflects incomplete public disclosure for some material details under the PAC Safety Score methodology. The score reflects uncertainty and disclosure quality, not a confirmed safety finding."

export function aprRecordToPublishedSnapshot(
  record: ApprovedProductRecord,
  snapshotId: string,
): PublishedDisplaySnapshotRecord {
  const { buy_cta: _buyCta, ...displayWithoutCommerce } = record.display.payload
  return createPublishedDisplaySnapshotRecord(
    {
      contract_version: PUBLISHED_DISPLAY_CONTRACT_VERSION,
      published_at: record.assembled_at,
      product_id: record.product_id,
      evidence_content_hash: record.evidence.content_hash,
      normalization_content_hash: record.normalization.content_hash,
      display_content_hash: record.display.content_hash,
      score_content_hash: record.score.content_hash,
      assembled_content_hash: record.assembled_content_hash,
      display: displayWithoutCommerce,
      score: {
        pac_safety_score: record.score.payload.pac_safety_score,
        tier: record.score.payload.tier,
        displayed_confidence_range: record.score.payload.displayed_confidence_range,
        transparency_badge: record.score.payload.transparency_badge,
      },
    },
    snapshotId,
  )
}

export function buildPtfeDescriptionOverrideFixtureSnapshot(): PublishedDisplaySnapshotRecord {
  const apr = buildLowScorePtfePatternFixtureApr()
  apr.product_id = FIXTURE_DESC_OVERRIDE_PTFE_PRODUCT_ID
  return aprRecordToPublishedSnapshot(apr, 'snap-fixture-desc-override-ptfe-baseline')
}

export function buildUncertaintyDescriptionOverrideFixtureSnapshot(): PublishedDisplaySnapshotRecord {
  const apr = buildLowScoreUncertaintyPatternFixtureApr()
  apr.product_id = FIXTURE_DESC_OVERRIDE_UNCERTAINTY_PRODUCT_ID
  return aprRecordToPublishedSnapshot(apr, 'snap-fixture-desc-override-uncertainty-baseline')
}

export function buildHighScoreDescriptionOverrideFixtureSnapshot(): PublishedDisplaySnapshotRecord {
  const apr = structuredClone(buildTwelveInchSkilletFixtureApr())
  apr.product_id = FIXTURE_DESC_OVERRIDE_HIGH_SCORE_PRODUCT_ID
  apr.score.payload.pac_safety_score = 92
  apr.score.payload.tier = 'Excellent'
  return aprRecordToPublishedSnapshot(apr, 'snap-fixture-desc-override-high-score-baseline')
}
