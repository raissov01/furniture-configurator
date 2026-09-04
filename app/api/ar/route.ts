import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'

/**
 * AR үшін GLB қабылдау.
 *
 * ⚠ ФАЙЛ УАҚЫТША. Телефон оны бір рет ашады да, әрі қарай керегі жоқ;
 * сақтап отырсақ, диск бір айда толып қалар еді. Сондықтан әр жүктеуде
 * ЕСКІЛЕРІ тазаланады (1 сағаттан асқаны).
 *
 * Аутентификация ӘДЕЙІ талап етілмейді: сілтемені телефон ашады, ал ол
 * компьютердегі сеансты білмейді. Қауіпсіздігі — id-дің өзінде (UUID) әрі
 * қысқа өмірінде.
 */
const TTL_MS = 60 * 60 * 1000
const MAX_BYTES = 25 * 1024 * 1024

export function arDir(): string {
  const base = process.env['DATA_DIR'] ?? join(process.cwd(), '.data')
  const dir = join(base, 'ar')
  mkdirSync(dir, { recursive: true })
  return dir
}

function sweep(dir: string, now: number): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    try {
      if (now - statSync(path).mtimeMs > TTL_MS) rmSync(path)
    } catch {
      // Файл дәл сол сәтте өшірілген болуы мүмкін — бұл қате емес.
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const body = await request.arrayBuffer()
  if (body.byteLength === 0) return NextResponse.json({ error: 'Пустой файл' }, { status: 400 })
  if (body.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Модель слишком большая для AR' }, { status: 413 })
  }

  const dir = arDir()
  const now = Date.now()
  sweep(dir, now)

  const id = randomUUID()
  writeFileSync(join(dir, `${id}.glb`), Buffer.from(body))
  return NextResponse.json({ id, expiresAt: now + TTL_MS })
}
