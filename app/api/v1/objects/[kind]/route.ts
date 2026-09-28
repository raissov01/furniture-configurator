import { currentAccount } from '@/lib/server/session'
import { objectStorage, type ObjectKind } from '@/lib/server/objectStorage'
import { can } from '@/lib/permissions'

type Context = { params: Promise<{ kind: string }> }
const KINDS = new Set<ObjectKind>(['photo', 'render', 'library', 'shop-library', 'export'])

export async function POST(request: Request, context: Context): Promise<Response> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Кіру қажет' }, { status: 401 })
  const { kind } = await context.params
  if (!can(account.role, 'editProject') && !(account.role === 'shop' && kind === 'photo')) {
    return Response.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  }
  if (!KINDS.has(kind as ObjectKind)) return Response.json({ error: 'Файл түрі жарамсыз' }, { status: 400 })
  const length = Number(request.headers.get('content-length'))
  if (Number.isFinite(length) && length > 25_000_000) return Response.json({ error: 'Файл тым үлкен' }, { status: 413 })
  const reader = request.body?.getReader()
  if (!reader) return Response.json({ error: 'Файл бос' }, { status: 400 })
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > 25_000_000) { await reader.cancel(); return Response.json({ error: 'Файл тым үлкен' }, { status: 413 }) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    const key = await objectStorage().put(account.shopId, kind as ObjectKind, bytes, request.headers.get('content-type') ?? '')
    return Response.json({ key }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (cause) {
    if (cause instanceof Error && /жарамсыз|аспауы/.test(cause.message)) return Response.json({ error: cause.message }, { status: 400 })
    throw cause
  }
}
