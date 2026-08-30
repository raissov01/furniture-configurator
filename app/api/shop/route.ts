import { NextResponse } from 'next/server'
import { parseShopProfile } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { readShopProfile, writeShopProfile } from '@/lib/server/store'

export async function GET(): Promise<Response> {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  return NextResponse.json({ profile: readShopProfile(account.shopId) })
}

export async function PUT(request: Request): Promise<Response> {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { profile?: unknown } | null
  try {
    // Пішінін ЯДРО тексереді: серверге бүлінген профиль жазылмауы керек.
    const profile = parseShopProfile(body?.profile)
    writeShopProfile(account.shopId, profile)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: `Профиль не принят: ${error instanceof Error ? error.message : 'неверная форма'}` },
      { status: 400 },
    )
  }
}
