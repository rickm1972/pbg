import { supabase } from './supabaseClient'
import type { CertificationVerifiedRow } from '../types/agent'

/** Badge label from Agent 1 verification row — never invent copy. */
export function certificationBadgeLabel(certificationName: string): string {
  const name = certificationName.trim()
  if (/ewg\s*low\s*hazard/i.test(name)) return 'EWG Low Hazard'
  return name
}

function shouldShowVerifiedCertification(certificationName: string): boolean {
  const name = certificationName.trim()
  if (!name) return false
  // Marketing claim blobs (e.g. Lodge PFAS-Free / Made in USA prose) are not registry-verified certs.
  if (name.includes(';')) return false
  if (/manufacturer claim|manufacturer confirmed|not independently verified/i.test(name)) {
    return false
  }
  if (/^(pfas[- ]?free|pfoa|ptfe|made in usa|non[- ]?toxic)\b/i.test(name)) return false
  if (/ewg\s*low\s*hazard/i.test(name)) return true
  if (/ewg\s*verified/i.test(name)) return false
  if (/not ewg verified|not confirmed for|does not have ewg verified/i.test(name)) return false
  return true
}

export async function fetchVerifiedCertificationNames(
  productId: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_verified_certifications', {
    p_product_id: productId,
  })

  if (error) throw error

  const rows = (data ?? []) as CertificationVerifiedRow[]
  if (!Array.isArray(rows)) return []

  return rows
    .filter((row) => row.found_in_page_content === true)
    .filter((row) => shouldShowVerifiedCertification(row.certification_name))
    .map((row) => certificationBadgeLabel(row.certification_name))
    .filter(Boolean)
}
