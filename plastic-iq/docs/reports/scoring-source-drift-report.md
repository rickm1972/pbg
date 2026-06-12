# Scoring Source Drift Report (read-only)

## Part I — Summary by value family
| Value family | Total | Matches | Mismatches | Missing active in code | Future category not in code | Missing in source | Needs Rick review |
|---|---:|---:|---:|---:|---:|---:|---:|
| materials | 395 | 123 | 0 | 0 | 220 | 0 | 45 |
| subcategory_defaults | 22 | 22 | 0 | 0 | 0 | 0 | 0 |
| layer4a | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| escalators | 9 | 5 | 0 | 0 | 0 | 0 | 4 |
| methodology | 15 | 15 | 0 | 0 | 0 | 0 | 0 |

## Priority mismatch table (non-MATCH only)
| priority | value family | value name | code | source | status | code location | source location |
|---|---|---|---|---|---|---|---|
| NEEDS_RICK_REVIEW | escalators | 1 — High hazard + high severity, adult | see normalize-enforce + escalator-eligibility.mjs | Migration ≥ 0.60 AND Severity ≥ 0.88 AND not children's | NEEDS_RICK_REVIEW | src/shared/agent3/escalator-eligibility.mjs | PAC_Scoring_Algorithm_v2.3.5.docx / Escalators table |
| NEEDS_RICK_REVIEW | escalators | 2 — High hazard + high severity, children's | see normalize-enforce + escalator-eligibility.mjs | Migration ≥ 0.60 AND Severity ≥ 0.88 AND children's | NEEDS_RICK_REVIEW | src/shared/agent3/escalator-eligibility.mjs | PAC_Scoring_Algorithm_v2.3.5.docx / Escalators table |
| NEEDS_RICK_REVIEW | escalators | 4 — Oral contact extreme-risk material | see normalize-enforce + escalator-eligibility.mjs | Contact Intimacy 1.0 oral AND Hazard ≥ 0.80 | NEEDS_RICK_REVIEW | src/shared/agent3/escalator-eligibility.mjs | PAC_Scoring_Algorithm_v2.3.5.docx / Escalators table |
| NEEDS_RICK_REVIEW | escalators | PFAS/PTFE high-risk escalator (gated) | escalator_1 gated to confirmed PFAS/PTFE family (escalator-eligibility.mjs) | PFAS/PTFE escalator fires only on confirmed PFAS/PTFE-family material | NEEDS_RICK_REVIEW | src/shared/agent3/escalator-eligibility.mjs:87 | PAC v2.3.5 intro paragraphs |
| NEEDS_RICK_REVIEW | materials | aluminum_core | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Aluminum core |
| NEEDS_RICK_REVIEW | materials | bamboo_lid_silicone | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Bamboo lid with silicone seal |
| NEEDS_RICK_REVIEW | materials | bamboo_natural | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural bamboo (solid) |
| NEEDS_RICK_REVIEW | materials | bare_copper_acidic_food_contact | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Bare copper (acidic-food contact) |
| NEEDS_RICK_REVIEW | materials | borosilicate_glass | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Borosilicate glass |
| NEEDS_RICK_REVIEW | materials | bpa_free_plastic_lid | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=BPA-free plastic lid |
| NEEDS_RICK_REVIEW | materials | bpa_free_plastic_unspecified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=BPA-free plastic (resin unspecified) |
| NEEDS_RICK_REVIEW | materials | carbon_steel | Carbon steel | alias of cast_iron (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:carbon_steel | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | cast_iron | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Cast iron / pre-seasoned / carbon steel |
| NEEDS_RICK_REVIEW | materials | cast_iron_integrated_handle | Integrated cast iron handle | alias of cast_iron (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:cast_iron_integrated_handle | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | cast_iron_seasoned | Cast iron (pre-seasoned with natural vegetable oil) | alias of cast_iron (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:cast_iron_seasoned | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | ceramic_nonstick_sol_gel | heuristic (see material-lookup-audit.mjs) | Yes | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Ceramic nonstick sol-gel coating |
| NEEDS_RICK_REVIEW | materials | food_grade_copper_lined | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Food-grade copper (lined) |
| NEEDS_RICK_REVIEW | materials | food_safe_ceramic_verified_glaze | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Food-safe ceramic (verified glaze) |
| NEEDS_RICK_REVIEW | materials | graphite_core | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Graphite structural core |
| NEEDS_RICK_REVIEW | materials | hard_anodized_aluminum | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Hard anodized aluminum |
| NEEDS_RICK_REVIEW | materials | hdpe | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=HDPE |
| NEEDS_RICK_REVIEW | materials | hybrid_stainless_nonstick_food_contact | heuristic (see material-lookup-audit.mjs) | Yes | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Hybrid stainless lattice + nonstick surface |
| NEEDS_RICK_REVIEW | materials | laser_etched_stainless_surface | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Laser-etched stainless cooking surface |
| NEEDS_RICK_REVIEW | materials | magnetic_stainless_base | Magnetic stainless steel base | alias of stainless_steel_304 (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:magnetic_stainless_base | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | nylon_food_contact | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Nylon food-contact |
| NEEDS_RICK_REVIEW | materials | plant_based_formulation | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Plant-based formulation |
| NEEDS_RICK_REVIEW | materials | plant_mineral_formulation | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Plant- and mineral-based aqueous formulation |
| NEEDS_RICK_REVIEW | materials | plastic_lid_unspecified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Plastic lid (resin unspecified) |
| NEEDS_RICK_REVIEW | materials | proprietary_named_food_contact | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Unknown proprietary food-contact coating |
| NEEDS_RICK_REVIEW | materials | ptfe_coating | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE coating (lower band) |
| NEEDS_RICK_REVIEW | materials | ptfe_nonstick | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE nonstick coating |
| NEEDS_RICK_REVIEW | materials | ptfe_nonstick_titanium_reinforced | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE nonstick coating (titanium reinforced) |
| NEEDS_RICK_REVIEW | materials | refill_container_hdpe_unspecified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Refill container (HDPE or similar) |
| NEEDS_RICK_REVIEW | materials | silicone_gasket_unverified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Silicone gasket (unverified) |
| NEEDS_RICK_REVIEW | materials | silicone_gasket_verified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Silicone gasket (food-grade verified) |
| NEEDS_RICK_REVIEW | materials | silicone_over_riveted_base | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Silicone-coated handle |
| NEEDS_RICK_REVIEW | materials | stainless_steel_304 | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Stainless steel 304 |
| NEEDS_RICK_REVIEW | materials | stainless_steel_316 | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Stainless steel 316 |
| NEEDS_RICK_REVIEW | materials | stainless_steel_handle | Stainless steel handle | alias of stainless_steel_304 (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:stainless_steel_handle | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | stainless_steel_rivets | Stainless steel rivets | alias of stainless_steel_304 (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:stainless_steel_rivets | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | stainless_steel_unspecified | 0.03 | 0.06 | NEEDS_RICK_REVIEW | scripts/agent2/deterministic/material-taxonomy.mjs:stainless_steel_unspecified | PBG_Material_Lookup.xlsx / Material Lookup / row material=Recycled stainless steel (verified) |
| NEEDS_RICK_REVIEW | materials | stainless_steel_unspecified | 0.02 | 0.06 | NEEDS_RICK_REVIEW | scripts/agent2/deterministic/material-taxonomy.mjs:stainless_steel_unspecified | PBG_Material_Lookup.xlsx / Material Lookup / row material=Recycled stainless steel (verified) |
| NEEDS_RICK_REVIEW | materials | stainless_steel_unspecified | Inert | Natural low risk | NEEDS_RICK_REVIEW | scripts/agent2/deterministic/material-taxonomy.mjs:stainless_steel_unspecified | PBG_Material_Lookup.xlsx / Material Lookup / row material=Recycled stainless steel (verified) |
| NEEDS_RICK_REVIEW | materials | stainless_steel_unspecified | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Recycled stainless steel (verified) |
| NEEDS_RICK_REVIEW | materials | stay_cool_handle_undisclosed | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Stay-cool handle (undisclosed, inferred SS304) |
| NEEDS_RICK_REVIEW | materials | synthetic_surfactant_formulation | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Synthetic surfactant formulation |
| NEEDS_RICK_REVIEW | materials | teak_wood | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural teak wood |
| NEEDS_RICK_REVIEW | materials | tempered_glass | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Soda-lime glass |
| NEEDS_RICK_REVIEW | materials | tempered_glass_lid | Tempered glass lid | alias of tempered_glass (combined lookup row) | ALIAS_ONLY | scripts/agent2/deterministic/material-taxonomy.mjs:tempered_glass_lid | PBG_Material_Lookup.xlsx |
| NEEDS_RICK_REVIEW | materials | terrabond_proprietary | heuristic (see material-lookup-audit.mjs) | Yes | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Proprietary ceramic nonstick (TerraBond) |
| NEEDS_RICK_REVIEW | materials | thermolon_ceramic | heuristic (see material-lookup-audit.mjs) | Yes | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Thermolon ceramic coating |
| NEEDS_RICK_REVIEW | materials | titanium | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Titanium |
| NEEDS_RICK_REVIEW | materials | tpr_soft_grip_handle | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=TPR soft-grip handle |
| NEEDS_RICK_REVIEW | materials | tritan | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Tritan copolyester |
| NEEDS_RICK_REVIEW | materials | vegetable_oil_seasoning | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Vegetable oil seasoning |
| NEEDS_RICK_REVIEW | materials | vitreous_enamel | heuristic (see material-lookup-audit.mjs) | No | NEEDS_RICK_REVIEW | scripts/lib/material-lookup-audit.mjs:39 | PBG_Material_Lookup.xlsx / Material Lookup / row material=Vitreous enamel |
| CLEANUP_LATER | materials | 100% organic cotton | None | 0.07 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic cotton |
| CLEANUP_LATER | materials | 100% organic cotton | None | 0.06 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic cotton |
| CLEANUP_LATER | materials | 100% organic cotton | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic cotton |
| CLEANUP_LATER | materials | 100% organic cotton | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic cotton |
| CLEANUP_LATER | materials | 100% organic cotton | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic cotton |
| CLEANUP_LATER | materials | 100% organic linen | None | 0.07 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic linen |
| CLEANUP_LATER | materials | 100% organic linen | None | 0.06 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic linen |
| CLEANUP_LATER | materials | 100% organic linen | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic linen |
| CLEANUP_LATER | materials | 100% organic linen | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic linen |
| CLEANUP_LATER | materials | 100% organic linen | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic linen |
| CLEANUP_LATER | materials | 100% organic wool | None | 0.08 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic wool |
| CLEANUP_LATER | materials | 100% organic wool | None | 0.07 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic wool |
| CLEANUP_LATER | materials | 100% organic wool | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic wool |
| CLEANUP_LATER | materials | 100% organic wool | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic wool |
| CLEANUP_LATER | materials | 100% organic wool | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=100% organic wool |
| CLEANUP_LATER | materials | ABS plastic | None | 0.28 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=ABS plastic |
| CLEANUP_LATER | materials | ABS plastic | None | 0.35 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=ABS plastic |
| CLEANUP_LATER | materials | ABS plastic | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=ABS plastic |
| CLEANUP_LATER | materials | ABS plastic | None | Lower-risk synthetic | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=ABS plastic |
| CLEANUP_LATER | materials | ABS plastic | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=ABS plastic |
| CLEANUP_LATER | materials | Acrylic (PMMA) | None | 0.25 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic (PMMA) |
| CLEANUP_LATER | materials | Acrylic (PMMA) | None | 0.22 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic (PMMA) |
| CLEANUP_LATER | materials | Acrylic (PMMA) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic (PMMA) |
| CLEANUP_LATER | materials | Acrylic (PMMA) | None | Lower-risk synthetic | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic (PMMA) |
| CLEANUP_LATER | materials | Acrylic (PMMA) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic (PMMA) |
| CLEANUP_LATER | materials | Acrylic fabric (polyacrylonitrile) | None | 0.42 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic fabric (polyacrylonitrile) |
| CLEANUP_LATER | materials | Acrylic fabric (polyacrylonitrile) | None | 0.25 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic fabric (polyacrylonitrile) |
| CLEANUP_LATER | materials | Acrylic fabric (polyacrylonitrile) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic fabric (polyacrylonitrile) |
| CLEANUP_LATER | materials | Acrylic fabric (polyacrylonitrile) | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic fabric (polyacrylonitrile) |
| CLEANUP_LATER | materials | Acrylic fabric (polyacrylonitrile) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Acrylic fabric (polyacrylonitrile) |
| CLEANUP_LATER | materials | Azo-dye-treated textiles | None | 0.82 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Azo-dye-treated textiles |
| CLEANUP_LATER | materials | Azo-dye-treated textiles | None | 0.7 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Azo-dye-treated textiles |
| CLEANUP_LATER | materials | Azo-dye-treated textiles | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Azo-dye-treated textiles |
| CLEANUP_LATER | materials | Azo-dye-treated textiles | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Azo-dye-treated textiles |
| CLEANUP_LATER | materials | Azo-dye-treated textiles | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Azo-dye-treated textiles |
| CLEANUP_LATER | materials | Brominated flame retardants | None | 0.9 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Brominated flame retardants |
| CLEANUP_LATER | materials | Brominated flame retardants | None | 0.8 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Brominated flame retardants |
| CLEANUP_LATER | materials | Brominated flame retardants | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Brominated flame retardants |
| CLEANUP_LATER | materials | Brominated flame retardants | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Brominated flame retardants |
| CLEANUP_LATER | materials | Brominated flame retardants | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Brominated flame retardants |
| CLEANUP_LATER | materials | Conventional cotton (non-organic) | None | 0.12 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional cotton (non-organic) |
| CLEANUP_LATER | materials | Conventional cotton (non-organic) | None | 0.15 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional cotton (non-organic) |
| CLEANUP_LATER | materials | Conventional cotton (non-organic) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional cotton (non-organic) |
| CLEANUP_LATER | materials | Conventional cotton (non-organic) | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional cotton (non-organic) |
| CLEANUP_LATER | materials | Conventional cotton (non-organic) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional cotton (non-organic) |
| CLEANUP_LATER | materials | Conventional linen | None | 0.1 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional linen |
| CLEANUP_LATER | materials | Conventional linen | None | 0.12 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional linen |
| CLEANUP_LATER | materials | Conventional linen | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional linen |
| CLEANUP_LATER | materials | Conventional linen | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional linen |
| CLEANUP_LATER | materials | Conventional linen | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Conventional linen |
| CLEANUP_LATER | materials | Fiberglass | None | 0.6 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Fiberglass |
| CLEANUP_LATER | materials | Fiberglass | None | 0.3 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Fiberglass |
| CLEANUP_LATER | materials | Fiberglass | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Fiberglass |
| CLEANUP_LATER | materials | Fiberglass | None | High | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Fiberglass |
| CLEANUP_LATER | materials | Fiberglass | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Fiberglass |
| CLEANUP_LATER | materials | Flame-retardant-treated materials | None | 0.85 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Flame-retardant-treated materials |
| CLEANUP_LATER | materials | Flame-retardant-treated materials | None | 0.75 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Flame-retardant-treated materials |
| CLEANUP_LATER | materials | Flame-retardant-treated materials | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Flame-retardant-treated materials |
| CLEANUP_LATER | materials | Flame-retardant-treated materials | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Flame-retardant-treated materials |
| CLEANUP_LATER | materials | Flame-retardant-treated materials | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Flame-retardant-treated materials |
| CLEANUP_LATER | materials | Formaldehyde-treated textiles | None | 0.85 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Formaldehyde-treated textiles |
| CLEANUP_LATER | materials | Formaldehyde-treated textiles | None | 0.7 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Formaldehyde-treated textiles |
| CLEANUP_LATER | materials | Formaldehyde-treated textiles | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Formaldehyde-treated textiles |
| CLEANUP_LATER | materials | Formaldehyde-treated textiles | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Formaldehyde-treated textiles |
| CLEANUP_LATER | materials | Formaldehyde-treated textiles | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Formaldehyde-treated textiles |
| CLEANUP_LATER | materials | LDPE | None | 0.2 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=LDPE |
| CLEANUP_LATER | materials | LDPE | None | 0.32 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=LDPE |
| CLEANUP_LATER | materials | LDPE | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=LDPE |
| CLEANUP_LATER | materials | LDPE | None | Lower-risk synthetic | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=LDPE |
| CLEANUP_LATER | materials | LDPE | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=LDPE |
| CLEANUP_LATER | materials | Melamine (melamine-formaldehyde resin) | None | 0.55 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Melamine (melamine-formaldehyde resin) |
| CLEANUP_LATER | materials | Melamine (melamine-formaldehyde resin) | None | 0.6 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Melamine (melamine-formaldehyde resin) |
| CLEANUP_LATER | materials | Melamine (melamine-formaldehyde resin) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Melamine (melamine-formaldehyde resin) |
| CLEANUP_LATER | materials | Melamine (melamine-formaldehyde resin) | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Melamine (melamine-formaldehyde resin) |
| CLEANUP_LATER | materials | Melamine (melamine-formaldehyde resin) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Melamine (melamine-formaldehyde resin) |
| CLEANUP_LATER | materials | Modal | None | 0.35 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Modal |
| CLEANUP_LATER | materials | Modal | None | 0.2 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Modal |
| CLEANUP_LATER | materials | Modal | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Modal |
| CLEANUP_LATER | materials | Modal | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Modal |
| CLEANUP_LATER | materials | Modal | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Modal |
| CLEANUP_LATER | materials | Natural cork | None | 0.06 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural cork |
| CLEANUP_LATER | materials | Natural cork | None | 0.08 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural cork |
| CLEANUP_LATER | materials | Natural cork | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural cork |
| CLEANUP_LATER | materials | Natural cork | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural cork |
| CLEANUP_LATER | materials | Natural cork | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural cork |
| CLEANUP_LATER | materials | Natural hemp | None | 0.07 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural hemp |
| CLEANUP_LATER | materials | Natural hemp | None | 0.06 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural hemp |
| CLEANUP_LATER | materials | Natural hemp | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural hemp |
| CLEANUP_LATER | materials | Natural hemp | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural hemp |
| CLEANUP_LATER | materials | Natural hemp | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural hemp |
| CLEANUP_LATER | materials | Natural latex | None | 0.1 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural latex |
| CLEANUP_LATER | materials | Natural latex | None | 0.14 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural latex |
| CLEANUP_LATER | materials | Natural latex | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural latex |
| CLEANUP_LATER | materials | Natural latex | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural latex |
| CLEANUP_LATER | materials | Natural latex | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural latex |
| CLEANUP_LATER | materials | Natural rubber | None | 0.1 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural rubber |
| CLEANUP_LATER | materials | Natural rubber | None | 0.14 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural rubber |
| CLEANUP_LATER | materials | Natural rubber | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural rubber |
| CLEANUP_LATER | materials | Natural rubber | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural rubber |
| CLEANUP_LATER | materials | Natural rubber | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural rubber |
| CLEANUP_LATER | materials | Natural wood (food-safe oil finish) | None | 0.08 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural wood (food-safe oil finish) |
| CLEANUP_LATER | materials | Natural wood (food-safe oil finish) | None | 0.1 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural wood (food-safe oil finish) |
| CLEANUP_LATER | materials | Natural wood (food-safe oil finish) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural wood (food-safe oil finish) |
| CLEANUP_LATER | materials | Natural wood (food-safe oil finish) | None | Natural low risk | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural wood (food-safe oil finish) |
| CLEANUP_LATER | materials | Natural wood (food-safe oil finish) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Natural wood (food-safe oil finish) |
| CLEANUP_LATER | materials | PFAS-treated fabric or coating | None | 0.92 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PFAS-treated fabric or coating |
| CLEANUP_LATER | materials | PFAS-treated fabric or coating | None | 0.85 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PFAS-treated fabric or coating |
| CLEANUP_LATER | materials | PFAS-treated fabric or coating | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PFAS-treated fabric or coating |
| CLEANUP_LATER | materials | PFAS-treated fabric or coating | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PFAS-treated fabric or coating |
| CLEANUP_LATER | materials | PFAS-treated fabric or coating | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PFAS-treated fabric or coating |
| CLEANUP_LATER | materials | PTFE-ceramic hybrid coating | None | 0.4 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE-ceramic hybrid coating |
| CLEANUP_LATER | materials | PTFE-ceramic hybrid coating | None | 0.45 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE-ceramic hybrid coating |
| CLEANUP_LATER | materials | PTFE-ceramic hybrid coating | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE-ceramic hybrid coating |
| CLEANUP_LATER | materials | PTFE-ceramic hybrid coating | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE-ceramic hybrid coating |
| CLEANUP_LATER | materials | PTFE-ceramic hybrid coating | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PTFE-ceramic hybrid coating |
| CLEANUP_LATER | materials | PU leather | None | 0.65 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PU leather |
| CLEANUP_LATER | materials | PU leather | None | 0.55 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PU leather |
| CLEANUP_LATER | materials | PU leather | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PU leather |
| CLEANUP_LATER | materials | PU leather | None | High | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PU leather |
| CLEANUP_LATER | materials | PU leather | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PU leather |
| CLEANUP_LATER | materials | PVC (polyvinyl chloride) | None | 0.9 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PVC (polyvinyl chloride) |
| CLEANUP_LATER | materials | PVC (polyvinyl chloride) | None | 0.85 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PVC (polyvinyl chloride) |
| CLEANUP_LATER | materials | PVC (polyvinyl chloride) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PVC (polyvinyl chloride) |
| CLEANUP_LATER | materials | PVC (polyvinyl chloride) | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PVC (polyvinyl chloride) |
| CLEANUP_LATER | materials | PVC (polyvinyl chloride) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=PVC (polyvinyl chloride) |
| CLEANUP_LATER | materials | Polycarbonate (BPA-free marketed) | None | 0.5 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (BPA-free marketed) |
| CLEANUP_LATER | materials | Polycarbonate (BPA-free marketed) | None | 0.5 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (BPA-free marketed) |
| CLEANUP_LATER | materials | Polycarbonate (BPA-free marketed) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (BPA-free marketed) |
| CLEANUP_LATER | materials | Polycarbonate (BPA-free marketed) | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (BPA-free marketed) |
| CLEANUP_LATER | materials | Polycarbonate (BPA-free marketed) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (BPA-free marketed) |
| CLEANUP_LATER | materials | Polycarbonate (confirmed BPA) | None | 0.88 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (confirmed BPA) |
| CLEANUP_LATER | materials | Polycarbonate (confirmed BPA) | None | 0.8 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (confirmed BPA) |
| CLEANUP_LATER | materials | Polycarbonate (confirmed BPA) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (confirmed BPA) |
| CLEANUP_LATER | materials | Polycarbonate (confirmed BPA) | None | Extreme | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (confirmed BPA) |
| CLEANUP_LATER | materials | Polycarbonate (confirmed BPA) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polycarbonate (confirmed BPA) |
| CLEANUP_LATER | materials | Polyester fabric (PET textile) | None | 0.38 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polyester fabric (PET textile) |
| CLEANUP_LATER | materials | Polyester fabric (PET textile) | None | 0.3 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polyester fabric (PET textile) |
| CLEANUP_LATER | materials | Polyester fabric (PET textile) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polyester fabric (PET textile) |
| CLEANUP_LATER | materials | Polyester fabric (PET textile) | None | Moderate | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polyester fabric (PET textile) |
| CLEANUP_LATER | materials | Polyester fabric (PET textile) | None | future_category | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polyester fabric (PET textile) |
| CLEANUP_LATER | materials | Polypropylene (PP5) | None | 0.2 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polypropylene (PP5) |
| CLEANUP_LATER | materials | Polypropylene (PP5) | None | 0.25 | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polypropylene (PP5) |
| CLEANUP_LATER | materials | Polypropylene (PP5) | None | No | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polypropylene (PP5) |
| CLEANUP_LATER | materials | Polypropylene (PP5) | None | Lower-risk synthetic | FUTURE_CATEGORY_NOT_IN_CODE | None | PBG_Material_Lookup.xlsx / Material Lookup / row material=Polypropylene (PP5) |

… 76 more rows in JSON report