import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cloudOff } from '@/lib/server/cloud'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'
import { deleteLibraryItem, LibraryLimitError, listLibraryItems, writeLibraryItem } from '@/lib/server/library'
import { parseLibraryItem } from '@/src/core/library'

const MAX_ITEM_BYTES = 2 * 1024 * 1024

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readProduction')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  return NextResponse.json(listLibraryItems(account.userId))
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const text = await request.text()
  if (text.length > MAX_ITEM_BYTES) return NextResponse.json({ error: 'Элемент слишком большой' }, { status: 413 })
  try {
    const body = z.strictObject({ item: z.unknown() }).parse(JSON.parse(text) as unknown)
    const item = parseLibraryItem(body.item)
    writeLibraryItem(account.userId, item)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof LibraryLimitError) return NextResponse.json({ error: error.message }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Неверный элемент' }, { status: 400 })
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  let id: string
  try { id = z.strictObject({ id: z.string().min(1).max(100) }).parse(await request.json()).id }
  catch { return NextResponse.json({ error: 'Нужен id' }, { status: 400 }) }
  if (!deleteLibraryItem(account.userId, id)) return NextResponse.json({ error: 'Элемент не найден' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
