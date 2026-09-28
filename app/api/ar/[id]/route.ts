import { readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { AR_TTL_MS, arDir } from '@/lib/server/arStorage'

/** GLB беру. Scene Viewer файлды дәл осы мекенжайдан алады. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  // ⚠ id ТЕК UUID: `..%2f` сияқты жолмен басқа файлға шығуға болмайды.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }
  const path = join(arDir(), `${id}.glb`)
  try {
    if (Date.now() - statSync(path).mtimeMs > AR_TTL_MS) {
      rmSync(path)
      return NextResponse.json({ error: 'Модель уже удалена' }, { status: 404 })
    }
    const bytes = readFileSync(path)
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'no-store',
      },
    })
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') {
      return NextResponse.json({ error: 'Модель уже удалена' }, { status: 404 })
    }
    throw cause
  }
}
