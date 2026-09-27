import { NextResponse } from 'next/server'
import { SESSION_COOKIE, login, sessionCookieOptions } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'
import { isLoginLimited, recordLoginMiss, requestIp } from '@/lib/server/rateLimit'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const ip = requestIp(request)

  if (isLoginLimited(ip, email)) {
    return NextResponse.json({ error: 'Почта или пароль не подходят' }, { status: 429, headers: { 'Retry-After': '3600' } })
  }

  const result = login(email, password)
  // 401: пошта тіркелген бе екенін білдірмейміз — хабар да бірдей.
  if (!result.ok) {
    recordLoginMiss(ip, email)
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  const response = NextResponse.json({ account: result.account })
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions)
  return response
}
