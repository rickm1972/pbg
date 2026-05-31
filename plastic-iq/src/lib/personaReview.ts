import { supabase } from './supabaseClient'
import { formatPersonaDisplayName } from './personaDisplay'
import type { PersonaContent, PersonaRow, PersonaWorkflowStatus } from '../types/persona'

export function personaApiBase(): string {
  return import.meta.env.VITE_PERSONA_API_URL || '/api/persona'
}

export function personaSecret(): string | undefined {
  return import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
}

export async function fetchPersonas(): Promise<PersonaRow[]> {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PersonaRow[]
}

export async function fetchPersonaById(personaId: string): Promise<PersonaRow> {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('persona_id', personaId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Persona not found')
  return data as PersonaRow
}

export async function startPersonaRun(input: {
  target_segment: string
  persona_id?: string
}): Promise<{ persona_id: string; run_status: string }> {
  const secret = personaSecret()
  if (!secret) {
    throw new Error('VITE_ADMIN_PASSWORD is required to start persona runs from the admin UI')
  }
  const res = await fetch(`${personaApiBase()}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Secret': secret,
    },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => ({}))) as {
    persona_id?: string
    run_status?: string
    error?: string
  }
  if (!res.ok) {
    throw new Error(body.error || `Persona run failed (${res.status})`)
  }
  if (!body.persona_id) throw new Error('Persona run did not return persona_id')
  return { persona_id: body.persona_id, run_status: body.run_status ?? 'running' }
}

export async function updatePersonaWorkflowStatus(
  personaId: string,
  status: PersonaWorkflowStatus,
): Promise<void> {
  const { error } = await supabase.from('personas').update({ status }).eq('persona_id', personaId)
  if (error) throw error
}

export async function savePersonaContent(
  personaId: string,
  persona_content: PersonaContent,
  persona_name?: string | null,
  segment?: string | null,
): Promise<void> {
  const displayName = formatPersonaDisplayName(persona_content) || persona_name
  const { error } = await supabase
    .from('personas')
    .update({
      persona_content,
      persona_name: displayName ?? null,
      segment: segment ?? null,
    })
    .eq('persona_id', personaId)
  if (error) throw error
}

export async function deletePersona(personaId: string): Promise<void> {
  const { error } = await supabase.from('personas').delete().eq('persona_id', personaId)
  if (error) throw error
}

export async function duplicatePersonaRow(source: PersonaRow): Promise<PersonaRow> {
  const { data, error } = await supabase
    .from('personas')
    .insert({
      target_segment: source.target_segment,
      persona_name: source.persona_name ? `${source.persona_name} (copy)` : null,
      segment: source.segment,
      status: 'draft',
      persona_content: source.persona_content ?? {},
      sources: source.sources ?? [],
      run_metadata: {
        run_status: 'succeeded',
        stage: 'done',
        duplicated_from: source.persona_id,
        note: 'Duplicated in admin UI; no API run.',
      },
    })
    .select('*')
    .single()
  if (error) throw error
  return data as PersonaRow
}
