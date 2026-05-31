import { runAllAngleRetrievals } from './perplexity-retrieval.mjs'
import { synthesizeChannelMap } from './synthesis.mjs'
import { buildSourceCatalog } from './source-catalog.mjs'
import { resolveChannelSources } from './sources-from-synthesis.mjs'
import {
  createChannelServiceClient,
  fetchChannelMapById,
  insertChannelMapDraft,
  patchChannelMapRunMetadata,
  resetChannelMapForRerun,
  saveChannelMapFailed,
  saveChannelMapSuccess,
} from './supabase.mjs'

function buildRetrievalCoverageSummary(retrievalAngles) {
  return (retrievalAngles ?? []).map((a) => ({
    angle_id: a.angle_id,
    label: a.label,
    excerpt_count: a.excerpts?.length ?? 0,
    coverage_note: a.coverage_note ?? null,
    error: a.error ?? null,
  }))
}

function buildApiUsage(retrievalSummary, synthUsage, sourceCount, channelCount) {
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
    channel_count: channelCount,
  }
}

export async function startChannelMapRun({ topic, channelMapId = null }) {
  const supabase = createChannelServiceClient()
  if (channelMapId) {
    return resetChannelMapForRerun(supabase, channelMapId, topic)
  }
  return insertChannelMapDraft(supabase, { topic })
}

export async function executeChannelMapRun(channelMapId) {
  const supabase = createChannelServiceClient()
  const row = await fetchChannelMapById(supabase, channelMapId)
  const topic = row.topic
  const logs = [...(row.run_metadata?.logs ?? [])]
  const log = (msg) => {
    console.log(msg)
    logs.push(`${new Date().toISOString()} ${msg}`)
  }

  let retrievalAngles = []
  let angles_failed = []
  let retrievalSummary

  try {
    await patchChannelMapRunMetadata(supabase, channelMapId, {
      run_status: 'running',
      stage: 'retrieval',
      logs: ['Stage 1: Perplexity retrieval'],
    })

    retrievalSummary = await runAllAngleRetrievals({
      topic,
      log,
      onAngleComplete: async (angleResult) => {
        retrievalAngles = [...retrievalAngles, angleResult]
        const angles_completed = retrievalAngles
          .filter((a) => !a.error && (a.excerpts?.length ?? 0) > 0)
          .map((a) => a.angle_id)
        const angles_failed_live = retrievalAngles
          .filter((a) => a.error)
          .map((a) => ({ angle_id: a.angle_id, error: a.error }))
        await patchChannelMapRunMetadata(supabase, channelMapId, {
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

    await patchChannelMapRunMetadata(supabase, channelMapId, {
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

    const synth = await synthesizeChannelMap({
      topic,
      catalog,
      retrievalAngles,
      log,
    })

    const sources = resolveChannelSources(catalog, synth.parsed, log)
    log(`  Sources kept (cited in synthesis): ${sources.length} of ${catalog.list.length} cataloged`)
    log(
      `  Communities: ${synth.channels.length} | Media: ${synth.media_outlets?.length ?? 0} | Industry: ${synth.industry_channels?.length ?? 0}`,
    )

    const mediaCount = synth.media_outlets?.length ?? 0
    const industryCount = synth.industry_channels?.length ?? 0
    const api_usage = {
      ...buildApiUsage(retrievalSummary, synth.usage, sources.length, synth.channels.length),
      media_outlet_count: mediaCount,
      industry_channel_count: industryCount,
    }
    const run_status = angles_failed.length > 0 ? 'partial' : 'succeeded'

    const run_metadata = {
      run_status,
      stage: 'done',
      topic,
      retrieval: retrievalAngles,
      angles_completed: successfulAngles.map((a) => a.angle_id),
      angles_failed,
      api_usage,
      synthesis_model: synth.model,
      facebook_coverage_note: synth.facebook_coverage_note || null,
      type_coverage_notes: synth.type_coverage_notes ?? {},
      retrieval_coverage: buildRetrievalCoverageSummary(retrievalAngles),
      logs,
      error_message: null,
      finished_at: new Date().toISOString(),
    }

    return saveChannelMapSuccess(supabase, channelMapId, {
      topic_description: synth.topic_description || null,
      channels: synth.channels,
      media_outlets: synth.media_outlets ?? [],
      industry_channels: synth.industry_channels ?? [],
      sources,
      run_metadata,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`Run failed: ${message}`)
    const catalogCount = buildSourceCatalog(retrievalAngles).list.length
    const api_usage = retrievalSummary
      ? buildApiUsage(retrievalSummary, null, catalogCount, 0)
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
    await saveChannelMapFailed(supabase, channelMapId, run_metadata)
    throw err
  }
}

export async function runChannelMapCli({ topic, channelMapId = null }) {
  const row = channelMapId
    ? await startChannelMapRun({ topic, channelMapId })
    : await startChannelMapRun({ topic })
  const id = row.channel_map_id
  console.log(`Channel map run started: ${id}`)
  const result = await executeChannelMapRun(id)
  return { channel_map_id: id, row: result }
}
