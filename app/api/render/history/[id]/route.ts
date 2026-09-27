/** Тарихтағы бір рендер: GET — PNG суреті, DELETE — өшіру. Бөтен жазба — 404. */

import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { deleteRenderRecord, readRenderImage } from '@/lib/server/renderHistory'
import { currentAccount } from '@/lib/server/session'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  const { id } = await context.params
  const image = readRenderImage(account, id)
  if (!image) return NextResponse.json({ error: 'Рендер не найден' }, { status: 404 })
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' },
  })
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  const { id } = await context.params
  if (!deleteRenderRecord(account, id)) return NextResponse.json({ error: 'Рендер не найден' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
