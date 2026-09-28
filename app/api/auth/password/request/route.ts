import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { issuePasswordReset } from '@/lib/server/passwordReset'
import { allowPasswordResetRequest, requestIp } from '@/lib/server/rateLimit'
import { passwordResetMailMode, sendPasswordReset } from '@/lib/server/resetMail'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const body: unknown = await request.json().catch(() => null)
  const email = body && typeof body === 'object' && 'email' in body && typeof body.email === 'string'
    ? body.email.trim().toLowerCase() : ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Почта: укажите действительный адрес' }, { status: 400 })
  }
  if (!allowPasswordResetRequest(requestIp(request), email)) {
    return NextResponse.json({ error: 'Слишком много запросов. Повторите через час.' },
      { status: 429, headers: { 'Retry-After': '3600' } })
  }
  const issued = issuePasswordReset(email)
  let delivery = passwordResetMailMode()
  if (issued) {
    const base = process.env['APP_URL'] ?? new URL(request.url).origin
    const url = new URL('/reset-password', base)
    url.searchParams.set('token', issued.token)
    delivery = await sendPasswordReset(issued.email, url.toString())
  }
  // Белгісіз пошта да сол жауапты алады: аккаунттарды іздеп табуға болмайды.
  return NextResponse.json({ ok: true, delivery })
}
