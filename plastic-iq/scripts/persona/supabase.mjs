import { createClient } from '@supabase/supabase-js'
import { loadEnv } from '../lib/env.mjs'

export function createPersonaServiceClient() {
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

export async function fetchPersonaById(supabase, personaId) {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('persona_id', personaId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Persona not found: ${personaId}`)
  return data
}

export async function insertPersonaDraft(supabase, { targetSegment }) {
  const row = {
    target_segment: targetSegment,
    status: 'draft',
    persona_content: {},
    sources: [],
    run_metadata: {
      run_status: 'running',
      stage: 'retrieval',
      target_segment: targetSegment,
      angles_completed: [],
      angles_failed: [],
      retrieval: [],
      logs: [`Run started at ${new Date().toISOString()}`],
    },
  }
  const { data, error } = await supabase.from('personas').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function patchPersonaRunMetadata(supabase, personaId, patch) {
  const current = await fetchPersonaById(supabase, personaId)
  const run_metadata = {
    ...(current.run_metadata ?? {}),
    ...patch,
    logs: [
      ...((current.run_metadata?.logs ?? []) ),
      ...(patch.logs ?? []),
    ],
  }
  const { data, error } = await supabase
    .from('personas')
    .update({ run_metadata })
    .eq('persona_id', personaId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function savePersonaSuccess(supabase, personaId, payload) {
  const { data, error } = await supabase
    .from('personas')
    .update({
      persona_name: payload.persona_name ?? null,
      segment: payload.segment ?? null,
      persona_content: payload.persona_content ?? {},
      sources: payload.sources ?? [],
      run_metadata: payload.run_metadata,
      status: 'draft',
    })
    .eq('persona_id', personaId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function savePersonaFailed(supabase, personaId, run_metadata) {
  const { data, error } = await supabase
    .from('personas')
    .update({ run_metadata })
    .eq('persona_id', personaId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function resetPersonaForRerun(supabase, personaId, targetSegment) {
  const { data, error } = await supabase
    .from('personas')
    .update({
      target_segment: targetSegment,
      persona_name: null,
      segment: null,
      persona_content: {},
      sources: [],
      status: 'draft',
      run_metadata: {
        run_status: 'running',
        stage: 'retrieval',
        target_segment: targetSegment,
        angles_completed: [],
        angles_failed: [],
        retrieval: [],
        logs: [`Re-run started at ${new Date().toISOString()}`],
      },
    })
    .eq('persona_id', personaId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function duplicatePersona(supabase, personaId) {
  const source = await fetchPersonaById(supabase, personaId)
  const copy = {
    target_segment: source.target_segment,
    persona_name: source.persona_name ? `${source.persona_name} (copy)` : null,
    segment: source.segment,
    status: 'draft',
    persona_content: source.persona_content ?? {},
    sources: source.sources ?? [],
    run_metadata: {
      run_status: 'succeeded',
      stage: 'done',
      duplicated_from: personaId,
      note: 'Duplicated from existing persona; no API run.',
    },
  }
  const { data, error } = await supabase.from('personas').insert(copy).select('*').single()
  if (error) throw error
  return data
}
