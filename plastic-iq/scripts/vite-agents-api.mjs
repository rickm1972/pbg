/**
 * Vite dev middleware: Agent 1 + Agent 2 run from the dashboard with only `npm run dev`.
 * No separate port, no agent1:serve / agent2:serve terminal.
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

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? ''

        if (
          !pathname.startsWith('/api/agent1') &&
          !pathname.startsWith('/api/agent2') &&
          !pathname.startsWith('/api/agent3') &&
          !pathname.startsWith('/api/agent4')
        ) {
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
          (req.method === 'POST' && pathname.endsWith('/run'))
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
