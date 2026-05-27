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
    p_scored_answers: patch.scored_answers ?? null,
    p_awareness_answers: patch.awareness_answers ?? null,
    p_motivation_answers: patch.motivation_answers ?? null,
  })
  if (error) throw error
}

