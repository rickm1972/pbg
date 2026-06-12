/**
 * Vite dev middleware: product agents (1–4) + Persona agent from the admin UI (`npm run dev`).
 * Persona runs are async (202 + background job); product agents remain synchronous.
 */
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadEnv } from './lib/env.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Secret')
}

/**
 * Dynamic import from scripts/ using absolute file URLs.
 * Vite compiles this plugin under node_modules/.vite-temp — relative `./agent2/...` breaks there.
 */
function importFresh(relativeFromScripts, { dev }) {
  const href = pathToFileURL(join(scriptsDir, relativeFromScripts)).href
  if (!dev) return import(href)
  return import(`${href}?t=${Date.now()}`)
}

/** Bust src/ modules — static imports in agent1 scripts otherwise stay on first-loaded version. */
function importFreshProject(relativeFromPlasticIq, { dev }) {
  const href = pathToFileURL(join(scriptsDir, '..', relativeFromPlasticIq)).href
  if (!dev) return import(href)
  return import(`${href}?t=${Date.now()}`)
}

async function bustAgent1SharedModules({ dev }) {
  const shared = [
    'src/shared/agent1/amazon-source-consistency.mjs',
    'src/shared/agent1/gate1-product-identity.mjs',
    'src/shared/agent1/manufacturer-pdp-validation.mjs',
    'src/shared/agent1/source-authority.mjs',
    'src/shared/agent1/lab-result-retrieval.mjs',
    'src/shared/agent1/gate1-source-validation.mjs',
    'src/shared/agent1/manufacturer-pdp-modal-extraction.mjs',
    'src/shared/canonical-taxonomy/canonical-taxonomy-fallbacks.mjs',
    'src/shared/canonical-taxonomy/hybrid-cookware-structural.mjs',
    'src/shared/canonical-taxonomy/inert-cookware-structural.mjs',
    'src/shared/canonical-taxonomy/primary-contact-material-taxonomy.mjs',
    'src/shared/canonical-taxonomy/substrate-material-taxonomy.mjs',
    'src/shared/canonical-taxonomy/coating-modifier-taxonomy.mjs',
    'src/shared/canonical-taxonomy/compound-cookware-material.mjs',
    'src/shared/canonical-taxonomy/map-structured-evidence.mjs',
    'scripts/agent1/assert-canonical-materials.mjs',
  ]
  for (const rel of shared) {
    await importFreshProject(rel, { dev })
  }
}

/** Bust Agent 2/3 subgraph — runner import alone leaves layer4b + lab-evidence cached. */
async function bustAgent2And3SharedModules({ dev }) {
  const shared = [
    'src/shared/agent2/manufacturer-lab-testing-evidence.mjs',
    'src/shared/agent2/layer4b-transparency-contract.mjs',
    'src/shared/agent3/escalator-eligibility.mjs',
    'src/shared/agent2/proprietary-ceramic-nonstick.mjs',
    'scripts/agent3/prepare-scoring-inputs.mjs',
    'scripts/agent2/layer4b-enforce.mjs',
    'scripts/agent2/layer4a-enforce.mjs',
    'scripts/agent2/normalize-enforce.mjs',
    'scripts/agent2/deterministic/layer4a-step.mjs',
    'scripts/agent2/deterministic/layer4a-applicability.mjs',
    'scripts/agent2/deterministic/product-description-generate.mjs',
  ]
  for (const rel of shared) {
    await importFreshProject(rel, { dev })
  }
}

export function agentsApiPlugin() {
  return {
    name: 'agents-api',
    configureServer(server) {
      const env = loadEnv()
      const secret = env.VITE_ADMIN_PASSWORD
      const dev = server.config.command === 'serve'

      const syncViteDevBaseUrl = async () => {
        const url =
          server.resolvedUrls?.local?.[0] ??
          (() => {
            const httpServer = server.httpServer
            if (!httpServer?.listening) return null
            const addr = httpServer.address()
            if (!addr || typeof addr !== 'object') return null
            let host = addr.address
            if (host === '::' || host === '0.0.0.0' || host === '::1') host = '127.0.0.1'
            return `http://${host}:${addr.port}`
          })()
        if (!url) return
        const { setViteDevBaseUrl } = await import('./persona/export-pdf.mjs')
        const { setChannelViteDevBaseUrl } = await import('./channel/export-pdf.mjs')
        setViteDevBaseUrl(url)
        setChannelViteDevBaseUrl(url)
      }

      server.httpServer?.once('listening', () => {
        void syncViteDevBaseUrl()
      })
      if (server.httpServer?.listening) {
        void syncViteDevBaseUrl()
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''

        const isPersonaApi = pathname.startsWith('/api/persona')
        const isChannelApi = pathname.startsWith('/api/channel')
        const isDescriptionOverrideApi = pathname.startsWith('/api/description-override')
        const isPublishSnapshotApi = pathname.startsWith('/api/publish-with-snapshot')
        const isAgentApi =
          pathname.startsWith('/api/agent1') ||
          pathname.startsWith('/api/agent2') ||
          pathname.startsWith('/api/agent3') ||
          pathname.startsWith('/api/agent4')

        if (!isPersonaApi && !isChannelApi && !isAgentApi && !isDescriptionOverrideApi && !isPublishSnapshotApi) {
          next()
          return
        }

        corsHeaders(res)

        const provided = req.headers['x-agent-secret']

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (isPublishSnapshotApi) {
          if (!secret || provided !== secret) {
            sendJson(res, 401, { error: 'Unauthorized' })
            return
          }
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          try {
            const body = await readJsonBody(req)
            const productId = String(body.product_id ?? '').trim()
            if (!productId) {
              sendJson(res, 400, { error: 'product_id is required' })
              return
            }
            const { publishProductWithFrozenSnapshot } = await server.ssrLoadModule(
              '/src/lib/apr/publishedSnapshotPublish.ts',
            )
            const { createServiceClient } = await import('./agent1/supabase.mjs')
            const sb = createServiceClient()
            const result = await publishProductWithFrozenSnapshot(sb, productId, {
              approved_by: 'admin-gate4',
            })
            let bundledSynced = false
            if (result.snapshot_created) {
              try {
                execSync('node scripts/sync-bundled-durable-snapshots.mjs', {
                  cwd: join(scriptsDir, '..'),
                  stdio: 'pipe',
                })
                bundledSynced = true
              } catch (syncErr) {
                console.error('[agents-api] bundled sync failed:', syncErr)
              }
            }
            sendJson(res, 200, { ...result, bundled_synced: bundledSynced })
            return
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[agents-api] ${pathname}:`, message)
            sendJson(res, 500, { error: message })
            return
          }
        }

        if (isDescriptionOverrideApi) {
          if (!secret || provided !== secret) {
            sendJson(res, 401, { error: 'Unauthorized' })
            return
          }

          try {
            if (req.method === 'GET' && pathname === '/api/description-override/state') {
              const q = new URL(req.url ?? '', 'http://localhost').searchParams
              const productId = (q.get('product_id') ?? '').trim()
              if (!productId) {
                sendJson(res, 400, { error: 'product_id is required' })
                return
              }
              const { getDescriptionOverrideState } = await server.ssrLoadModule(
                '/src/lib/apr/descriptionOverride.ts',
              )
              sendJson(res, 200, { state: getDescriptionOverrideState(productId) })
              return
            }

            if (req.method === 'POST') {
              const body = await readJsonBody(req)
              const {
                saveDescriptionOverrideDraft,
                submitDescriptionOverrideForReview,
                approveDescriptionOverride,
                rejectDescriptionOverride,
              } = await server.ssrLoadModule('/src/lib/apr/descriptionOverride.ts')

              if (pathname === '/api/description-override/draft') {
                const record = saveDescriptionOverrideDraft({
                  product_id: body.product_id,
                  proposed_override_text: body.proposed_override_text,
                  created_by: body.created_by ?? null,
                })
                sendJson(res, 200, { record })
                return
              }

              if (pathname === '/api/description-override/submit') {
                const record = submitDescriptionOverrideForReview(body.override_id)
                sendJson(res, 200, { record })
                return
              }

              if (pathname === '/api/description-override/approve') {
                const result = approveDescriptionOverride(body.override_id, {
                  reviewer_id: body.reviewer_id,
                  low_score_publication_review: body.low_score_publication_review ?? null,
                  display_remediation: body.display_remediation ?? undefined,
                  notes: body.notes ?? null,
                })
                let bundledSynced = false
                try {
                  execSync('node scripts/sync-bundled-durable-snapshots.mjs', {
                    cwd: join(scriptsDir, '..'),
                    stdio: 'pipe',
                  })
                  bundledSynced = true
                } catch (syncErr) {
                  console.error('[agents-api] bundled sync failed:', syncErr)
                }
                sendJson(res, 200, {
                  override: result.override,
                  new_snapshot_id: result.new_snapshot.snapshot_id,
                  bundled_synced: bundledSynced,
                })
                return
              }

              if (pathname === '/api/description-override/reject') {
                const record = rejectDescriptionOverride(
                  body.override_id,
                  body.reviewer_id,
                  body.notes ?? null,
                )
                sendJson(res, 200, { record })
                return
              }
            }

            sendJson(res, 404, { error: 'Not found' })
            return
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`[agents-api] ${pathname}:`, message)
            sendJson(res, 500, { error: message })
            return
          }
        }

        if (req.method === 'GET' && pathname.endsWith('/health')) {
          if (pathname === '/api/agent2/health') {
            const { PRODUCT_DESCRIPTION_GENERATOR_VERSION } = await importFresh(
              'agent2/deterministic/product-description-generate.mjs',
              { dev },
            )
            sendJson(res, 200, {
              ok: true,
              description_generator_version: PRODUCT_DESCRIPTION_GENERATOR_VERSION,
            })
            return
          }
          sendJson(res, 200, { ok: true })
          return
        }

        const needsSecret =
          pathname === '/api/agent1/dashboard' ||
          pathname === '/api/agent1/pending-evidence' ||
          (req.method === 'POST' &&
            (pathname === '/api/persona/run' ||
              pathname === '/api/persona/export-pdf' ||
              pathname === '/api/agent1/save-evidence-draft' ||
              pathname === '/api/agent1/reset-for-retest' ||
              (isAgentApi && pathname.endsWith('/run'))))
        if (needsSecret) {
          if (!secret || provided !== secret) {
            sendJson(res, 401, { error: 'Unauthorized' })
            return
          }
        }

        if (req.method === 'GET' && pathname === '/api/agent1/dashboard') {
          const { fetchAgent1DashboardData } = await import('./agent1/dashboard-fetch.mjs')
          const dashboard = await fetchAgent1DashboardData()
          sendJson(res, 200, dashboard)
          return
        }

        if (req.method === 'GET' && pathname === '/api/agent1/pending-evidence') {
          const {
            fetchPendingEvidenceRowsService,
            fetchPendingEvidenceForProductService,
          } = await import('./agent1/dashboard-fetch.mjs')
          const q = new URL(req.url ?? '', 'http://localhost').searchParams
          const productId = (q.get('product_id') ?? '').trim()
          if (productId) {
            const evidence = await fetchPendingEvidenceForProductService(productId)
            sendJson(res, 200, { evidence })
            return
          }
          const rows = await fetchPendingEvidenceRowsService()
          sendJson(res, 200, { rows })
          return
        }

        if (isPersonaApi) {
          if (req.method === 'POST' && pathname === '/api/persona/run') {
            try {
              const body = await readJsonBody(req)
              const targetSegment = String(body.target_segment ?? '').trim()
              if (!targetSegment) {
                sendJson(res, 400, { error: 'target_segment is required' })
                return
              }
              const { startPersonaRun, executePersonaRun } = await import('./persona/runner.mjs')
              const row = await startPersonaRun({
                targetSegment,
                personaId: body.persona_id ?? null,
              })
              sendJson(res, 202, {
                ok: true,
                persona_id: row.persona_id,
                run_status: row.run_metadata?.run_status ?? 'running',
              })
              void executePersonaRun(row.persona_id).catch((err) => {
                console.error('[persona-api] background run failed:', err)
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              console.error('[persona-api] /run:', message)
              sendJson(res, 500, { ok: false, error: message })
            }
            return
          }

          if (req.method === 'GET' && pathname === '/api/persona/export-data') {
            try {
              const q = new URL(req.url ?? '', 'http://localhost').searchParams
              const personaId = q.get('persona_id') ?? ''
              const token = q.get('token') ?? ''
              const { validateExportToken } = await import('./persona/export-tokens.mjs')
              if (!validateExportToken(token, personaId)) {
                sendJson(res, 401, { error: 'Invalid or expired export token' })
                return
              }
              const { fetchPersonaById, createPersonaServiceClient } = await import(
                './persona/supabase.mjs'
              )
              const supabase = createPersonaServiceClient()
              const row = await fetchPersonaById(supabase, personaId)
              sendJson(res, 200, row)
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              sendJson(res, 500, { error: message })
            }
            return
          }

          if (req.method === 'POST' && pathname === '/api/persona/export-pdf') {
            if (!secret || provided !== secret) {
              sendJson(res, 401, { error: 'Unauthorized' })
              return
            }
            try {
              const body = await readJsonBody(req)
              const personaId = String(body.persona_id ?? '').trim()
              if (!personaId) {
                sendJson(res, 400, { error: 'persona_id is required' })
                return
              }
              const { capturePersonaPdf } = await import('./persona/export-pdf.mjs')
              const { formatPersonaDisplayName } = await import('./persona/persona-labels.mjs')
              const { fetchPersonaById, createPersonaServiceClient } = await import(
                './persona/supabase.mjs'
              )
              const supabase = createPersonaServiceClient()
              const row = await fetchPersonaById(supabase, personaId)
              const pdf = await capturePersonaPdf({ personaId, req })
              const label =
                row.persona_name ||
                formatPersonaDisplayName(row.persona_content ?? {}) ||
                'persona'
              const filename = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'persona'}.pdf`
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/pdf')
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
              res.end(Buffer.from(pdf))
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              console.error('[persona-api] /export-pdf:', message)
              sendJson(res, 500, { error: message })
            }
            return
          }

          sendJson(res, 404, { error: 'Not found' })
          return
        }

        if (isChannelApi) {
          if (req.method === 'POST' && pathname === '/api/channel/run') {
            try {
              const body = await readJsonBody(req)
              const topic = String(body.topic ?? '').trim()
              if (!topic) {
                sendJson(res, 400, { error: 'topic is required' })
                return
              }
              const { startChannelMapRun, executeChannelMapRun } = await import(
                './channel/runner.mjs'
              )
              const row = await startChannelMapRun({
                topic,
                channelMapId: body.channel_map_id ?? null,
              })
              sendJson(res, 202, {
                ok: true,
                channel_map_id: row.channel_map_id,
                run_status: row.run_metadata?.run_status ?? 'running',
              })
              void executeChannelMapRun(row.channel_map_id).catch((err) => {
                console.error('[channel-api] background run failed:', err)
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              console.error('[channel-api] /run:', message)
              sendJson(res, 500, { ok: false, error: message })
            }
            return
          }

          if (req.method === 'GET' && pathname === '/api/channel/export-data') {
            try {
              const q = new URL(req.url ?? '', 'http://localhost').searchParams
              const channelMapId = q.get('channel_map_id') ?? ''
              const token = q.get('token') ?? ''
              const { validateChannelExportToken } = await import('./channel/export-tokens.mjs')
              if (!validateChannelExportToken(token, channelMapId)) {
                sendJson(res, 401, { error: 'Invalid or expired export token' })
                return
              }
              const { fetchChannelMapById, createChannelServiceClient } = await import(
                './channel/supabase.mjs'
              )
              const supabase = createChannelServiceClient()
              const row = await fetchChannelMapById(supabase, channelMapId)
              sendJson(res, 200, row)
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              sendJson(res, 500, { error: message })
            }
            return
          }

          if (req.method === 'POST' && pathname === '/api/channel/export-pdf') {
            if (!secret || provided !== secret) {
              sendJson(res, 401, { error: 'Unauthorized' })
              return
            }
            try {
              const body = await readJsonBody(req)
              const channelMapId = String(body.channel_map_id ?? '').trim()
              if (!channelMapId) {
                sendJson(res, 400, { error: 'channel_map_id is required' })
                return
              }
              const { captureChannelMapPdf } = await import('./channel/export-pdf.mjs')
              const { fetchChannelMapById, createChannelServiceClient } = await import(
                './channel/supabase.mjs'
              )
              const supabase = createChannelServiceClient()
              const row = await fetchChannelMapById(supabase, channelMapId)
              const pdf = await captureChannelMapPdf({ channelMapId, req })
              const filename = `${row.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel-map'}-channels.pdf`
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/pdf')
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
              res.end(Buffer.from(pdf))
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              console.error('[channel-api] /export-pdf:', message)
              sendJson(res, 500, { error: message })
            }
            return
          }

          sendJson(res, 404, { error: 'Not found' })
          return
        }

        if (req.method === 'POST' && pathname === '/api/agent1/reset-for-retest') {
          try {
            const body = await readJsonBody(req)
            if (!body.product_id) {
              sendJson(res, 400, { error: 'product_id is required' })
              return
            }
            const { createServiceClient } = await importFresh('agent1/supabase.mjs', { dev })
            const { resetAgent1ForRetest } = await importFresh('agent1/reset-for-retest.mjs', {
              dev,
            })
            const sb = createServiceClient()
            const result = await resetAgent1ForRetest(sb, body.product_id)
            sendJson(res, 200, { ok: true, result })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error('[agent1-api] /reset-for-retest:', message)
            sendJson(res, 500, { error: message })
          }
          return
        }

        if (req.method === 'POST' && pathname === '/api/agent1/save-evidence-draft') {
          try {
            const body = await readJsonBody(req)
            if (!body.evidence_id) {
              sendJson(res, 400, { error: 'evidence_id is required' })
              return
            }
            const { saveEvidenceDraft } = await importFresh('agent1/save-evidence-draft.mjs', {
              dev,
            })
            const result = await saveEvidenceDraft({
              evidence_id: body.evidence_id,
              structured_evidence: body.structured_evidence,
              field_edit_audit: body.field_edit_audit,
              edited_by: body.edited_by ?? null,
            })
            sendJson(res, 200, {
              ok: true,
              evidence: result.evidence,
              field_provenance_keys: result.field_provenance_keys,
              facts_count: result.facts_count,
            })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error('[agent1-api] /save-evidence-draft:', message)
            sendJson(res, 500, { error: message })
          }
          return
        }

        if (req.method !== 'POST' || !pathname.endsWith('/run')) {
          sendJson(res, 404, { error: 'Not found' })
          return
        }

        try {
          const body = await readJsonBody(req)
          if (!body.product_id) {
            sendJson(res, 400, { error: 'product_id is required' })
            return
          }

          if (pathname === '/api/agent1/run') {
            console.log(`[agent1-api] POST /run product_id=${body.product_id}`)
            // Bust Agent 1 subgraph — runner import alone leaves structured-normalize/research cached.
            process.env.AGENT1_RELOAD_MODULES = '1'
            await bustAgent1SharedModules({ dev })
            await importFresh('agent1/schema.mjs', { dev })
            await importFresh('agent1/structured-normalize.mjs', { dev })
            await importFresh('agent1/research.mjs', { dev })
            await importFresh('agent1/required-check-retrieval/invoke.mjs', { dev })
            await importFresh('agent1/required-check-retrieval/task-runners.mjs', { dev })
            await importFresh('agent1/required-check-retrieval/execute-required-retrieval.mjs', {
              dev,
            })
            await importFresh('agent1/assert-canonical-materials.mjs', { dev })
            const { runAgent1, formatPacketSummary } = await importFresh('agent1/runner.mjs', {
              dev,
            })
            const result = await runAgent1({ productId: body.product_id })
            console.log(
              `[agent1-api] /run done product_id=${body.product_id} ok=${result.ok} evidence_id=${result.evidence?.evidence_id ?? 'none'}`,
            )
            sendJson(res, result.ok ? 200 : 422, {
              ok: result.ok,
              summary: formatPacketSummary(result),
              product_id: result.product.product_id,
              evidence_id: result.evidence?.evidence_id,
              threshold: result.threshold,
              api_usage: result.packet?.agent_metadata?.api_usage ?? null,
              packet: result.packet,
            })
            return
          }

          if (pathname === '/api/agent2/run') {
            if (dev) {
              const { runAgent2JsonSubprocess } = await importFresh('agent2/run-subprocess.mjs', {
                dev,
              })
              const payload = await runAgent2JsonSubprocess(body.product_id)
              if (!payload.ok) {
                sendJson(res, 422, {
                  ok: false,
                  reason: payload.reason,
                  product_id: payload.product_id,
                })
                return
              }
              sendJson(res, 200, {
                ok: true,
                summary: payload.summary,
                product_id: payload.product_id,
                evidence_id: payload.evidence_id,
                input_id: payload.input_id,
                human_review_required: payload.human_review_required,
                description_generator_version: payload.description_generator_version,
                product_description_preview: payload.product_description_preview,
              })
              return
            }

            const { runAgent2, formatNormalizationSummary } = await importFresh(
              'agent2/runner.mjs',
              { dev },
            )
            const result = await runAgent2({ productId: body.product_id })
            if (!result.ok) {
              sendJson(res, 422, {
                ok: false,
                reason: result.reason,
                product_id: result.product.product_id,
              })
              return
            }
            const genVersion =
              result.inputs?.normalization_metadata?.description_generator_version ?? null
            sendJson(res, 200, {
              ok: true,
              summary: formatNormalizationSummary(result),
              product_id: result.product.product_id,
              evidence_id: result.evidence.evidence_id,
              input_id: result.scoringInput.input_id,
              human_review_required: result.inputs.human_review_required,
              description_generator_version: genVersion,
              product_description_preview: String(
                result.inputs?.product_description ?? '',
              ).slice(0, 160),
              inputs: result.inputs,
            })
            return
          }

          if (pathname === '/api/agent3/run') {
            await bustAgent2And3SharedModules({ dev })
            const { runAgent3, formatScoringSummary } = await importFresh('agent3/runner.mjs', {
              dev,
            })
            const result = await runAgent3({ productId: body.product_id })
            if (!result.ok) {
              sendJson(res, 422, {
                ok: false,
                reason: result.reason,
                product_id: result.product.product_id,
                calculation: result.result?.calculation,
              })
              return
            }
            sendJson(res, 200, {
              ok: true,
              summary: formatScoringSummary(result),
              product_id: result.product.product_id,
              score_id: result.scoreRow.score_id,
              result: result.result,
            })
            return
          }

          if (pathname === '/api/agent4/run') {
            const { runAgent4, formatQaSummary } = await importFresh('agent4/runner.mjs', {
              dev,
            })
            const result = await runAgent4({
              productId: body.product_id,
              scoreId: body.score_id,
              replaceExisting: Boolean(body.replace_existing),
            })
            if (!result.ok) {
              sendJson(res, 422, {
                ok: false,
                reason: result.reason,
                product_id: result.product.product_id,
              })
              return
            }
            sendJson(res, 200, {
              ok: true,
              summary: formatQaSummary(result),
              product_id: result.product.product_id,
              qa_id: result.qaRow?.qa_id,
              overall_status: result.report.overall_status,
              human_review_required: result.report.human_review_required,
              checks: result.report.checks,
              certifications_verified: result.report.certifications_verified,
            })
            return
          }

          sendJson(res, 404, { error: 'Not found' })
        } catch (err) {
          let message = err instanceof Error ? err.message : String(err)
          if (Array.isArray(err?.issues)) {
            message = err.issues
              .slice(0, 5)
              .map((i) => `${i.path?.join('.') ?? '?'}: ${i.message}`)
              .join('; ')
          }
          console.error(`[agents-api] ${pathname}:`, message)
          sendJson(res, 500, { ok: false, error: message })
        }
      })
    },
  }
}
