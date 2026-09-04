import { NextResponse } from 'next/server'
import { canAddMember } from '@/lib/plans'
import { cloudOff } from '@/lib/server/cloud'
import { readPlan, usageOf } from '@/lib/server/plan'
import { currentAccount } from '@/lib/server/session'
import { createInvite, listInvites, listMembers, revokeInvite } from '@/lib/server/team'

/** Команда: кім бар, қандай шақыру ашық тұр. */
export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const { plan } = readPlan(account.shopId)
  return NextResponse.json({
    members: listMembers(account.shopId),
    invites: listInvites(account.shopId),
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
export async function POST(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const { plan } = readPlan(account.shopId)
  const check = canAddMember(plan, usageOf(account.shopId))
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

  const invite = createInvite(account.shopId, account.userId)
  return NextResponse.json({ invite })
}

/** Шақыруды қайтарып алу. Қабылданғанға әсер етпейді — адам цехта қалады. */
export async function DELETE(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) return NextResponse.json({ error: 'Не указан токен' }, { status: 400 })

  revokeInvite(account.shopId, token)
  return NextResponse.json({ ok: true })
}
