import { currentAccount } from '@/lib/server/session'
import { objectStorage } from '@/lib/server/objectStorage'

type Context = { params: Promise<{ kind: string; id: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Кіру қажет' }, { status: 401 })
  const { kind, id } = await context.params
  if (account.role === 'shop' && kind !== 'photo') return Response.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  try {
    const object = await objectStorage().get(account.shopId, `${kind}/${id}`)
    if (!object) return Response.json({ error: 'Табылмады' }, { status: 404 })
    return new Response(Uint8Array.from(object.bytes).buffer, { headers: {
      'Content-Type': object.contentType, 'Content-Disposition': 'attachment',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (cause) {
    if (cause instanceof Error && /жарамсыз/.test(cause.message)) return Response.json({ error: cause.message }, { status: 400 })
    throw cause
  }
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Кіру қажет' }, { status: 401 })
  if (account.role === 'shop') return Response.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  const { kind, id } = await context.params
  try {
    await objectStorage().delete(account.shopId, `${kind}/${id}`)
    return Response.json({ ok: true })
  } catch (cause) {
    if (cause instanceof Error && /жарамсыз/.test(cause.message)) return Response.json({ error: cause.message }, { status: 400 })
    throw cause
  }
}
