/**
 * Vite dev middleware: product agents (1–4) + Persona agent from the admin UI (`npm run dev`).
 * Persona runs are async (202 + background job); product agents remain synchronous.
 */
import { loadEnv } from './lib/env.mjs'

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

export function agentsApiPlugin() {
  return {
    name: 'agents-api',
    configureServer(server) {
      const env = loadEnv()
      const secret = env.VITE_ADMIN_PASSWORD

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
        const isAgentApi =
          pathname.startsWith('/api/agent1') ||
          pathname.startsWith('/api/agent2') ||
          pathname.startsWith('/api/agent3') ||
          pathname.startsWith('/api/agent4')

        if (!isPersonaApi && !isChannelApi && !isAgentApi) {
          next()
          return
        }

        corsHeaders(res)

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method === 'GET' && pathname.endsWith('/health')) {
          sendJson(res, 200, { ok: true })
          return
        }

        const provided = req.headers['x-agent-secret']
        const needsSecret =
          pathname === '/api/agent1/dashboard' ||
          (req.method === 'POST' &&
            (pathname === '/api/persona/run' ||
              pathname === '/api/persona/export-pdf' ||
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
            const { runAgent1, formatPacketSummary } = await import('./agent1/runner.mjs')
            const result = await runAgent1({ productId: body.product_id })
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
            const { runAgent2, formatNormalizationSummary } = await import('./agent2/runner.mjs')
            const result = await runAgent2({ productId: body.product_id })
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
              summary: formatNormalizationSummary(result),
              product_id: result.product.product_id,
              evidence_id: result.evidence.evidence_id,
              input_id: result.scoringInput.input_id,
              human_review_required: result.inputs.human_review_required,
              inputs: result.inputs,
            })
            return
          }

          if (pathname === '/api/agent3/run') {
            const { runAgent3, formatScoringSummary } = await import('./agent3/runner.mjs')
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
            const { runAgent4, formatQaSummary } = await import('./agent4/runner.mjs')
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
