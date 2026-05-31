import { randomUUID } from 'node:crypto'

/** @type {Map<string, { personaId: string, expiresAt: number }>} */
const tokens = new Map()

const TTL_MS = 120_000

export function createExportToken(personaId) {
  const token = randomUUID()
  tokens.set(token, { personaId, expiresAt: Date.now() + TTL_MS })
  return token
}

export function validateExportToken(token, personaId) {
  if (!token || !personaId) return false
  const entry = tokens.get(token)
  if (!entry) return false
  if (entry.personaId !== personaId) return false
  if (Date.now() > entry.expiresAt) return false
  return true
}

export function revokeExportToken(token) {
  if (token) tokens.delete(token)
}
