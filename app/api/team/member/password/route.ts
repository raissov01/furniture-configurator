import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'
import { issueMemberPasswordReset } from '@/lib/server/passwordReset'
import { allowPasswordResetRequest, requestIp } from '@/lib/server/rateLimit'
import { sendPasswordReset } from '@/lib/server/resetMail'
import { cloudOff } from '@/lib/server/cloud'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'manageTeam')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const body: unknown = await request.json().catch(() => null)
  const userId = body && typeof body === 'object' && 'userId' in body && typeof body.userId === 'string' ? body.userId : ''
  if (!userId || userId.length > 100) return NextResponse.json({ error: 'Участник: нужен ID' }, { status: 400 })
  if (!allowPasswordResetRequest(requestIp(request), `${account.shopId}:${userId}`)) {
    return NextResponse.json({ error: 'Слишком много запросов. Повторите через час.' },
      { status: 429, headers: { 'Retry-After': '3600' } })
  }
  const issued = issueMemberPasswordReset(account.shopId, userId, account.userId)
  if (!issued) return NextResponse.json({ error: 'Участник не найден' }, { status: 404 })
  const base = process.env['APP_URL'] ?? new URL(request.url).origin
  const url = new URL('/reset-password', base)
  url.searchParams.set('token', issued.token)
  const delivery = await sendPasswordReset(issued.email, url.toString())
  return NextResponse.json({ ok: true, delivery })
}
