/**
 * Test-only migration SQL helpers.
 * Strips transaction control so BEGIN/ROLLBACK wrappers in smoke tests actually isolate writes.
 */
import { readFileSync } from 'node:fs'

/** Standalone SQL transaction control only — not PL/pgSQL `begin` block openers. */
const TX_LINE = /^\s*(begin|commit|rollback)\s*;\s*$/i

/**
 * Remove standalone BEGIN/COMMIT/ROLLBACK lines from migration SQL.
 * @param {string} sql
 */
export function stripMigrationTransactionControl(sql) {
  return sql
    .split('\n')
    .filter((line) => !TX_LINE.test(line.trim()))
    .join('\n')
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string[]} migrationPaths
 */
export async function applyTestMigrations(client, migrationPaths) {
  for (const path of migrationPaths) {
    const raw = readFileSync(path, 'utf8')
    const sql = stripMigrationTransactionControl(raw)
    if (!sql.trim()) continue
    await client.query(sql)
  }
}

/**
 * Fail if the outer test transaction was committed unexpectedly.
 * Uses SAVEPOINT probe — reliable on Supabase session pooler (txid_current_if_assigned may be null).
 * @param {import('pg').PoolClient} client
 */
export async function assertTestTransactionActive(client) {
  try {
    await client.query('SAVEPOINT __test_txn_probe')
    await client.query('ROLLBACK TO SAVEPOINT __test_txn_probe')
    await client.query('RELEASE SAVEPOINT __test_txn_probe')
  } catch {
    throw new Error('Test transaction was committed — migration SQL may still contain COMMIT')
  }
}

/**
 * @param {import('pg').PoolClient} client
 */
export async function beginTestTransaction(client) {
  await client.query('begin')
  await assertTestTransactionActive(client)
}

/**
 * Apply migration SQL only when probe table is missing (prod DB already has schema).
 * @param {import('pg').PoolClient} client
 * @param {string[]} migrationPaths
 * @param {string} [probeTable]
 */
export async function applyTestMigrationsIfNeeded(client, migrationPaths, probeTable = 'agent3_locked_outputs') {
  const exists = await client.query(`select to_regclass($1) as t`, [`public.${probeTable}`])
  if (exists.rows[0]?.t) return false
  await applyTestMigrations(client, migrationPaths)
  return true
}

/**
 * @param {import('pg').PoolClient} client
 */
export async function rollbackTestTransaction(client) {
  await client.query('rollback')
}
