import { runAllAngleRetrievals } from './perplexity-retrieval.mjs'
import { synthesizePersona } from './synthesis.mjs'
import { formatPersonaDisplayName } from './persona-labels.mjs'
import { buildSourceCatalog } from './source-catalog.mjs'
import { resolvePersonaSources } from './sources-from-synthesis.mjs'
import {
  createPersonaServiceClient,
  fetchPersonaById,
  insertPersonaDraft,
  patchPersonaRunMetadata,
  resetPersonaForRerun,
  savePersonaFailed,
  savePersonaSuccess,
} from './supabase.mjs'

function buildApiUsage(retrievalSummary, synthUsage, sourceCount) {
  const perplexity = retrievalSummary?.usage ?? {}
  const claude = synthUsage ?? {}
  const total =
    (perplexity.perplexity_estimated_cost_usd ?? 0) + (claude.estimated_cost_usd ?? 0)
  return {
    perplexity_requests: perplexity.perplexity_requests ?? 0,
    perplexity_input_tokens: perplexity.perplexity_input_tokens ?? 0,
    perplexity_output_tokens: perplexity.perplexity_output_tokens ?? 0,
    perplexity_estimated_cost_usd: perplexity.perplexity_estimated_cost_usd ?? 0,
    claude_input_tokens: claude.input_tokens ?? 0,
    claude_output_tokens: claude.output_tokens ?? 0,
    claude_estimated_cost_usd: claude.estimated_cost_usd ?? 0,
    total_estimated_cost_usd: total,
    source_count: sourceCount,
  }
}

/**
 * Start a persona run (insert or reset row). Returns persona_id immediately.
 */
export async function startPersonaRun({ targetSegment, personaId = null }) {
  const supabase = createPersonaServiceClient()
  if (personaId) {
    return resetPersonaForRerun(supabase, personaId, targetSegment)
  }
  return insertPersonaDraft(supabase, { targetSegment })
}

/**
 * Background job: retrieval → synthesis → save draft.
 */
export async function executePersonaRun(personaId) {
  const supabase = createPersonaServiceClient()
  const row = await fetchPersonaById(supabase, personaId)
  const targetSegment = row.target_segment
  const logs = [...(row.run_metadata?.logs ?? [])]
  const log = (msg) => {
    console.log(msg)
    logs.push(`${new Date().toISOString()} ${msg}`)
  }

  let retrievalAngles = []
  let angles_failed = []
  let retrievalSummary

  try {
    await patchPersonaRunMetadata(supabase, personaId, {
      run_status: 'running',
      stage: 'retrieval',
      logs: ['Stage 1: Perplexity retrieval'],
    })

    retrievalSummary = await runAllAngleRetrievals({
      targetSegment,
      log,
      onAngleComplete: async (angleResult) => {
        retrievalAngles = [...retrievalAngles, angleResult]
        const angles_completed = retrievalAngles
          .filter((a) => !a.error && (a.excerpts?.length ?? 0) > 0)
          .map((a) => a.angle_id)
        const angles_failed_live = retrievalAngles
          .filter((a) => a.error)
          .map((a) => ({ angle_id: a.angle_id, error: a.error }))
        await patchPersonaRunMetadata(supabase, personaId, {
          stage: 'retrieval',
          retrieval: retrievalAngles,
          angles_completed,
          angles_failed: angles_failed_live,
        })
      },
    })

    retrievalAngles = retrievalSummary.angles
    angles_failed = retrievalSummary.angles_failed

    const successfulAngles = retrievalAngles.filter((a) => (a.excerpts?.length ?? 0) > 0)
    if (!successfulAngles.length) {
      throw new Error('All retrieval angles failed or returned no excerpts')
    }

    await patchPersonaRunMetadata(supabase, personaId, {
      stage: 'synthesis',
      run_status: 'running',
      retrieval: retrievalAngles,
      angles_completed: successfulAngles.map((a) => a.angle_id),
      angles_failed,
      logs: ['Stage 2: Claude synthesis'],
    })

    const catalog = buildSourceCatalog(retrievalAngles)
    if (!catalog.list.length) {
      throw new Error('No valid cataloged sources after retrieval filtering')
    }

    const synth = await synthesizePersona({
      targetSegment,
      catalog,
      log,
    })

    const sources = resolvePersonaSources(catalog, synth.parsed, synth.persona_content, log)
    log(`  Sources kept (cited in synthesis): ${sources.length} of ${catalog.list.length} cataloged`)
    const api_usage = buildApiUsage(retrievalSummary, synth.usage, sources.length)
    const run_status =
      angles_failed.length > 0 ? 'partial' : 'succeeded'

    const run_metadata = {
      run_status,
      stage: 'done',
      target_segment: targetSegment,
      retrieval: retrievalAngles,
      angles_completed: successfulAngles.map((a) => a.angle_id),
      angles_failed,
      api_usage,
      synthesis_model: synth.model,
      logs,
      error_message: null,
      finished_at: new Date().toISOString(),
    }

    return savePersonaSuccess(supabase, personaId, {
      persona_name: formatPersonaDisplayName(synth.persona_content) || null,
      segment: synth.persona_content.segment || null,
      persona_content: synth.persona_content,
      sources,
      run_metadata,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`Run failed: ${message}`)
    const api_usage = retrievalSummary
      ? buildApiUsage(retrievalSummary, null, buildSourceCatalog(retrievalAngles).list.length)
      : row.run_metadata?.api_usage ?? null

    const run_metadata = {
      ...(row.run_metadata ?? {}),
      run_status: 'failed',
      stage: 'done',
      retrieval: retrievalAngles.length ? retrievalAngles : row.run_metadata?.retrieval ?? [],
      angles_failed: angles_failed.length ? angles_failed : row.run_metadata?.angles_failed ?? [],
      api_usage,
      logs,
      error_message: message,
      finished_at: new Date().toISOString(),
    }
    await savePersonaFailed(supabase, personaId, run_metadata)
    throw err
  }
}

export async function runPersonaCli({ targetSegment, personaId = null }) {
  const row = personaId
    ? await startPersonaRun({ targetSegment, personaId })
    : await startPersonaRun({ targetSegment })
  const id = row.persona_id
  console.log(`Persona run started: ${id}`)
  const result = await executePersonaRun(id)
  return { persona_id: id, row: result }
}
