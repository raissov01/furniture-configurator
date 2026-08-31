import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, accountFromToken } from '@/lib/server/auth'
import { cloudOff } from '@/lib/server/cloud'

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const jar = await cookies()
  const account = accountFromToken(jar.get(SESSION_COOKIE)?.value)
  if (!account) return NextResponse.json({ account: null }, { status: 200 })
  return NextResponse.json({ account })
}
