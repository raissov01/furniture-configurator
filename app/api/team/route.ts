import { NextResponse } from 'next/server'
import { canAddMember } from '@/lib/plans'
import { cloudOff } from '@/lib/server/cloud'
import { readPlan, usageOf } from '@/lib/server/plan'
import { currentAccount } from '@/lib/server/session'
import { createInvite, listInvites, listMembers, revokeInvite } from '@/lib/server/team'
import { can } from '@/lib/permissions'

/** Команда: кім бар, қандай шақыру ашық тұр. */
export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readTeam')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

  const { plan } = readPlan(account.shopId)
  return NextResponse.json({
    members: listMembers(account.shopId),
    invites: can(account.role, 'manageTeam') ? listInvites(account.shopId) : [],
    limit: plan.members,
  })
}

/**
 * Жаңа шақыру.
 *
 * Лимит ЕКІ РЕТ тексеріледі: осында да, шақыруды ҚАБЫЛДАҒАНДА да. Себебі
 * шақыру мен қабылдаудың арасында апта өтуі мүмкін, ал сол уақытта цехқа
 * басқа адам қосылып, орын бітіп қалуы ықтимал.
 */
export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'manageTeam')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

  const text = await request.text()
  if (text.length > 1000) return NextResponse.json({ error: 'Запрос слишком большой' }, { status: 413 })
  let body: unknown = null
  if (text.length > 0) {
    try { body = JSON.parse(text) as unknown } catch {
      return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Нужна роль designer или shop' }, { status: 400 })
    }
  }
  const role = body && typeof body === 'object' && 'role' in body ? body.role : 'designer'
  if (role !== 'designer' && role !== 'shop') {
    return NextResponse.json({ error: 'Роль должна быть designer или shop' }, { status: 400 })
  }

  const { plan } = readPlan(account.shopId)
  const check = canAddMember(plan, usageOf(account.shopId))
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

  const invite = createInvite(account.shopId, account.userId, Date.now(), role)
  return NextResponse.json({ invite })
}

/** Шақыруды қайтарып алу. Қабылданғанға әсер етпейді — адам цехта қалады. */
export async function DELETE(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'manageTeam')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) return NextResponse.json({ error: 'Не указан токен' }, { status: 400 })

  revokeInvite(account.shopId, token)
  return NextResponse.json({ ok: true })
}
