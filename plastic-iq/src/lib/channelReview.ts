import { supabase } from './supabaseClient'
import type { ChannelEntry, ChannelMapRow, ChannelWorkflowStatus } from '../types/channelMap'

export function channelApiBase(): string {
  return import.meta.env.VITE_CHANNEL_API_URL || '/api/channel'
}

export function channelSecret(): string | undefined {
  return import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
}

export async function fetchChannelMaps(): Promise<ChannelMapRow[]> {
  const { data, error } = await supabase
    .from('channel_maps')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ChannelMapRow[]
}

export async function fetchChannelMapById(channelMapId: string): Promise<ChannelMapRow> {
  const { data, error } = await supabase
    .from('channel_maps')
    .select('*')
    .eq('channel_map_id', channelMapId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Channel map not found')
  return data as ChannelMapRow
}

export async function startChannelMapRun(input: {
  topic: string
  channel_map_id?: string
}): Promise<{ channel_map_id: string; run_status: string }> {
  const secret = channelSecret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is required to start channel runs from the admin UI')
  }
  const res = await fetch(`${channelApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => ({}))) as {
    channel_map_id?: string
    run_status?: string
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error || `Channel run failed (${res.status})`)
  }
  if (!body.channel_map_id) throw new Error('Channel run did not return channel_map_id')
  return { channel_map_id: body.channel_map_id, run_status: body.run_status ?? 'running' }
}

export async function updateChannelMapWorkflowStatus(
  channelMapId: string,
  status: ChannelWorkflowStatus,
): Promise<void> {
  const { error } = await supabase
    .from('channel_maps')
    .update({ status })
    .eq('channel_map_id', channelMapId)
  if (error) throw error
}

export async function saveChannelMapEdits(
  channelMapId: string,
  payload: {
    topic_description?: string | null
    channels?: ChannelEntry[]
    media_outlets?: ChannelEntry[]
    industry_channels?: ChannelEntry[]
  },
): Promise<void> {
  const channel_count = payload.channels?.length ?? undefined
  const top_10_channel_ids =
    payload.channels
      ?.filter((c) => c.is_priority_top_10 && c.channel_id)
      .map((c) => c.channel_id as string) ?? undefined

  const { error } = await supabase
    .from('channel_maps')
    .update({
      topic_description: payload.topic_description,
      channels: payload.channels,
      media_outlets: payload.media_outlets,
      industry_channels: payload.industry_channels,
      ...(channel_count !== undefined ? { channel_count } : {}),
      ...(top_10_channel_ids !== undefined ? { top_10_channel_ids } : {}),
    })
    .eq('channel_map_id', channelMapId)
  if (error) throw error
}

export async function deleteChannelMap(channelMapId: string): Promise<void> {
  const { error } = await supabase.from('channel_maps').delete().eq('channel_map_id', channelMapId)
  if (error) throw error
}

export async function duplicateChannelMapRow(source: ChannelMapRow): Promise<ChannelMapRow> {
  const { data, error } = await supabase
    .from('channel_maps')
    .insert({
      topic: source.topic,
      topic_description: source.topic_description,
      status: 'draft',
      channels: source.channels ?? [],
      media_outlets: source.media_outlets ?? [],
      industry_channels: source.industry_channels ?? [],
      sources: source.sources ?? [],
      channel_count: source.channel_count ?? 0,
      top_10_channel_ids: source.top_10_channel_ids ?? [],
      run_metadata: {
        run_status: 'succeeded',
        stage: 'done',
        duplicated_from: source.channel_map_id,
        note: 'Duplicated in admin UI; no API run.',
      },
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ChannelMapRow
}
