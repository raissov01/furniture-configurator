import { describe, expect, it } from 'vitest'
import { NoColorSpace, Texture } from 'three'
import { MaterialSchema, parseProjectV4 } from '../src/core/index'
import { materialRenderKey, resolveMaterialLook } from '../lib/materialLook'
import { configureNormalTexture } from '../lib/decorTexture'
import { referenceProject } from './fixtures'
import { useConfigurator } from '../store/configurator'

describe('жобаның PBR материалы', () => {
  it('ескі жоба параметрсіз ашылады және жаңа өрістер v4 roundtrip-та сақталады', () => {
    const legacy = parseProjectV4(referenceProject)
    expect(legacy.materials[0]?.pbr).toBeUndefined()
    const material = { ...legacy.materials[0]!, pbr: {
      roughness: 0.22, metalness: 0.4, reflection: 1.1, opacity: 0.65,
      normal: { url: 'https://example.com/decor-normal.png', sizeMm: { x: 900, y: 600 }, strength: 0.8 },
    } }
    const revised = parseProjectV4({ ...legacy, materials: [material, ...legacy.materials.slice(1)] })
    expect(revised.materials[0]?.pbr).toEqual(material.pbr)
  })

  it('PBR шектері, сыртқы normal URL және бүтін мм өлшемі тексеріледі', () => {
    const base = parseProjectV4(referenceProject).materials[0]!
    expect(() => MaterialSchema.parse({ ...base, pbr: { roughness: 1.1 } })).toThrow()
    expect(() => MaterialSchema.parse({ ...base, pbr: { opacity: -0.1 } })).toThrow()
    expect(() => MaterialSchema.parse({ ...base, pbr: { normal: {
      url: 'not-a-url', sizeMm: { x: 900, y: 600 }, strength: 1,
    } } })).toThrow()
    for (const url of ['data:image/png;base64,AA==', 'file:///tmp/map.png', 'ftp://example.com/map.png']) {
      expect(() => MaterialSchema.parse({ ...base, pbr: { normal: {
        url, sizeMm: { x: 900, y: 600 }, strength: 1,
      } } })).toThrow()
    }
    expect(() => MaterialSchema.parse({ ...base, pbr: { normal: {
      url: 'https://example.com/n.png', sizeMm: { x: 900.5, y: 600 }, strength: 1,
    } } })).toThrow()
  })

  it('finish preset үстінен PBR мәндері беріледі, бастапқы preset өзгермейді', () => {
    const look = resolveMaterialLook('gloss', { roughness: 0.31, metalness: 0.2, reflection: 0.7, opacity: 0.5 })
    expect(look).toMatchObject({ roughness: 0.31, metalness: 0.2, envMapIntensity: 0.7, opacity: 0.5 })
    expect(resolveMaterialLook('gloss').roughness).toBe(0.1)
  })

  it('normal картасы NoColorSpace-та және физикалық мм масштабына сай', () => {
    const texture = configureNormalTexture(new Texture(), 1800, 1200, { x: 900, y: 600 })
    expect(texture.colorSpace).toBe(NoColorSpace)
    expect(texture.repeat.x).toBe(2)
    expect(texture.repeat.y).toBe(2)
  })

  it('normal/map қосу-өшіру материал key-ін өзгертеді, shader қайта құрылады', () => {
    expect(materialRenderKey(false, false, false)).not.toBe(materialRenderKey(false, false, true))
    expect(materialRenderKey(false, false, false)).not.toBe(materialRenderKey(false, true, false))
    expect(materialRenderKey(false, true, true)).not.toBe(materialRenderKey(true, true, true))
  })

  it('PBR түзетуі жоба файлына сақталып, undo арқылы қайтады', () => {
    const initial = useConfigurator.getState()
    const material = initial.catalog.materials[0]!
    const before = initial.past.length
    try {
      initial.setMaterialPbr(material.id, { roughness: 0.23, reflection: 1.2 })
      const changed = useConfigurator.getState()
      expect(changed.past).toHaveLength(before + 1)
      expect(changed.exportProject().materials.find((entry) => entry.id === material.id)?.pbr?.roughness).toBe(0.23)
      changed.undo()
      expect(useConfigurator.getState().catalog.materials.find((entry) => entry.id === material.id)?.pbr)
        .toEqual(material.pbr)
    } finally {
      useConfigurator.setState(initial, true)
    }
  })

  it('цех материалындағы PBR өзгерісі жобалық override-қа да таралады', () => {
    const initial = useConfigurator.getState()
    try {
      const file = parseProjectV4(referenceProject)
      const source = initial.shop.materials[0]!
      initial.loadProject({ ...file, materials: [...file.materials.filter((entry) => entry.id !== source.id), source] })
      const state = useConfigurator.getState()
      const material = state.shop.materials.find((entry) => entry.id === source.id)!
      state.editShop({ materials: state.shop.materials.map((entry) => entry.id === material.id
        ? { ...entry, pbr: { roughness: 0.46 } } : entry) })
      expect(useConfigurator.getState().projectMaterials?.find((entry) => entry.id === material.id)?.pbr?.roughness).toBe(0.46)
    } finally { useConfigurator.setState(initial, true) }
  })
})
