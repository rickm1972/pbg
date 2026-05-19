import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** PostgREST / GoTrue errors are often plain objects, not `instanceof Error`. */
export function formatSupabaseUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message || fallback
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m.length > 0) {
      const details = (error as { details?: unknown }).details
      const hint = (error as { hint?: unknown }).hint
      const parts: string[] = [m]
      if (typeof details === 'string' && details.length > 0) parts.push(details)
      if (typeof hint === 'string' && hint.length > 0) parts.push(hint)
      return parts.join(' — ')
    }
  }
  return fallback
}

