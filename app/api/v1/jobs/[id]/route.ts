import { currentAccount } from '@/lib/server/session'
import { readJob } from '@/lib/server/jobs'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Кіру қажет' }, { status: 401 })
  const { id } = await context.params
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: 'ID жарамсыз' }, { status: 400 })
  const job = await readJob(account.shopId, id)
  if (!job) return Response.json({ error: 'Табылмады' }, { status: 404 })
  return Response.json({ id: job.id, kind: job.kind, state: job.state, attempts: job.attempts,
    result: job.result_json ? JSON.parse(job.result_json) as unknown : null,
    error: job.state === 'failed' ? job.last_error : null },
  { headers: { 'Cache-Control': 'private, no-store' } })
}
