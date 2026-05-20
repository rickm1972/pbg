#!/usr/bin/env node
/**
 * Agents HTTP API (Agent 1 + Agent 2) — started automatically with `npm run dev`
 *
 * POST /agent1/run   POST /agent2/run
 * GET  /health  /agent1/health  /agent2/health
 * Headers: X-Agent-Secret: <VITE_ADMIN_PASSWORD or AGENT*_API_SECRET>
 */
import { createServer } from 'node:http'
import { runAgent1, formatPacketSummary } from './agent1/runner.mjs'
import { runAgent2, formatNormalizationSummary } from './agent2/runner.mjs'
import { runAgent3, formatScoringSummary } from './agent3/runner.mjs'
import { runAgent4, formatQaSummary } from './agent4/runner.mjs'
import { loadEnv } from './lib/env.mjs'

const env = loadEnv()
const PORT = Number(env.AGENTS_PORT || env.AGENT1_PORT || 8787)
const SECRET =
  env.AGENT1_API_SECRET || env.AGENT2_API_SECRET || env.VITE_ADMIN_PASSWORD

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Unauthorized' }))
}

function readJson(req) {
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

const server = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Secret')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const pathname = req.url?.split('?')[0] ?? ''

  if (
    req.method === 'GET' &&
    (pathname === '/health' ||
      pathname === '/agent1/health' ||
      pathname === '/agent2/health' ||
      pathname === '/agent3/health' ||
      pathname === '/agent4/health')
  ) {
    res.writeHead(200)
    res.end(
      JSON.stringify({ ok: true, service: 'agents', agent1: true, agent2: true, agent3: true, agent4: true }),
    )
    return
  }

  if (
    req.method !== 'POST' ||
    (pathname !== '/agent1/run' &&
      pathname !== '/agent2/run' &&
      pathname !== '/agent3/run' &&
      pathname !== '/agent4/run')
  ) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const provided = req.headers['x-agent-secret']
  if (!SECRET || provided !== SECRET) {
    unauthorized(res)
    return
  }

  try {
    const body = await readJson(req)
    if (!body.product_id) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'product_id is required' }))
      return
    }

    if (pathname === '/agent1/run') {
      const result = await runAgent1({ productId: body.product_id })
      res.writeHead(result.ok ? 200 : 422)
      res.end(
        JSON.stringify({
          ok: result.ok,
          summary: formatPacketSummary(result),
          product_id: result.product.product_id,
          evidence_id: result.evidence?.evidence_id,
          threshold: result.threshold,
          api_usage: result.packet?.agent_metadata?.api_usage ?? null,
          packet: result.packet,
        }),
      )
      return
    }

    if (pathname === '/agent2/run') {
      const result = await runAgent2({ productId: body.product_id })
      if (!result.ok) {
        res.writeHead(422)
        res.end(
          JSON.stringify({
            ok: false,
            reason: result.reason,
            product_id: result.product.product_id,
          }),
        )
        return
      }

      res.writeHead(200)
      res.end(
        JSON.stringify({
          ok: true,
          summary: formatNormalizationSummary(result),
          product_id: result.product.product_id,
          evidence_id: result.evidence.evidence_id,
          input_id: result.scoringInput.input_id,
          human_review_required: result.inputs.human_review_required,
          inputs: result.inputs,
        }),
      )
      return
    }

    if (pathname === '/agent3/run') {
      const result = await runAgent3({ productId: body.product_id })
      if (!result.ok) {
        res.writeHead(422)
        res.end(
          JSON.stringify({
            ok: false,
            reason: result.reason,
            product_id: result.product.product_id,
            calculation: result.result?.calculation,
          }),
        )
        return
      }

      res.writeHead(200)
      res.end(
        JSON.stringify({
          ok: true,
          summary: formatScoringSummary(result),
          product_id: result.product.product_id,
          score_id: result.scoreRow.score_id,
          result: result.result,
        }),
      )
      return
    }

    const result = await runAgent4({
      productId: body.product_id,
      scoreId: body.score_id,
      replaceExisting: Boolean(body.replace_existing),
    })
    if (!result.ok) {
      res.writeHead(422)
      res.end(
        JSON.stringify({
          ok: false,
          reason: result.reason,
          product_id: result.product.product_id,
        }),
      )
      return
    }

    res.writeHead(200)
    res.end(
      JSON.stringify({
        ok: true,
        summary: formatQaSummary(result),
        product_id: result.product.product_id,
        qa_id: result.qaRow?.qa_id,
        overall_status: result.report.overall_status,
        human_review_required: result.report.human_review_required,
        checks: result.report.checks,
        certifications_verified: result.report.certifications_verified,
      }),
    )
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`Agents API listening on http://localhost:${PORT}`)
  console.log(`  POST /agent1/run  POST /agent2/run  POST /agent3/run  POST /agent4/run`)
})
