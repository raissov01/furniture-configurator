import { randomUUID } from 'node:crypto'
import { readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { AR_TTL_MS, arDir } from '@/lib/server/arStorage'
import { currentAccount } from '@/lib/server/session'
import { can } from '@/lib/permissions'
import { readLimitedBody } from '@/lib/server/readLimitedBody'

/**
 * AR үшін GLB қабылдау.
 *
 * ⚠ ФАЙЛ УАҚЫТША. Телефон оны бір рет ашады да, әрі қарай керегі жоқ;
 * сақтап отырсақ, диск бір айда толып қалар еді. Сондықтан әр жүктеуде
 * ЕСКІЛЕРІ тазаланады (1 сағаттан асқаны).
 *
 * Жүктеу жоба өңдеушісіне ғана рұқсат. Телефондағы ашық GET сілтемесі
 * бөлек маршрутта және UUID арқылы беріледі.
 */
const MAX_BYTES = 25 * 1024 * 1024

function sweep(dir: string, now: number): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    try {
      if (now - statSync(path).mtimeMs > AR_TTL_MS) rmSync(path)
    } catch (cause) {
      // Файл дәл сол сәтте өшірілген болуы мүмкін — бұл қате емес.
      if (!(cause instanceof Error && 'code' in cause && cause.code === 'ENOENT')) throw cause
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Кіру қажет' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Рұқсат жоқ' }, { status: 403 })

  const body = await readLimitedBody(request, MAX_BYTES)
  if (!body) return NextResponse.json({ error: 'Модель слишком большая для AR' }, { status: 413 })
  if (body.byteLength === 0) return NextResponse.json({ error: 'Пустой файл' }, { status: 400 })

  const dir = arDir()
  const now = Date.now()
  sweep(dir, now)

  const id = randomUUID()
  writeFileSync(join(dir, `${id}.glb`), body)
  return NextResponse.json({ id, expiresAt: now + AR_TTL_MS })
}
