/**
 * Translate Agent 2 normalization component_name + material into consumer-facing phrases.
 * Never emit raw component_name strings in product explanations.
 */

export function isRinseOffFormulationProduct(inputs) {
  if (!inputs?.is_formulation_product) return false
  const cat = String(inputs.product_category_default ?? '').toLowerCase()
  if (/rinse|dish|laundry|cleaner|soap|detergent/.test(cat)) return true
  return (inputs.components ?? []).some((c) => {
    const text = `${c.component_name ?? ''} ${c.material ?? ''}`.toLowerCase()
    return /pathway\s*2|dish soap|dishwashing|laundry|rinse.off|multi.purpose concentrate|cleaning formulation/.test(
      text,
    )
  })
}

function componentText(component) {
  const name = (component?.component_name ?? '').trim()
  const material = (component?.material ?? '').trim()
  return `${name} ${material}`.toLowerCase()
}

function firstMaterialClause(material) {
  if (!material?.trim()) return ''
  return material.split(/\s*[;]\s*/)[0].split(/\s*,\s*/)[0].trim()
}

/** Detect consumer material families from combined name + material text. */
function detectMaterialFamilies(text) {
  const families = []
  const add = (f) => {
    if (f && !families.includes(f)) families.push(f)
  }

  if (/cast iron|cast-iron/.test(text)) add('cast iron')
  if (/stainless steel|stainless/.test(text)) add('stainless steel')
  if (
    /thermolon|terra\s*bond|ceramic nonstick|ceramic non-stick|nonstick coating|non-stick coating|ceramic coating/.test(
      text,
    )
  ) {
    add('ceramic non-stick coating')
  }
  if (/tritan|copolyester/.test(text)) add('plastic')
  else if (/polypropylene|\bpp\b|polycarbonate|\bpet\b|pcr plastic|\bplastic\b/.test(text)) add('plastic')
  if (/glass|borosilicate|tempered glass/.test(text)) add('glass')
  if (/silicone/.test(text)) add('silicone')
  if (/nylon/.test(text)) add('nylon')
  if (/aluminum|aluminium|hard.anodized|anodized aluminum|tri.ply/.test(text)) add('aluminum')
  if (/teak/.test(text)) add('teak wood')
  if (/bamboo/.test(text)) add('bamboo')
  if (
    /saponified|soap bar|soap formula|pathway\s*2|surfactant|dish soap|dishwashing|cleaning formulation|concentrate.*(food|dish|surface)/.test(
      text,
    )
  ) {
    add('soap')
  }

  return families
}

function inferRole(text) {
  if (
    /pathway\s*2|powder dish soap|cleaning formulation|formulation\s*[—–-]|surfactant|preservative system|soap bar|solid vegetable soap|dish soap formulation/.test(
      text,
    )
  ) {
    if (/concentrate|multi.purpose|all-purpose cleaner/i.test(text)) {
      return { kind: 'cleaning_formula' }
    }
    return { kind: 'soap_formula' }
  }

  if (
    /(tritan|plastic).*(lid|cap).*(straw|spout)|built.in straw|freesip|chug cap|lid\s*\/\s*spout|spout\s*\/\s*straw|straw.*lid/.test(
      text,
    )
  ) {
    return { kind: 'lid_and_straw', material: /tritan|copolyester|plastic/.test(text) ? 'plastic' : null }
  }

  if (/silicone straw|straw tip/i.test(text)) return { kind: 'straw', material: 'silicone' }
  if (/stainless.*straw|straw.*stainless/i.test(text)) return { kind: 'straw', material: 'stainless steel' }

  if (/thermo.spot|heat indicator/i.test(text)) {
    return { kind: 'heat_indicator', material: null }
  }

  if (
    /cooking surface|food.contact.*(surface|layer|inner)|interior cooking|nonstick cooking|thermolon|hexagonal peak|ceramic.*valley|satin enamel.*interior|interior.*non.stick/i.test(
      text,
    )
  ) {
    if (/cast iron|vegetable oil seasoning/.test(text)) return { kind: 'cooking_surface', material: 'cast iron' }
    if (
      /\bptfe\b|ptfe\/teflon|conventional ptfe|titanium-reinforced ptfe|\bteflon\b/.test(text) &&
      !/ptfe-free|pfas-free/.test(text)
    ) {
      return { kind: 'cooking_surface', material: 'PTFE nonstick' }
    }
    if (/ceramic|thermolon|terra\s*bond|terrabond|proprietary ceramic/.test(text)) {
      return { kind: 'cooking_surface', material: 'ceramic non-stick coating' }
    }
    if (/nonstick|non-stick/.test(text)) {
      return { kind: 'cooking_surface', material: 'nonstick coating' }
    }
    if (/stainless/.test(text)) return { kind: 'cooking_surface', material: 'stainless steel' }
    return { kind: 'cooking_surface', material: null }
  }

  if (/bottle.*interior|interior.*liquid|liquid contact surface|beverage contact|vessel wall|body interior|interior wall/i.test(text)) {
    const families = detectMaterialFamilies(text)
    return { kind: 'bottle_interior', material: families[0] ?? null }
  }

  if (/blenderball|wire whisk/i.test(text)) return { kind: 'mixing_ball', material: 'stainless steel' }

  if (/gasket|seal|latch|o-ring|airtight seal/i.test(text) && !/encapsulated/.test(text)) {
    return { kind: 'seal', material: /silicone/.test(text) ? 'silicone' : null }
  }

  if (/\blid\b|\bcap\b/i.test(text) && !/screw-top cap \/ lid/i.test(text)) {
    if (/tempered glass|glass lid/i.test(text)) return { kind: 'lid', material: 'glass' }
    if (/bamboo/.test(text)) return { kind: 'lid', material: 'bamboo' }
    if (/polypropylene|tritan|plastic/i.test(text)) return { kind: 'lid', material: 'plastic' }
    if (/stainless/.test(text)) return { kind: 'lid', material: 'stainless steel' }
    return { kind: 'lid', material: null }
  }

  if (/screw-top cap|flex cap|twist cap|chug cap/i.test(text)) {
    return { kind: 'cap', material: detectMaterialFamilies(text)[0] ?? null }
  }

  if (/bristle|brush head|brush bristle|basting brush/i.test(text)) {
    return { kind: 'bristles', material: /nylon|silicone|natural fiber/i.test(text) ? null : null }
  }

  if (/handle|grip/i.test(text)) {
    if (/\btpr\b|thermoplastic rubber|soft.grip|comfort grip/i.test(text)) {
      return { kind: 'handle', material: 'soft-grip' }
    }
    if (/silicone/.test(text)) return { kind: 'handle', material: 'silicone-coated' }
    if (/cast iron/.test(text)) return { kind: 'handle', material: 'cast iron' }
    if (/stainless/.test(text)) return { kind: 'handle', material: 'stainless steel' }
    return { kind: 'handle', material: null }
  }

  if (/pan body|skillet|substrate|tri.ply construction|hard.anodized body|body\/exterior|aluminum body|internal core|graphite core/i.test(text)) {
    const families = detectMaterialFamilies(text)
    return { kind: 'pan_body', material: families[0] ?? null }
  }

  if (/glass container|container body|container base|food storage|meal prep/i.test(text)) {
    return { kind: 'food_container', material: 'glass' }
  }

  if (/utensil head|tool head|spatula|ladle|turner|tongs|whisk head/i.test(text)) {
    const families = detectMaterialFamilies(text)
    return { kind: 'utensils', material: families[0] ?? null }
  }

  if (/teak wood utensil|wooden utensil|wood utensil/i.test(text)) {
    return { kind: 'utensils', material: 'wood' }
  }

  if (/exterior|powder coat|enamel|duracoat|klean coat|exterior finish/i.test(text)) {
    return { kind: 'exterior_finish', material: null }
  }

  if (
    /packaging|refill pouch|pouch|refill bottle|bottle \(container\)|plastic container.*resin/i.test(
      text,
    )
  ) {
    return { kind: 'packaging', material: /plastic|hdpe|pp|pet/.test(text) ? 'plastic' : null }
  }

  if (/carry loop|storage stand|utensil holder|thermo.spot/i.test(text)) {
    return { kind: 'minor_part', material: null }
  }

  return { kind: 'contact_part', material: detectMaterialFamilies(text)[0] ?? null }
}

function phraseForRole(role) {
  const m = role.material
  switch (role.kind) {
    case 'soap_formula':
      return 'the soap formula'
    case 'cleaning_formula':
      return 'the cleaning formula'
    case 'dish_soap_formula':
      return 'the dish soap formula'
    case 'lid_and_straw':
      return m === 'stainless steel' ? 'the stainless steel lid and straw' : 'the plastic lid and straw'
    case 'heat_indicator':
      return 'the heat indicator on the cooking surface'
    case 'cooking_surface':
      if (m === 'ceramic non-stick coating') return 'the ceramic non-stick cooking surface'
      if (m === 'PTFE nonstick') return 'the PTFE nonstick cooking surface'
      if (m === 'nonstick coating') return 'the nonstick cooking surface'
      return m ? `the ${m} cooking surface` : 'the cooking surface'
    case 'bottle_interior':
      return m ? `the ${m} bottle interior` : 'the inside of the bottle where liquid touches'
    case 'cap':
      return m ? `the ${m} cap` : 'the cap'
    case 'lid':
      return m ? `the ${m} lid` : 'the lid'
    case 'seal':
      return m ? `the ${m} seal` : 'the seal around the lid'
    case 'bristles':
      return 'the basting brush bristle material'
    case 'handle':
      if (m === 'soft-grip') return 'the soft grip handle'
      return m ? `the ${m} handle` : 'the handle'
    case 'pan_body':
      return m ? `the ${m} pan body` : 'the pan body'
    case 'food_container':
      return m ? `the ${m} food storage container` : 'the food storage container'
    case 'utensils':
      return m ? `the ${m} utensil heads` : 'the utensil heads'
    case 'straw':
      return m ? `the ${m} straw` : 'the straw'
    case 'mixing_ball':
      return 'the mixing ball inside the bottle'
    case 'exterior_finish':
      return 'the exterior finish'
    case 'packaging':
      return m === 'plastic' ? 'the refill bottle (packaging only)' : 'the packaging'
    case 'minor_part':
      return 'a minor structural part'
    default:
      return m ? `the ${m} contact surface` : 'a contact surface'
  }
}

/**
 * Consumer phrase for a scored component (e.g. "the cast iron cooking surface").
 * @param {object|null} component — scored component result with component_name, material
 */
export function consumerComponentLabel(component, inputs = null, pathway = null) {
  if (!component) {
    if (pathway === 'rinse_off' || pathway === 'RINSE_OFF' || isRinseOffFormulationProduct(inputs)) {
      return 'the main product-contact part'
    }
    if (pathway === 'oral_direct' || pathway === 'ORAL_DIRECT') return 'the main drinking-contact part'
    if (pathway === 'hand_only') return 'the main hand-contact part'
    return 'the main contact part in normal use'
  }
  const text = componentText(component)
  const role = inferRole(text)
  if (!role.material) {
    const families = detectMaterialFamilies(text)
    if (families.length === 1) role.material = families[0]
    else if (families.length > 1) {
      const nameHint = component.component_name?.toLowerCase() ?? ''
      role.material = families.find((f) => nameHint.includes(f.split(' ')[0])) ?? families[0]
    }
  }
  return phraseForRole(role)
}

/**
 * Short material phrase for "primarily …" in excellent-tier explanations.
 * @param {object|null} component
 */
export function consumerPrimaryMaterialLabel(component, inputs = null, _pathway = null) {
  if (!component) return 'safe, well-understood materials'
  const text = componentText(component)
  const families = detectMaterialFamilies(text)

  if (isRinseOffFormulationProduct(inputs) || families.includes('soap')) {
    if (/plant|mineral|decyl glucoside|coco-glucoside|surfactant|aqueous/i.test(text)) {
      return 'a plant- and mineral-based dish soap concentrate with fully disclosed ingredients'
    }
    return 'a plant-based cleaning concentrate with fully disclosed ingredients'
  }

  if (families.includes('cast iron')) return 'cast iron'
  if (families.includes('glass')) return 'glass'
  if (families.includes('stainless steel')) return 'stainless steel'
  if (families.includes('soap')) {
    if (/coconut/.test(text)) return 'a plant-based soap made with coconut oil'
    if (/organic/.test(text)) return 'a plant-based soap formula'
    return 'a plant-based soap formula'
  }
  if (families.includes('ceramic non-stick coating') && families.includes('stainless steel')) {
    return 'stainless steel with a ceramic non-stick cooking surface'
  }
  if (families.includes('ceramic non-stick coating')) return 'a ceramic non-stick cooking surface'
  if (families.includes('plastic')) return 'BPA-free plastic'
  if (families.includes('aluminum')) return 'anodized aluminum'
  if (families.includes('teak wood')) return 'natural teak wood'
  if (families.includes('bamboo')) return 'bamboo'
  if (families.includes('silicone')) return 'silicone'
  if (families.includes('nylon')) return 'nylon'

  const clause = firstMaterialClause(component.material)
  if (!clause) return 'its main materials'

  if (/unknown|unspecified|not specified|proprietary|undisclosed/i.test(clause)) {
    return 'materials that still need clearer disclosure'
  }

  const simplified = clause
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (simplified.length > 72) {
    return simplified.slice(0, 69).trim() + '…'
  }
  return simplified
}
