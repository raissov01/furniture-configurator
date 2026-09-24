import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { SHARE_MAX_BYTES, readShare, updateShare } from '@/lib/server/share'
import { ConfigValidationError, parseProjectV4 } from '@/src/core/index'
import { toPublicProject } from '@/src/core/publicProject'

type Context = { params: Promise<{ code: string }> }

/** Жобаны кодпен беру. Клиенттің беті мұны 5 с сайын сұрайды (автожаңарту). */
export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const { code } = await params
  const row = readShare(code)
  if (!row) return NextResponse.json({ error: 'Код не найден или его срок истёк' }, { status: 404 })
  let project: unknown
  try {
    project = toPublicProject(parseProjectV4(JSON.parse(row.json) as unknown))
  } catch {
    return NextResponse.json({ error: 'Проект по коду повреждён' }, { status: 422 })
  }
  return NextResponse.json(
    { project, updatedAt: row.updatedAt, expiresAt: row.expiresAt },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** Автоматты жаңарту: кодты жасаған цех жобаны кілтпен қайта жібереді. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const { code } = await params
  const key = request.headers.get('x-share-key') ?? ''
  const text = await request.text()
  if (text.length === 0 || text.length > SHARE_MAX_BYTES) {
    return NextResponse.json({ error: 'Неверный размер проекта' }, { status: 400 })
  }
  let publicJson: string
  try {
    publicJson = JSON.stringify(toPublicProject(parseProjectV4(JSON.parse(text) as unknown)))
  } catch (error) {
    const message = error instanceof ConfigValidationError ? error.message : 'Проект не прочитался'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (!updateShare(code, key, publicJson)) {
    return NextResponse.json({ error: 'Код не найден, истёк или ключ неверный' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
