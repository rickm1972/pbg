/** Food-contact materials with minimal PAC concern (not plastic / PFAS based). */
export function isNonPacInertFoodContactMaterial(
  materialName: string,
  materialId?: string | null,
  options?: { categoryHint?: string },
): boolean {
  const name = String(materialName ?? '').toLowerCase()
  const cat = String(options?.categoryHint ?? '').toLowerCase()
  if (
    /ptfe|pfas|pfoa|nonstick coating|sol.gel|proprietary ceramic|plastic|silicone|polymer/.test(
      `${name} ${cat}`,
    )
  ) {
    return false
  }

  const id = String(materialId ?? '').toLowerCase()
  if (
    /cast_iron|stainless_steel|carbon_steel|glass|borosilicate|enameled_cast|tempered_glass/.test(
      id,
    )
  ) {
    return true
  }
  return /cast iron|stainless steel|carbon steel|borosilicate|\bglass\b|enameled cast/.test(
    name,
  )
}

/** Normalize legacy "It's used for …" fragments to public use phrase. */
export function normalizeLegacyUseConditionsPhrase(usePart: string): string {
  const lower = String(usePart ?? '')
    .toLowerCase()
    .replace(/\s+with fat exposure/g, '')
    .trim()
  const parts = lower
    .split(/\s+and\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const hasFat = /fat exposure/i.test(usePart)
  const hasOven = parts.some((p) => /oven/i.test(p)) || /oven/i.test(lower)
  const hasStovetop = parts.some((p) => /stovetop/i.test(p)) || /stovetop/i.test(lower)
  if (hasOven && hasStovetop) {
    return hasFat ? 'oven and stovetop heat, including fat exposure' : 'oven and stovetop heat'
  }
  if (!parts.length) return 'typical household use'
  if (parts.length === 1) return hasFat ? `${parts[0]}, including fat exposure` : parts[0]
  const core = parts.join(' and ')
  return hasFat ? `${core}, including fat exposure` : core
}

export function nonPacInertMaterialClause(materialPhrase: string, useSentence: string): string {
  return `${materialPhrase} is not a plastic- or PFAS-based food-contact material, so PAC exposure concern remains minimal even with ${useSentence}.`
}

export function nonPacInertScoreContextSentence(): string {
  return 'The PAC Safety Score reflects disclosed materials and typical cookware use conditions.'
}

/** Rewrite stored Gate 2 inert descriptions that imply PAC migration from cast iron etc. */
export function rewriteLegacyInertPublicDescription(text: string): string {
  const t = String(text ?? '').trim()
  if (
    !/plastic-associated chemical migration|is an inert material|routine heat and use conditions do not increase/i.test(
      t,
    )
  ) {
    return t
  }

  const s1Match = t.match(/^(.+?\suses\s[^.]+?\sas its food-contact surface\.)\s*/i)
  if (!s1Match) return t

  const s1 = s1Match[1].trim()
  const materialMatch =
    t.match(/because\s+([^;,.]+?)\s+is an inert material/i) ??
    t.match(/The disclosed food-contact material is\s+([^.]+)/i)
  const materialPhrase = (materialMatch?.[1] ?? 'the food-contact material').trim()
  const usePart = t.match(/It's used for\s+([^;]+);/i)?.[1] ?? ''
  const useSentence = normalizeLegacyUseConditionsPhrase(usePart)

  return `${s1} ${nonPacInertMaterialClause(materialPhrase, useSentence)} ${nonPacInertScoreContextSentence()}`
}
