import type { ProductTier } from '../types'
import { ScoreMark } from './ScoreMark'
import { tierForScore } from '../lib/score'

const MATERIALS_DESCRIPTION =
  'Rates the packaging and container for plastic-associated chemical risk'
const INGREDIENT_DESCRIPTION =
  'Rates how concerning the actual formula ingredients are'

function ScoreBlock({
  title,
  description,
  score,
  tier,
}: {
  title: string
  description: string
  score: number
  tier: ProductTier
}) {
  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-3 sm:max-w-[14rem]">
      <ScoreMark score={score} tier={tier} size="lg" scoreLabel={title} />
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
      </div>
    </div>
  )
}

export function FormulationSafetyScores({
  materialsScore,
  ingredientScore,
  materialsTier,
}: {
  materialsScore: number
  ingredientScore: number
  materialsTier?: ProductTier
}) {
  const materialsTierResolved = materialsTier ?? tierForScore(materialsScore)
  const ingredientTier = tierForScore(ingredientScore)

  return (
    <div className="flex flex-wrap items-start gap-6 md:gap-8">
      <ScoreBlock
        title="Materials Safety"
        description={MATERIALS_DESCRIPTION}
        score={materialsScore}
        tier={materialsTierResolved}
      />
      <ScoreBlock
        title="Ingredient Safety"
        description={INGREDIENT_DESCRIPTION}
        score={ingredientScore}
        tier={ingredientTier}
      />
    </div>
  )
}
