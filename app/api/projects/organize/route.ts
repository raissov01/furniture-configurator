import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'
import { readCloudOrg, writeCloudOrg } from '@/lib/server/store'
import { parseCloudOrg } from '@/src/core/cloudProjectOrganize'

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  return NextResponse.json({ org: readCloudOrg(account.shopId, account.userId) })
}

export async function PUT(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const body = await request.json().catch(() => null) as { org?: unknown } | null
  if (!body || body.org === undefined) return NextResponse.json({ error: 'Требуется org' }, { status: 400 })
  try {
    const org = parseCloudOrg(JSON.stringify(body.org))
    writeCloudOrg(account.shopId, account.userId, org)
    return NextResponse.json({ org })
  } catch (error) {
    return NextResponse.json({ error: `Папки не приняты: ${error instanceof Error ? error.message : 'неверная форма'}` }, { status: 400 })
  }
}
