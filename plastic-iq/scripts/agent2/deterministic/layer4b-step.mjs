/**
 * Step 6 — Layer 4B transparency badge (reads Step 3 components + Step 4 layer_4a only).
 */

import { enforceLayer4b } from '../layer4b-enforce.mjs'

/**
 * @param {object[]} inferredComponents — Step 3 output
 * @param {object} layer4a — Step 4 layer_4a object
 */
export function runLayer4bStep(inferredComponents, layer4a) {
  const result = enforceLayer4b({
    components: inferredComponents,
    layer_4a: layer4a,
  })
  return result.layer_4b
}
