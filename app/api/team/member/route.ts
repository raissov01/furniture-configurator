import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { currentAccount } from '@/lib/server/session'
import { listMembers, removeMember, setMemberRole } from '@/lib/server/team'
import { can } from '@/lib/permissions'

/**
 * Адамды цехтан шығару.
 *
 * Бөлек маршрут: `/api/team` DELETE-і ШАҚЫРУДЫ қайтарып алады, ал бұл —
 * адамды шығарады. Екеуін бір денеге сыйдырсақ («token бе, әлде userId ме»),
 * қателескен сұраныс үнсіз басқа әрекет жасар еді.
 */
export async function DELETE(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!userId) return NextResponse.json({ error: 'Не указан человек' }, { status: 400 })
  if (!can(account.role, 'manageTeam') && userId !== account.userId) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }

  const result = removeMember(account.shopId, account.userId, userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 })

  // Тізімді бірден қайтарамыз: клиент екінші сұраныс жасамауы керек.
  return NextResponse.json({ members: listMembers(account.shopId) })
}

/** Owner may switch an existing member between designer and shop. */
export async function PATCH(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'manageTeam')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('userId' in body) || !('role' in body)
    || typeof body.userId !== 'string' || body.userId.length > 100
    || (body.role !== 'designer' && body.role !== 'shop')) {
    return NextResponse.json({ error: 'Нужны userId и роль designer или shop' }, { status: 400 })
  }
  if (!setMemberRole(account.shopId, body.userId, body.role, account.userId)) {
    return NextResponse.json({ error: 'Участник не найден или владелец' }, { status: 404 })
  }
  return NextResponse.json({ members: listMembers(account.shopId) })
}
