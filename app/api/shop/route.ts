import { NextResponse } from 'next/server'
import { parseShopProfile } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { readShopProfile, writeShopProfile } from '@/lib/server/store'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'
import { toProductionShopProfile } from '@/src/core/publicShop'
import { migrateBandThreshold } from '@/src/core/migrateBandThreshold'

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readProduction')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const stored = readShopProfile(account.shopId)
  if (!stored) return NextResponse.json({ profile: null })
  try {
    const migrated = migrateBandThreshold(stored)
    const profile = parseShopProfile(migrated.value)
    return NextResponse.json({ profile: can(account.role, 'readInternalPrice') ? profile : toProductionShopProfile(profile),
      warnings: migrated.warnings })
  } catch (error) {
    return NextResponse.json({ error: `Сақталған цех профилін оқу мүмкін емес: ${error instanceof Error ? error.message : String(error)}` },
      { status: 422 })
  }
}

export async function PUT(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'manageShop')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { profile?: unknown } | null
  try {
    // Пішінін ЯДРО тексереді: серверге бүлінген профиль жазылмауы керек.
    const profile = parseShopProfile(body?.profile)
    writeShopProfile(account.shopId, profile, account.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: `Профиль не принят: ${error instanceof Error ? error.message : 'неверная форма'}` },
      { status: 400 },
    )
  }
}
