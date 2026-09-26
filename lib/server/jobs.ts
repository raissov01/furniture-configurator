import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

export type JobKind = 'render' | 'xlsx' | 'installation_sync'
export type JobRow = {
  id: string; shop_id: string; kind: JobKind; payload_json: string; state: string;
  attempts: number; lease_token: string | null; result_json: string | null; last_error: string | null
}

let pool: Pool | undefined
function database(): Pool {
  const url = process.env['DATABASE_URL']
  if (!url?.startsWith('postgres')) throw new Error('Фондық кезекке PostgreSQL қажет')
  pool ??= new Pool({ connectionString: url, max: 3 })
  return pool
}

export async function enqueueJob(shopId: string, kind: JobKind, payload: unknown, now = Date.now()): Promise<string> {
  const id = randomUUID()
  await database().query(`INSERT INTO jobs (id, shop_id, kind, payload_json, run_after, created_at)
    VALUES ($1,$2,$3,$4,$5,$5)`, [id, shopId, kind, JSON.stringify(payload), now])
  return id
}

export async function readJob(shopId: string, id: string): Promise<JobRow | null> {
  const result = await database().query<JobRow>('SELECT * FROM jobs WHERE shop_id = $1 AND id = $2', [shopId, id])
  return result.rows[0] ?? null
}

/** PostgreSQL row lock ensures one worker claims a job, even with two API replicas. */
export async function claimJob(now = Date.now()): Promise<JobRow | null> {
  const token = randomUUID()
  const result = await database().query<JobRow>(`UPDATE jobs SET state = 'running', attempts = attempts + 1,
    lease_until = $1, lease_token = $2 WHERE id = (
      SELECT id FROM jobs WHERE (state = 'pending' AND run_after <= $3)
      OR (state = 'running' AND lease_until < $3)
      ORDER BY run_after, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING *`, [now + 5 * 60_000, token, now])
  return result.rows[0] ?? null
}

export async function completeJob(job: JobRow, result: unknown): Promise<boolean> {
  const done = await database().query(`UPDATE jobs SET state = 'done', result_json = $1,
    lease_until = NULL, lease_token = NULL WHERE id = $2 AND lease_token = $3 AND state = 'running'`,
    [JSON.stringify(result), job.id, job.lease_token])
  return done.rowCount === 1
}

export async function extendJobLease(job: JobRow, now = Date.now()): Promise<boolean> {
  const renewed = await database().query(`UPDATE jobs SET lease_until = $1 WHERE id = $2 AND lease_token = $3 AND state = 'running'`,
    [now + 5 * 60_000, job.id, job.lease_token])
  return renewed.rowCount === 1
}

export async function failJob(job: JobRow, cause: unknown, now = Date.now()): Promise<void> {
  const message = cause instanceof Error ? cause.message : String(cause)
  const terminal = job.attempts >= 3
  await database().query(`UPDATE jobs SET state = $1, run_after = $2, last_error = $3,
    lease_until = NULL, lease_token = NULL WHERE id = $4 AND lease_token = $5 AND state = 'running'`,
    [terminal ? 'failed' : 'pending', now + Math.min(job.attempts * 30_000, 120_000), message.slice(0, 1000), job.id, job.lease_token])
}
