import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { SHARE_MAX_BYTES, createShare } from '@/lib/server/share'
import { ConfigValidationError, parseProjectV4 } from '@/src/core/index'
import { toPublicProject } from '@/src/core/publicProject'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'

/**
 * Клиентке КОД жасау (qdesign «3D-көріністе ашу» сияқты).
 *
 * Жоба ЯДРОНЫҢ схемасымен тексеріледі: кез келген JSON-ды сақтап, клиенттің
 * бетінде құлатпау үшін. Аутентификация әдейі жоқ — `lib/server/share.ts`.
 */
export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const text = await request.text()
  if (text.length === 0) return NextResponse.json({ error: 'Пустой проект' }, { status: 400 })
  if (text.length > SHARE_MAX_BYTES) {
    return NextResponse.json({ error: 'Проект слишком большой для кода' }, { status: 413 })
  }
  let publicJson: string
  try {
    publicJson = JSON.stringify(toPublicProject(parseProjectV4(JSON.parse(text) as unknown)))
  } catch (error) {
    const message = error instanceof ConfigValidationError ? error.message : 'Проект не прочитался'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  const account = await currentAccount()
  if (account && !can(account.role, 'editProject')) {
    return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  }
  return NextResponse.json(createShare(publicJson, Date.now(), account?.shopId))
}
