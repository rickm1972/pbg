import { supabase } from './supabaseClient'
import type { NormalizationInputs, ScoringInputRow } from '../types/agent'

export async function fetchScoringInputVersionsForProduct(
  productId: string,
): Promise<ScoringInputRow[]> {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .select('*')
    .eq('product_id', productId)
    .order('run_timestamp', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...(row as ScoringInputRow),
    inputs: (row as ScoringInputRow).inputs as NormalizationInputs,
  }))
}

export async function fetchScoringInputById(inputId: string): Promise<ScoringInputRow | null> {
  const { data, error } = await supabase
    .from('scoring_inputs')
    .select('*')
    .eq('input_id', inputId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const row = data as ScoringInputRow
  return { ...row, inputs: row.inputs as NormalizationInputs }
}

export async function fetchEvidenceSummaryForInput(evidenceId: string): Promise<{
  evidence_id: string
  bundle_version: number
  review_status: string
  product_id: string
} | null> {
  const { data, error } = await supabase
    .from('product_evidence')
    .select('evidence_id, bundle_version, review_status, product_id')
    .eq('evidence_id', evidenceId)
    .maybeSingle()

  if (error) throw error
  return data
}
