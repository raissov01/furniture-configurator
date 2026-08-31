import { NextResponse } from 'next/server'
import { SESSION_COOKIE, login, sessionCookieOptions } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const result = login(email, password)
  // 401: пошта тіркелген бе екенін білдірмейміз — хабар да бірдей.
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })

  const response = NextResponse.json({ account: result.account })
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions)
  return response
}
