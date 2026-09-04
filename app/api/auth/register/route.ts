import { NextResponse } from 'next/server'
import { SESSION_COOKIE, register, sessionCookieOptions } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'
import { canAddMember } from '@/lib/plans'
import { readPlan, usageOf } from '@/lib/server/plan'
import { checkInvite, markInviteUsed } from '@/lib/server/team'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; shopName?: unknown; invite?: unknown }
    | null
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const shopName = typeof body?.shopName === 'string' ? body.shopName : ''
  const invite = typeof body?.invite === 'string' && body.invite ? body.invite : null

  /*
   * Шақырумен тіркелу. Лимит ДӘЛ ОСЫ СӘТТЕ қайта тексеріледі: шақыру
   * жіберілгеннен бері цехқа басқа адам қосылып, орын бітіп қалуы мүмкін.
   */
  let joinShopId: string | undefined
  if (invite) {
    const check = checkInvite(invite)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })

    const { plan } = readPlan(check.shopId)
    const room = canAddMember(plan, usageOf(check.shopId))
    if (!room.ok) return NextResponse.json({ error: room.reason }, { status: 409 })
    joinShopId = check.shopId
  }

  const result = register(email, password, shopName, joinShopId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  if (invite) markInviteUsed(invite, result.account.userId)

  const response = NextResponse.json({ account: result.account })
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions)
  return response
}
