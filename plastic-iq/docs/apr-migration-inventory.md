# APR Migration Inventory — Phase 1

**Purpose:** Map every field/string the public renderer currently derives to its future APR owner.  
**Contract:** [Approved Product Record Contract](./apr-contract-v1.md) (June 5, 2026)  
**Status:** Pre-migration baseline — renderer still authors strings; Phase 2 strips this.

---

## Ownership key

| Owner | Gate | Writes |
|-------|------|--------|
| `evidence` | Gate 1 / Agent 1 | Raw extraction, `source_role`, `variant_mismatch`, reviewed identity, canonical IDs |
| `normalization.components[]` | Gate 2 / Agent 2 | Scoring inputs only (hazard, migration, CI, severity, duration) |
| `display.*` | Gate 2 / Agent 2 | All public-facing authored strings |
| `score.*` | Gate 3 / Agent 3 | Score, tier, range, transparency badge (from Agent 2 inputs) |
| `qa.*` | Gate 4 / Agent 4 | Pass/fail checks, preflight result |
| `renderer` | — | Layout only (section chrome, aria, static UI shell) |

---

## Public page element → future APR field

| Public element | Current source (derived at render) | Future APR field | Owner |
|----------------|-----------------------------------|------------------|-------|
| Product title | `product.product_name` + evidence identity | `display.product_title` | Agent 2 |
| Primary material row | `whyThisScoreSort` + `whyThisScoreLabels` + `humanizePublicMaterialLabel` | `display.primary_material` | Agent 2 |
| Material caveat / disclosure sentence | `publicDisclosureGapCopy`, description rewrite | `display.disclosure_sentence` | Agent 2 |
| Product blurb | RPC description → `softenPublicDescription` → `rewritePublicDescriptionDisclosureGap` → `humanizePublicMaterialProse` | `display.product_description` | Agent 2 |
| Secondary materials list | `publicSecondaryMaterialLabels` merge components + stored options | `display.secondary_materials[]` | Agent 2 |
| Coatings & finishes | WTS options + humanization | `display.coatings` | Agent 2 |
| Use conditions | WTS options | `display.use_conditions[]` | Agent 2 |
| Disclosure quality | WTS + `normalizeDisclosureBadge` | `display.disclosure_quality` | Agent 2 |
| Cert/testing line | `publicCertificationAbsenceCopy` | `display.cert_line` | Agent 2 |
| Risk bars | `computeRiskDashboardMetrics` + `resolveMaterialStatusLabel` | `display.risk_bars[]` | Agent 2 |
| Sources (group, label, url, eligible) | Gate 1 review → `publicSourceDisplay` → `publicProductDisplayContract` → `publicSourceEligibility` | `display.sources[]` | Agent 2 |
| Buy CTA | `orderedRetailerLinks` + `primaryBuyLinkLabels` + `publicRetailerLinks` eligibility | `display.buy_cta[]` | Agent 2 |
| Why This Score rows | Full pipeline in `ProductPage` useMemo | `display.why_this_score.*` (or folded into display fields above) | Agent 2 |
| Score number | `productScoresApi` / `ProductPageScore` | `score.pac_safety_score` | Agent 3 |
| Tier | DB or `tierForScore(score)` fallback | `score.tier` | Agent 3 |
| Confidence range | DB | `score.displayed_confidence_range` | Agent 3 |
| Transparency badge | DB + `displayTransparencyBadge` normalize | `score.transparency_badge` | Agent 3 |
| Badge summary sentence | `transparencyBadgeSummary(badge)` | `display.badge_summary` (or omit if badge is sufficient) | Agent 2 |

---

## Derivation clusters to eliminate (Phase 2)

### 1. Public sources pipeline

**Files:** `gate1SourcesReview.ts`, `publicSourceDisplay.ts`, `publicProductDisplayContract.ts`, `publicSourceTitleFormat.ts`, `publicSourceEligibility.ts`, `retailerVariantMatch.ts`, `publicRetailerHostLabels.ts`, `productEvidenceApi.ts`

**Currently derives:** source group/label, title sanitization, eligibility, primary retailer upgrade, heuristic fallback when display pack missing.

**Future:** Gate 1 writes `source_role` + `variant_mismatch`. Agent 2 authors `display.sources[]` with `{ group, label, url, public_source_eligible }`. Renderer prints verbatim.

### 2. Product description pipeline

**Files:** `publicProductDisplay.ts`, `nonPacInertMaterials.ts`, `publicDisclosureGapCopy.ts`, `publicMaterialProse.ts`, `ProductPage.tsx`

**Currently derives:** soften regexes, gap phrase swap, material prose humanization.

**Future:** Agent 2 emits final `display.product_description`. Renderer prints verbatim.

### 3. Why This Score pipeline

**Files:** `whyThisScoreSort.ts`, `whyThisScoreLabels.ts`, `whyThisScorePublicDisplay.ts`, `publicMaterialProse.ts`, `publicProductDisplayContract.ts`, `primaryContactMaterials.ts`, `WhyThisScore.tsx`

**Currently derives:** hazard sort, label map, secondary merge, cert-absent copy, graphite footnote.

**Future:** Agent 2 emits all display strings. Renderer prints verbatim.

### 4. Retailer / buy CTA pipeline

**Files:** `retailerLinks.ts`, `publicRetailerLinks.ts`, `publicRetailerHostLabels.ts`, `RetailerBuyButtons.tsx`

**Currently derives:** host → label, tier → buy/view, Gate 1 eligibility filter.

**Future:** Agent 2 emits `display.buy_cta[]`. Renderer prints verbatim.

### 5. Risk dashboard pipeline

**Files:** `riskDashboard.ts`, `riskMeasureCopy.ts`, `RiskDashboard.tsx`

**Currently derives:** status labels, polarity, PTFE/coating suffixes from components + badge.

**Future:** Agent 2 emits `display.risk_bars[]`. Renderer prints fill + label + color verbatim.

### 6. Score / tier fallback

**Files:** `score.ts`, `ProductPage.tsx`

**Currently derives:** `tierForScore` when DB tier absent.

**Future:** Agent 3 owns tier; renderer never computes.

---

## Renderer files — forbidden import targets (Phase 2)

These modules must not be imported by public renderer after Phase 2:

| Module | Reason |
|--------|--------|
| `publicProductDisplayContract` | Source title + contract derivation |
| `publicSourceDisplay` | Gate 1 → public source assembly |
| `publicSourceEligibility` | Variant eligibility heuristics |
| `publicSourceTitleFormat` | Title sanitize/fallback |
| `publicMaterialProse` | Material string humanization |
| `publicDisclosureGapCopy` | Disclosure sentence authoring |
| `publicProductDisplay` | Description soften/rewrite |
| `whyThisScorePublicDisplay` | WTS public shaping |
| `whyThisScoreSort` | Hazard sort |
| `whyThisScoreLabels` | material_id → label map |
| `primaryContactMaterials` | Contact material derivation |
| `publicRetailerLinks` | CTA eligibility |
| `retailerLinks` | Buy label heuristics |
| `publicRetailerHostLabels` | Host → retailer name |
| `retailerVariantMatch` | Variant matching |
| `gate1SourcesReview` | Gate 1 audit model |
| `nonPacInertMaterials` | Description rewrite |
| `materialTaxonomy` | Taxonomy maps |
| `riskDashboard` | Risk label computation |
| `transparencyBadge` | Badge summary derivation |

**Renderer scope (scan targets):** `ProductPage.tsx`, `Sources.tsx`, `WhyThisScore.tsx`, `RiskDashboard.tsx`, `RetailerBuyButtons.tsx`, `TransparencyBadge.tsx`

**Allowed in renderer:** layout components, `score.*` numeric/tier display (verbatim), static section chrome, aria assembly from owned strings.

---

## Namespace split: `components[]` vs `display.*`

| Today (conflated) | Future |
|-------------------|--------|
| `NormalizationComponent[]` read by Agent 3 and renderer (via label maps) | `normalization.components[]` — Agent 3 only |
| `secondary_materials_options` + component merge in renderer | `display.secondary_materials[]` — renderer only |
| `whyThisScoreLabels` maps material_id at render | Agent 2 writes display names at Gate 2 |
| `computeRiskDashboardMetrics(normalizationComponents)` | Agent 2 writes `display.risk_bars[]` |

**Invariant:** Renderer must not import or read `normalization.components[]`. Preflight + ownership tests enforce this in Phase 1; renderer migration in Phase 2.

---

## Gate 1 fields to add (Phase 3+ / evidence schema)

| Field | Owner | Notes |
|-------|-------|-------|
| `source_role` | Gate 1 | Closed vocab: `retailer_primary`, `retailer_supporting`, `manufacturer`, `context` |
| `variant_mismatch` | Gate 1 | Per source; reviewed listing identity wins |
| Reviewed variant (size/SKU/model) | Gate 1 | On product identity |

---

## Persistence mapping (existing → APR snapshots)

| Existing table | APR gate snapshot |
|----------------|-------------------|
| `product_evidence` (approved) | `evidence` |
| `scoring_inputs` (approved) + display payload | `normalization` + `display` |
| `product_scores` (approved) | `score` |
| `product_qa` (approved) | `qa` |
| New: `approved_product_records` | Assembled APR with hash chain |

---

## Phase 1 deliverables (this document + code)

- [x] Migration inventory (this file)
- [x] APR TypeScript schema (`src/types/apr.ts`)
- [x] Content hash + snapshot chain (`src/lib/apr/`)
- [x] Ownership tests + renderer forbidden-import baseline (`scripts/test-apr-*.mjs`)
- [x] DB migration stub (`supabase/migrations/0037_apr_snapshots.sql`)

**Not in Phase 1:** Renderer migration, Agent 2 display authoring, preflight gate, Layer A/B fixtures.

**Phase 2 (complete):** Public renderer reads `display.*` + `score.*` via `fetchAprPublicRenderInput`. String authorship moved to `src/lib/apr/assembleDisplay.ts` (Agent 2 territory). Renderer forbidden-import scan passes with zero violations.
