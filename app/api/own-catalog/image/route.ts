import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'
import { listShopCatalog } from '@/lib/server/ownCatalog'
import { MAX_CATALOG_IMAGE_BYTES, validateCatalogImage } from '@/lib/server/catalogImage'
import { pro100TextureImports } from '@/lib/ownTextureUi'
import { catalogImageForShop, recordCatalogImage } from '@/lib/server/ownCatalogImages'

const imageDir = () => join(process.env['DATA_DIR'] ?? join(process.cwd(), '.data'), 'catalog-images')
const idPattern = /^[a-f0-9-]{36}$/iu
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status })

async function readImage(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.length
      if (total > MAX_CATALOG_IMAGE_BYTES) { await reader.cancel(); return null }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

/** Құқық расталған нақты сурет INI метадерегіне бөлек тіркеледі. */
export async function POST(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  const account = await currentAccount()
  if (!account) return fail('Кіру қажет', 401)
  if (!can(account.role, 'editProject')) return fail('Құқығыңыз жоқ', 403)
  if (request.headers.get('x-rights-confirmed') !== 'true') return fail('Сурет құқығын растаңыз', 400)
  const params = new URL(request.url).searchParams
  const importId = params.get('importId') ?? ''
  const textureName = params.get('textureName') ?? ''
  if (!idPattern.test(importId) || !textureName) return fail('importId және textureName қажет', 400)
  const matched = pro100TextureImports(listShopCatalog(account.shopId))
    .some((entry) => entry.importId === importId && entry.texture.name === textureName)
  if (!matched) return fail('Цех импортынан текстура табылмады', 404)
  const bytes = await readImage(request)
  if (!bytes) return fail('Сурет 1 МБ шегінен асады', 413)
  let extension: 'png' | 'jpg' | 'webp'
  try { extension = validateCatalogImage(bytes, request.headers.get('content-type') ?? '') }
  catch (cause) { return fail(cause instanceof Error ? cause.message : 'Сурет жарамсыз', 400) }
  const id = randomUUID()
  await mkdir(imageDir(), { recursive: true })
  const path = join(imageDir(), `${id}.${extension}`)
  await writeFile(path, bytes, { flag: 'wx' })
  try { recordCatalogImage(account.shopId, importId, id, extension, bytes.length) }
  catch (cause) {
    await unlink(path)
    return fail(cause instanceof Error ? cause.message : 'Сурет сақталмады', 409)
  }
  const url = new URL(`/api/own-catalog/image?id=${id}`, request.url).href
  return NextResponse.json({ url }, { status: 201 })
}

/** Сурет URL-і құпия кілт емес: әр сұрауда цех иесі тексеріледі. */
export async function GET(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  const account = await currentAccount()
  if (!account) return fail('Кіру қажет', 401)
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!idPattern.test(id)) return fail('id жарамсыз', 400)
  const image = catalogImageForShop(account.shopId, id)
  if (!image) return fail('Сурет табылмады', 404)
  const mime = image.extension === 'png' ? 'image/png' : image.extension === 'jpg' ? 'image/jpeg' : 'image/webp'
  const bytes = await readFile(join(imageDir(), `${id}.${image.extension}`)).catch((cause: unknown) => {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return null
    throw cause
  })
  if (!bytes) return fail('Сурет табылмады', 404)
  return new Response(bytes, { headers: { 'Content-Type': mime,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
