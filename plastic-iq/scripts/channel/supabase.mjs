import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../lib/env.mjs'

export function createChannelServiceClient() {
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in plastic-iq/.env',
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function fetchChannelMapById(supabase, channelMapId) {
  const { data, error } = await supabase
    .from('channel_maps')
    .select('*')
    .eq('channel_map_id', channelMapId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Channel map not found: ${channelMapId}`)
  return data
}

export async function insertChannelMapDraft(supabase, { topic }) {
  const row = {
    topic,
    status: 'draft',
    channels: [],
    media_outlets: [],
    sources: [],
    channel_count: 0,
    top_10_channel_ids: [],
    run_metadata: {
      run_status: 'running',
      stage: 'retrieval',
      topic,
      angles_completed: [],
      angles_failed: [],
      retrieval: [],
      logs: [`Run started at ${new Date().toISOString()}`],
    },
  }
  const { data, error } = await supabase.from('channel_maps').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function patchChannelMapRunMetadata(supabase, channelMapId, patch) {
  const current = await fetchChannelMapById(supabase, channelMapId)
  const run_metadata = {
    ...(current.run_metadata ?? {}),
    ...patch,
    logs: [...(current.run_metadata?.logs ?? []), ...(patch.logs ?? [])],
  }
  const { data, error } = await supabase
    .from('channel_maps')
    .update({ run_metadata })
    .eq('channel_map_id', channelMapId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function saveChannelMapSuccess(supabase, channelMapId, payload) {
  const top10 = (payload.channels ?? [])
    .filter((c) => c.is_priority_top_10)
    .map((c) => c.channel_id)
    .filter(Boolean)

  const { data, error } = await supabase
    .from('channel_maps')
    .update({
      topic_description: payload.topic_description ?? null,
      channels: payload.channels ?? [],
      media_outlets: payload.media_outlets ?? [],
      industry_channels: payload.industry_channels ?? [],
      sources: payload.sources ?? [],
      channel_count: payload.channels?.length ?? 0,
      top_10_channel_ids: top10,
      run_metadata: payload.run_metadata,
      status: 'draft',
    })
    .eq('channel_map_id', channelMapId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function saveChannelMapFailed(supabase, channelMapId, run_metadata) {
  const { data, error } = await supabase
    .from('channel_maps')
    .update({ run_metadata })
    .eq('channel_map_id', channelMapId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function resetChannelMapForRerun(supabase, channelMapId, topic) {
  const { data, error } = await supabase
    .from('channel_maps')
    .update({
      topic,
      topic_description: null,
      channels: [],
      media_outlets: [],
      industry_channels: [],
      sources: [],
      channel_count: 0,
      top_10_channel_ids: [],
      status: 'draft',
      run_metadata: {
        run_status: 'running',
        stage: 'retrieval',
        topic,
        angles_completed: [],
        angles_failed: [],
        retrieval: [],
        logs: [`Re-run started at ${new Date().toISOString()}`],
      },
    })
    .eq('channel_map_id', channelMapId)
    .select('*')
    .single()
  if (error) throw error
  return data
}
