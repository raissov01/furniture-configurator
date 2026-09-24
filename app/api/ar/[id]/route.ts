import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { arDir } from '@/lib/server/arStorage'

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
  try {
    const bytes = readFileSync(join(arDir(), `${id}.glb`))
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Модель уже удалена' }, { status: 404 })
  }
}
