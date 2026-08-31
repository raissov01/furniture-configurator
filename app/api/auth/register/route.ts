import { NextResponse } from 'next/server'
import { SESSION_COOKIE, register, sessionCookieOptions } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; shopName?: unknown }
    | null
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const shopName = typeof body?.shopName === 'string' ? body.shopName : ''

  const result = register(email, password, shopName)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const response = NextResponse.json({ account: result.account })
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions)
  return response
}
