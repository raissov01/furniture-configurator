import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { SHARE_MAX_BYTES, ownsShareKey, readShare, shareShopId, updateShare } from '@/lib/server/share'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'
import { allowShareMiss, isShareLimited, requestIp } from '@/lib/server/rateLimit'
import { ConfigValidationError, parseProjectV4 } from '@/src/core/index'
import { toPublicProject } from '@/src/core/publicProject'
import { publicProjectForShare } from '@/lib/server/publicShare'
import { readLimitedBody } from '@/lib/server/readLimitedBody'

type Context = { params: Promise<{ code: string }> }

/** Жобаны кодпен беру. Клиенттің беті мұны 5 с сайын сұрайды (автожаңарту). */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const { code } = await params
  const ip = requestIp(request)
  if (isShareLimited(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
  const row = readShare(code)
  if (!row) {
    if (!allowShareMiss(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
    return NextResponse.json({ error: 'Код не найден или его срок истёк' }, { status: 404 })
  }
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
  const ip = requestIp(request)
  if (isShareLimited(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
  const key = request.headers.get('x-share-key') ?? ''
  const shopId = shareShopId(code)
  if (shopId === undefined) {
    if (!allowShareMiss(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
    return NextResponse.json({ error: 'Код не найден немесе истёк' }, { status: 404 })
  }
  const account = shopId ? await currentAccount() : null
  if (shopId && !account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (shopId && (account?.shopId !== shopId || !can(account.role, 'editProject'))) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }
  if (!shopId && !ownsShareKey(code, key)) {
    return NextResponse.json({ error: 'Код не найден, истёк или ключ неверный' }, { status: 404 })
  }
  const bytes = await readLimitedBody(request, SHARE_MAX_BYTES)
  if (!bytes) return NextResponse.json({ error: 'Неверный размер проекта' }, { status: 413 })
  const text = new TextDecoder().decode(bytes)
  if (text.length === 0) {
    return NextResponse.json({ error: 'Неверный размер проекта' }, { status: 400 })
  }
  let publicJson: string
  try {
    publicJson = JSON.stringify(publicProjectForShare(parseProjectV4(JSON.parse(text) as unknown), account?.shopId))
  } catch (error) {
    const message = error instanceof ConfigValidationError ? error.message : 'Проект не прочитался'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (!updateShare(code, key, publicJson, Date.now(), shopId ?? undefined)) {
    return NextResponse.json({ error: 'Код не найден, истёк или ключ неверный' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
