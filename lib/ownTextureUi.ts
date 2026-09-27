import { z } from 'zod'
import { MaterialSchema } from '@/src/core/schema'
import type { Material } from '@/src/core/types'
import type { Pro100Texture } from '@/src/core/pro100Textures'

const textureSchema = z.object({
  name: z.string().min(1),
  mapSizeMm: z.object({ x: z.number().int().positive(), y: z.number().int().positive() }),
  imageFile: z.string().optional(),
})

export type OwnTextureEntry = { importId: string; texture: Pro100Texture }

/** Сервер тізіміндегі тек PRO100 INI жазбаларын UI-ға береді. */
export function pro100TextureImports(raw: unknown): OwnTextureEntry[] {
  if (!Array.isArray(raw)) return []
  const result: OwnTextureEntry[] = []
  for (const item of raw) {
    const parsed = z.object({ id: z.string().uuid(), format: z.literal('pro100-ini'),
      data: z.object({ textures: z.array(textureSchema) }) }).safeParse(item)
    if (!parsed.success) continue
    for (const texture of parsed.data.data.textures) result.push({ importId: parsed.data.id,
      texture: { name: texture.name, mapSizeMm: texture.mapSizeMm,
        ...(texture.imageFile ? { imageFile: texture.imageFile } : {}) } })
  }
  return result
}

/** Декор ғана өзгереді; парақ пен өндірістік өлшемдер сол күйінде қалады. */
export function mapImportedTexture(material: Material, texture: Pick<Pro100Texture, 'mapSizeMm'>, mapUrl: string): Material {
  const { x, y } = texture.mapSizeMm
  if (!Number.isSafeInteger(x) || x <= 0) throw new Error('mapSizeMm.x: 1..MAX_SAFE_INTEGER мм')
  if (!Number.isSafeInteger(y) || y <= 0) throw new Error('mapSizeMm.y: 1..MAX_SAFE_INTEGER мм')
  const url = new URL(mapUrl)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('mapUrl: HTTP(S) URL керек')
  return MaterialSchema.parse({ ...material,
    decor: { color: material.decor?.color ?? '#ffffff', ...material.decor, kind: 'wood',
      mapUrl, mapSizeMm: { x, y } },
  })
}
