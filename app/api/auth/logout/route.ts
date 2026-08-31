import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, endSession } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'

export async function POST(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) endSession(token)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
