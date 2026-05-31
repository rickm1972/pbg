import { supabase } from './supabaseClient'

export async function createQuizResponse(userAgent: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('quiz_response_create', {
    p_user_agent: userAgent,
  })
  if (error) throw error
  if (!data) throw new Error('Quiz response create returned empty id')
  return String(data)
}

export type QuizResponsePatch = {
  completed_at?: string | null
  user_email?: string | null
  first_name?: string | null
  final_score?: number | null
  letter_grade?: string | null
  tier?: string | null
  scored_answers?: Record<string, unknown> | null
  awareness_answers?: Record<string, unknown> | null
  motivation_answers?: Record<string, unknown> | null
}

export type QuizResponseSnapshot = {
  response_id?: string
  scored_answers?: Record<string, unknown>
  awareness_answers?: Record<string, unknown>
  motivation_answers?: Record<string, unknown>
  final_score?: number | null
  letter_grade?: string | null
  tier?: string | null
  completed_at?: string | null
}

/** Empty {} must not be sent — RPC would replace stored answers and wipe prior saves. */
function jsonbPatchValue(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  if (Object.keys(value).length === 0) return null
  return value
}

export async function fetchQuizResponse(responseId: string): Promise<QuizResponseSnapshot | null> {
  const { data, error } = await supabase.rpc('quiz_response_get', {
    p_response_id: responseId,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  return data as QuizResponseSnapshot
}

export async function patchQuizResponse(
  responseId: string,
  patch: QuizResponsePatch,
): Promise<void> {
  const { error } = await supabase.rpc('quiz_response_patch', {
    p_response_id: responseId,
    p_completed_at: patch.completed_at ?? null,
    p_user_email: patch.user_email ?? null,
    p_first_name: patch.first_name ?? null,
    p_final_score: patch.final_score ?? null,
    p_letter_grade: patch.letter_grade ?? null,
    p_tier: patch.tier ?? null,
    p_scored_answers: jsonbPatchValue(patch.scored_answers),
    p_awareness_answers: jsonbPatchValue(patch.awareness_answers),
    p_motivation_answers: jsonbPatchValue(patch.motivation_answers),
  })
  if (error) throw error
}
