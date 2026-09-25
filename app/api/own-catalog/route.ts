import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'
import { deleteShopCatalog, listShopCatalog, saveShopCatalog } from '@/lib/server/ownCatalog'
import { parseBasisExcel } from '@/src/core/ownCatalogImport'
import type { BasisColumnMap } from '@/src/core/ownCatalogImport'
import { parsePro100Textures } from '@/src/core/pro100Textures'

/** Базистің 33 554 жолдық Excel экспортына жеткілікті бір файл шегі. */
export const MAX_CATALOG_FILE_BYTES = 10_000_000
const error = (message: string, status: number) => NextResponse.json({ error: message }, { status })

async function readLimited(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_CATALOG_FILE_BYTES) { await reader.cancel(); return null }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

export async function GET(): Promise<Response> {
  const off = cloudOff(); if (off) return off
  const account = await currentAccount()
  if (!account) return error('Кіру қажет', 401)
  if (!can(account.role, 'readProduction')) return error('Құқығыңыз жоқ', 403)
  return NextResponse.json({ imports: listShopCatalog(account.shopId) })
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  const account = await currentAccount()
  if (!account) return error('Кіру қажет', 401)
  if (!can(account.role, 'editProject')) return error('Құқығыңыз жоқ', 403)
  if (request.headers.get('x-rights-confirmed') !== 'true') return error('Контентті қолдануға құқығым бар деген растау қажет', 400)
  const format = new URL(request.url).searchParams.get('format')
  if (format !== 'basis-xlsx' && format !== 'pro100-ini') return error('format basis-xlsx немесе pro100-ini болуы керек', 400)
  const claimed = Number(request.headers.get('content-length') ?? 0)
  if (claimed > MAX_CATALOG_FILE_BYTES) return error('Файл 10 МБ шегінен асады', 413)
  let bytes: Uint8Array | null
  try { bytes = await readLimited(request) }
  catch { return error('Файл оқу мүмкін болмады', 400) }
  if (!bytes) return error('Файл 10 МБ шегінен асады', 413)
  if (!bytes.length) return error('Файл бос', 400)
  try {
    let data: ReturnType<typeof parseBasisExcel> | ReturnType<typeof parsePro100Textures>
    let count: number
    if (format === 'basis-xlsx') {
      const mapHeader = request.headers.get('x-column-map')
      if (mapHeader && mapHeader.length > 2_000) return error('Баған картасы тым үлкен', 400)
      const map = mapHeader ? JSON.parse(mapHeader) as BasisColumnMap : undefined
      data = parseBasisExcel(bytes, map)
      count = data.materials.length + data.edgeBands.length
    } else {
      data = parsePro100Textures((() => {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { return new TextDecoder('windows-1251').decode(bytes) }
      })())
      count = data.textures.length
    }
    if (count === 0) {
      return error('Импортта жарамды жазба жоқ', 400)
    }
    if (new URL(request.url).searchParams.get('preview') === '1') return NextResponse.json({ preview: data })
    const id = saveShopCatalog(account.shopId, format, data, bytes.length, account.userId)
    return NextResponse.json({ id, preview: data }, { status: 201 })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Файл жарамсыз'
    return error(message, /квота/iu.test(message) ? 409 : 400)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  const account = await currentAccount()
  if (!account) return error('Кіру қажет', 401)
  if (!can(account.role, 'editProject')) return error('Құқығыңыз жоқ', 403)
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return error('id жарамсыз', 400)
  if (!deleteShopCatalog(account.shopId, id)) return error('Импорт табылмады', 404)
  return NextResponse.json({ ok: true })
}
