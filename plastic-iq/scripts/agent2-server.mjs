#!/usr/bin/env node
/**
 * @deprecated Use agent1-server.mjs (Agents API) — started automatically with `npm run dev`.
 * This file is kept for reference; `npm run agent2:serve` runs the combined server.
 */
import { createServer } from 'node:http'
import { runAgent2, formatNormalizationSummary } from './agent2/runner.mjs'
import { loadEnv } from './lib/env.mjs'

const env = loadEnv()
const PORT = Number(env.AGENT2_PORT || 8788)
const SECRET = env.AGENT2_API_SECRET || env.VITE_ADMIN_PASSWORD

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

  if (req.method === 'GET' && (req.url === '/health' || req.url === '/agent2/health')) {
    res.writeHead(200)
    res.end(JSON.stringify({ ok: true, service: 'agent2' }))
    return
  }

  if (req.method !== 'POST' || req.url !== '/agent2/run') {
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
  } catch (err) {
    res.writeHead(500)
    res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log(`Agent 2 server listening on http://localhost:${PORT}`)
  console.log(`POST /agent2/run with header X-Agent-Secret`)
})
