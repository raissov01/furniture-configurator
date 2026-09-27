import { describe, expect, it } from 'vitest'
import { mapImportedTexture, pro100TextureImports } from '@/lib/ownTextureUi'
import { defaultShopProfile } from '@/src/core/shop'

describe('PRO100 текстурасын жоба материалына сәйкестендіру', () => {
  const material = defaultShopProfile().materials[0]!
  const texture = { name: 'Қазақ емені', mapSizeMm: { x: 600, y: 450 }, imageFile: 'oak.jpg' }

  it('тек сервер импортындағы жарамды текстураларды береді', () => {
    const imports = pro100TextureImports([{ id: '123e4567-e89b-42d3-a456-426614174000', format: 'pro100-ini', data: { textures: [texture] } },
      { id: 'other', format: 'basis-xlsx', data: { textures: [texture] } }])
    expect(imports).toEqual([{ importId: '123e4567-e89b-42d3-a456-426614174000', texture }])
  })

  it('сурет URL мен мм масштабын декорға көшіріп, өндірістік өлшемді сақтайды', () => {
    const mapped = mapImportedTexture(material, texture, 'https://example.com/api/own-catalog/image?id=123')
    expect(mapped.decor).toMatchObject({ kind: 'wood', mapSizeMm: { x: 600, y: 450 },
      mapUrl: 'https://example.com/api/own-catalog/image?id=123' })
    expect(mapped.thickness).toBe(material.thickness)
    expect(mapped.sheetWidth).toBe(material.sheetWidth)
  })

  it('жарамсыз өлшемді қабылдамайды', () => {
    expect(() => mapImportedTexture(material, { ...texture, mapSizeMm: { x: 0, y: 450 } }, 'https://example.com/a'))
      .toThrow(/mapSizeMm.x/)
  })
})
