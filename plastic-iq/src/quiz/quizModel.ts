export type QuizScoredId =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'q5'
  | 'q6'
  | 'q7'
  | 'q8'
  | 'q9'
  | 'q10'
  | 'q11'
  | 'q12'
  | 'q13'
  | 'q14'

export type QuizAwarenessId = 'q15' | 'q16' | 'q17'

export type QuizScoredQuestion = {
  id: QuizScoredId
  text: string
  /** Short label for personalized takeaway list */
  itemName: string
  deductionIfYes: number
}

export type TopScoredYesItem = {
  id: QuizScoredId
  itemName: string
  points: number
}

export type QuizAwarenessQuestion = {
  id: QuizAwarenessId
  text: string
}

export const SCORED_QUESTIONS: QuizScoredQuestion[] = [
  {
    id: 'q1',
    text: 'Do you use a nonstick frying pan?',
    itemName: 'Nonstick frying pan',
    deductionIfYes: 10,
  },
  {
    id: 'q2',
    text: 'Do you use a plastic, plastic-lined, or plastic-topped water bottle?',
    itemName: 'Plastic water bottle',
    deductionIfYes: 5,
  },
  {
    id: 'q3',
    text: 'Do you use plastic or nylon cooking utensils?',
    itemName: 'Plastic or nylon cooking utensils',
    deductionIfYes: 3,
  },
  {
    id: 'q4',
    text: 'Do you use cling wrap on food?',
    itemName: 'Cling wrap on food',
    deductionIfYes: 7,
  },
  {
    id: 'q5',
    text: 'Do you use a plastic cutting board?',
    itemName: 'Plastic cutting board',
    deductionIfYes: 5,
  },
  {
    id: 'q6',
    text: 'Do you store food in plastic containers?',
    itemName: 'Plastic food storage containers',
    deductionIfYes: 7,
  },
  {
    id: 'q7',
    text: 'Do you use a drip coffee maker or pod machine with plastic parts?',
    itemName: 'Coffee maker with plastic parts',
    deductionIfYes: 3,
  },
  {
    id: 'q8',
    text: 'Do you use nonstick baking sheets or bakeware?',
    itemName: 'Nonstick baking sheets or bakeware',
    deductionIfYes: 7,
  },
  {
    id: 'q9',
    text: 'Do you use a plastic or plastic-lined electric kettle?',
    itemName: 'Plastic electric kettle',
    deductionIfYes: 3,
  },
  {
    id: 'q10',
    text: 'Do you microwave food in plastic containers?',
    itemName: 'Microwaving food in plastic',
    deductionIfYes: 10,
  },
  {
    id: 'q11',
    text: 'Do you wash plastic items in the dishwasher?',
    itemName: 'Plastic items in the dishwasher',
    deductionIfYes: 5,
  },
  {
    id: 'q12',
    text: 'Do you use laundry or dishwasher pods?',
    itemName: 'Laundry or dishwasher pods',
    deductionIfYes: 3,
  },
  {
    id: 'q13',
    text: 'Do you drink from disposable plastic-lined cups (paper coffee cups, plastic iced coffee cups, plastic water bottles)?',
    itemName: 'Disposable plastic-lined cups',
    deductionIfYes: 10,
  },
  {
    id: 'q14',
    text: 'Do you eat takeout from plastic containers?',
    itemName: 'Takeout in plastic containers',
    deductionIfYes: 5,
  },
]

/** Top yes answers from Q1–Q14 by point value (for personalized takeaway). */
export function topScoredYesItems(
  scoredAnswers: Record<string, boolean>,
  limit = 3,
): TopScoredYesItem[] {
  return SCORED_QUESTIONS.filter((q) => scoredAnswers[q.id] === true)
    .sort((a, b) => b.deductionIfYes - a.deductionIfYes)
    .slice(0, limit)
    .map((q) => ({
      id: q.id,
      itemName: q.itemName,
      points: q.deductionIfYes,
    }))
}

export const AWARENESS_QUESTIONS: QuizAwarenessQuestion[] = [
  {
    id: 'q15',
    text: 'Did you know that PFAS — the chemicals in nonstick coatings, food packaging, and waterproof products — have been linked to cancer, thyroid problems, and weakened immune systems?',
  },
  {
    id: 'q16',
    text: "Did you know that chemicals in everyday plastic can mess with your hormones — lowering testosterone, disrupting estrogen, and affecting fertility, metabolism, mood, and children's development?",
  },
  {
    id: 'q17',
    text: "Did you know that 'BPA-free' plastic often contains BPS or BPF — replacement chemicals that disrupt hormones the same way BPA does?",
  },
]

/** Admin / export: question id → full prompt text */
export const QUIZ_QUESTION_TEXT: Record<string, string> = Object.fromEntries(
  [...SCORED_QUESTIONS, ...AWARENESS_QUESTIONS].map((q) => [q.id, q.text]),
)

export type QuizTier = 'A' | 'B' | 'C' | 'D' | 'F'

export function computeQuizScore(scoredAnswers: Record<string, boolean>): number {
  let score = 100
  for (const q of SCORED_QUESTIONS) {
    if (scoredAnswers[q.id] === true) score -= q.deductionIfYes
  }
  if (score < 17) score = 17
  if (score > 100) score = 100
  return score
}

export function tierForScore(score: number): {
  tier: QuizTier
  letterGrade: QuizTier
  headline: string
  impact: string
  color: string
} {
  if (score >= 90) {
    return {
      tier: 'A',
      letterGrade: 'A',
      headline: 'Your kitchen is mostly safe.',
      impact:
        "Your choices are protecting you from the major chemical exposure pathways. You're already doing what most Americans aren't.",
      color: '#16A34A',
    }
  }
  if (score >= 75) {
    return {
      tier: 'B',
      letterGrade: 'B',
      headline: 'Your kitchen is in decent shape, but there are gaps.',
      impact:
        "You've made some good choices, but a few items in your kitchen are still creating exposure. The good news is fixing the gaps is straightforward.",
      color: '#65A30D',
    }
  }
  if (score >= 55) {
    return {
      tier: 'C',
      letterGrade: 'C',
      headline: 'Your kitchen has some concerning items.',
      impact:
        'A meaningful portion of your daily chemical exposure is coming from your kitchen. The biggest impacts come from a few specific products and habits — not your entire kitchen.',
      color: '#EAB308',
    }
  }
  if (score >= 30) {
    return {
      tier: 'D',
      letterGrade: 'D',
      headline: 'Your kitchen is putting you at risk.',
      impact:
        "Multiple items in your kitchen are sources of chemical exposure. You're not alone — most American kitchens look like this. The good news is the highest-impact swaps are inexpensive and easy.",
      color: '#EA580C',
    }
  }
  return {
    tier: 'F',
    letterGrade: 'F',
    headline: 'Your kitchen is a major exposure source.',
    impact:
      'Your kitchen is creating significant daily exposure to harmful chemicals. This is what the average American kitchen looks like before anyone has thought about it. Every change you make from here moves the needle.',
    color: '#DC2626',
  }
}

export const INTERSTITIAL_AFTER_Q9 =
  "'Microwave-safe' only means the plastic won't melt. It doesn't mean it's safe to eat from. Heat makes plastic release more chemicals into your food."

export const INTERSTITIAL_AFTER_Q14 =
  'Kids absorb more PACs than adults relative to body weight. Their developing systems are especially sensitive.'

