import { z } from 'zod'
import { currentAccount } from '@/lib/server/session'
import { enqueueJob } from '@/lib/server/jobs'
import { parseInstallationAction } from '@/src/core/installation'
import { can } from '@/lib/permissions'

const Render = z.object({ kind: z.literal('render'), key: z.string().regex(/^photo\/[0-9a-f-]{36}$/),
  hint: z.string().max(300).optional(), style: z.enum(['scandinavian', 'modern', 'loft', 'classic']).optional() })
const Xlsx = z.object({ kind: z.literal('xlsx'), projectId: z.uuid() })
const Sync = z.object({ kind: z.literal('installation_sync'), action: z.unknown() })
const Input = z.discriminatedUnion('kind', [Render, Xlsx, Sync])

export async function POST(request: Request): Promise<Response> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Кіру қажет' }, { status: 401 })
  if (!process.env['DATABASE_URL']?.startsWith('postgres')) return Response.json({ error: 'Кезек PostgreSQL режимінде жұмыс істейді' }, { status: 503 })
  const raw = await request.text()
  if (raw.length > 20_000) return Response.json({ error: 'Сұраныс тым үлкен' }, { status: 413 })
  let json: unknown
  try { json = JSON.parse(raw) as unknown } catch { return Response.json({ error: 'JSON жарамсыз' }, { status: 400 }) }
  const parsed = Input.safeParse(json)
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 })
  const input = parsed.data
  if (input.kind === 'installation_sync' && account.role !== 'shop' && account.role !== 'owner') return Response.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  if (input.kind !== 'installation_sync' && !can(account.role, 'editProject')) return Response.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  let payload: unknown = input
  if (input.kind === 'installation_sync') {
    try { payload = parseInstallationAction(input.action) } catch { return Response.json({ error: 'Монтаж әрекеті жарамсыз' }, { status: 400 }) }
  }
  const id = await enqueueJob(account.shopId, input.kind, payload)
  return Response.json({ id, state: 'pending' }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } })
}
