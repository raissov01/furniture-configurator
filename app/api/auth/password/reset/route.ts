import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { consumePasswordReset } from '@/lib/server/passwordReset'
import { MIN_PASSWORD } from '@/lib/server/auth'

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const body: unknown = await request.json().catch(() => null)
  const token = body && typeof body === 'object' && 'token' in body && typeof body.token === 'string' ? body.token : ''
  const password = body && typeof body === 'object' && 'password' in body && typeof body.password === 'string' ? body.password : ''
  if (password.length < MIN_PASSWORD || password.length > 1024) {
    return NextResponse.json({ error: `Пароль: допустимо ${MIN_PASSWORD}–1024 символа` }, { status: 400 })
  }
  if (!consumePasswordReset(token, password)) {
    return NextResponse.json({ error: 'Ссылка недействительна или срок истёк' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
