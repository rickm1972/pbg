/**
 * Renderer forbidden-import registry (APR contract § Preflight rule 9).
 * Phase 2 migrates renderer to zero violations; Phase 1 establishes baseline.
 */

/** Relative import paths (from src/) that public renderer must not import. */
export const FORBIDDEN_RENDERER_IMPORTS = [
  'lib/publicProductDisplayContract',
  'lib/publicSourceDisplay',
  'lib/publicSourceEligibility',
  'lib/publicSourceTitleFormat',
  'lib/publicMaterialProse',
  'lib/publicDisclosureGapCopy',
  'lib/publicProductDisplay',
  'lib/whyThisScorePublicDisplay',
  'lib/whyThisScoreSort',
  'lib/whyThisScoreLabels',
  'lib/primaryContactMaterials',
  'lib/publicRetailerLinks',
  'lib/retailerLinks',
  'lib/publicRetailerHostLabels',
  'lib/retailerVariantMatch',
  'lib/gate1SourcesReview',
  'lib/nonPacInertMaterials',
  'lib/materialTaxonomy',
  'lib/riskDashboard',
  'lib/transparencyBadge',
] as const

/** Public renderer files scanned for forbidden imports. */
export const RENDERER_SCAN_FILES = [
  'src/pages/ProductPage.tsx',
  'src/components/Sources.tsx',
  'src/components/WhyThisScore.tsx',
  'src/components/RiskDashboard.tsx',
  'src/components/RetailerBuyButtons.tsx',
  'src/components/TransparencyBadge.tsx',
] as const

export type ForbiddenImportViolation = {
  file: string
  importPath: string
  line: number
  spec: string
}

const IMPORT_FROM_RE =
  /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w$]+|\*\s+as\s+[\w$]+)\s+from\s+['"]([^'"]+)['"]/g

/** Normalize import specifier to lib/ path for comparison. */
function normalizeImportSpec(spec: string, filePath: string): string | null {
  if (spec.startsWith('.')) {
    const depth = filePath.replace(/^src\//, '').split('/').length - 1
    let resolved = spec
    if (spec.startsWith('../')) {
      resolved = spec.replace(/^(\.\.\/)+/, '')
    } else if (spec.startsWith('./')) {
      const dir = filePath.split('/').slice(0, -1).join('/').replace(/^src\//, '')
      resolved = dir ? `${dir}/${spec.slice(2)}` : spec.slice(2)
    }
    if (!resolved.startsWith('lib/') && !resolved.startsWith('pages/') && !resolved.startsWith('components/')) {
      if (resolved.includes('lib/')) resolved = resolved.slice(resolved.indexOf('lib/'))
    }
    return resolved.replace(/\.tsx?$/, '')
  }
  return null
}

/** Scan renderer source files for forbidden upstream imports. */
export function scanRendererForbiddenImports(
  fileContents: Array<{ path: string; content: string }>,
): ForbiddenImportViolation[] {
  const violations: ForbiddenImportViolation[] = []

  for (const { path, content } of fileContents) {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes('from ')) continue
      let match: RegExpExecArray | null
      IMPORT_FROM_RE.lastIndex = 0
      while ((match = IMPORT_FROM_RE.exec(line)) !== null) {
        const spec = match[1]
        const normalized = normalizeImportSpec(spec, path)
        if (!normalized) continue
        for (const forbidden of FORBIDDEN_RENDERER_IMPORTS) {
          if (normalized === forbidden || normalized.endsWith(`/${forbidden.split('/').pop()}`)) {
            if (normalized.includes(forbidden) || normalized === forbidden) {
              violations.push({
                file: path,
                importPath: forbidden,
                line: i + 1,
                spec,
              })
            }
          }
        }
        // Direct path match
        for (const forbidden of FORBIDDEN_RENDERER_IMPORTS) {
          if (normalized === forbidden || normalized.endsWith(forbidden.replace('lib/', ''))) {
            const already = violations.some(
              (v) => v.file === path && v.line === i + 1 && v.importPath === forbidden,
            )
            if (!already && (normalized === forbidden || normalized.includes(forbidden))) {
              violations.push({
                file: path,
                importPath: forbidden,
                line: i + 1,
                spec,
              })
            }
          }
        }
      }
    }
  }

  // Dedupe
  const seen = new Set<string>()
  return violations.filter((v) => {
    const key = `${v.file}:${v.line}:${v.importPath}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Simpler line-based scanner — matches ../lib/<module> imports in renderer files. */
export function scanRendererForbiddenImportsSimple(
  fileContents: Array<{ path: string; content: string }>,
): ForbiddenImportViolation[] {
  const violations: ForbiddenImportViolation[] = []
  for (const { path, content } of fileContents) {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim().startsWith('import ')) continue
      for (const forbidden of FORBIDDEN_RENDERER_IMPORTS) {
        const moduleName = forbidden.replace('lib/', '')
        if (
          line.includes(`'../${forbidden}'`) ||
          line.includes(`"../${forbidden}"`) ||
          line.includes(`'../${forbidden}.ts'`) ||
          line.includes(`'../${forbidden}.tsx'`) ||
          line.includes(`'${moduleName}'`) && line.includes('../lib/')
        ) {
          const matchesModule =
            line.includes(forbidden) ||
            line.includes(`lib/${moduleName}`) ||
            line.includes(`/${moduleName}'`) ||
            line.includes(`/${moduleName}"`)
          if (matchesModule) {
            violations.push({
              file: path,
              importPath: forbidden,
              line: i + 1,
              spec: line.trim(),
            })
          }
        }
      }
    }
  }
  const seen = new Set<string>()
  return violations.filter((v) => {
    const key = `${v.file}:${v.line}:${v.importPath}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Allowed renderer import prefix — APR layout helpers only. */
export const ALLOWED_RENDERER_IMPORT_PREFIXES = ['lib/apr/']
