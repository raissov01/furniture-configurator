import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { SHARE_MAX_BYTES, createShare } from '@/lib/server/share'
import { ConfigValidationError, parseProjectV4 } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'
import { publicProjectForShare } from '@/lib/server/publicShare'
import { allowAnonymousShareCreate, isAnonymousShareCreateLimited, requestIp } from '@/lib/server/rateLimit'
import { readLimitedBody } from '@/lib/server/readLimitedBody'

/**
 * Клиентке КОД жасау (qdesign «3D-көріністе ашу» сияқты).
 *
 * Жоба ЯДРОНЫҢ схемасымен тексеріледі: кез келген JSON-ды сақтап, клиенттің
 * бетінде құлатпау үшін. Аутентификация әдейі жоқ — `lib/server/share.ts`.
 */
export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (account && !can(account.role, 'editProject')) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }
  const ip = account ? '' : requestIp(request)
  if (!account && isAnonymousShareCreateLimited(ip)) {
    return NextResponse.json({ error: 'Тым көп код жасалды. Кейінірек қайталаңыз' }, { status: 429 })
  }
  const bytes = await readLimitedBody(request, SHARE_MAX_BYTES)
  if (!bytes) return NextResponse.json({ error: 'Проект слишком большой для кода' }, { status: 413 })
  const text = new TextDecoder().decode(bytes)
  if (text.length === 0) return NextResponse.json({ error: 'Пустой проект' }, { status: 400 })
  let publicJson: string
  try {
    publicJson = JSON.stringify(publicProjectForShare(parseProjectV4(JSON.parse(text) as unknown), account?.shopId))
  } catch (error) {
    const message = error instanceof ConfigValidationError ? error.message : 'Проект не прочитался'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (!account && !allowAnonymousShareCreate(ip)) {
    return NextResponse.json({ error: 'Тым көп код жасалды. Кейінірек қайталаңыз' }, { status: 429 })
  }
  return NextResponse.json(createShare(publicJson, Date.now(), account?.shopId))
}
