/**
 * `Decor.finish` / `mapUrl` / `mapSizeMm` — §3-4 (3D материал/текстура
 * жақсарту, `docs/visual/plan.md`).
 *
 * Үшеуі де ЕРІКТІ өріс: `CURRENT_SCHEMA_VERSION` көтерілмеуі керек, ал ескі
 * жоба (осы өрістерсіз) бұрынғыдай ашылуы керек (CLAUDE.md §7).
 */
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, DecorSchema, parseProject } from '../src/core/index'
import { finishToMaterial, needsClearcoat } from '../lib/materialLook'
import { catalog, referenceProject } from './fixtures'

describe('Decor.finish/mapUrl/mapSizeMm — схема', () => {
  it('ЕСКІ decor (finish/mapUrl/mapSizeMm жоқ) бұрынғыдай өтеді', () => {
    const parsed = DecorSchema.parse({ color: '#ffffff', kind: 'solid' })
    expect(parsed.finish).toBeUndefined()
    expect(parsed.mapUrl).toBeUndefined()
    expect(parsed.mapSizeMm).toBeUndefined()
  })

  it('ЖАҢА өрістердің бәрі бірге өтеді', () => {
    const parsed = DecorSchema.parse({
      color: '#c8a86e',
      kind: 'wood',
      finish: 'gloss',
      mapUrl: 'https://example.com/egger/h1145.jpg',
      mapSizeMm: { x: 600, y: 600 },
    })
    expect(parsed.finish).toBe('gloss')
    expect(parsed.mapSizeMm).toEqual({ x: 600, y: 600 })
  })

  it('дұрыс емес finish мәні қабылданбайды', () => {
    expect(() => DecorSchema.parse({ color: '#ffffff', kind: 'solid', finish: 'sparkly' })).toThrow()
  })

  it('дұрыс емес mapUrl (URL емес) қабылданбайды', () => {
    expect(() => DecorSchema.parse({ color: '#ffffff', kind: 'solid', mapUrl: 'not-a-url' })).toThrow()
  })

  it('CURRENT_SCHEMA_VERSION көтерілмеген — 3 болып қалады', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3)
  })

  it('ескі жоба (finish/mapUrl жоқ материалдар) бұрынғыдай ашылады', () => {
    // `referenceProject` — examples/wardrobe.json, decor өрісі жоқ материалдармен.
    const raw = JSON.parse(JSON.stringify(referenceProject))
    const reparsed = parseProject(raw)
    expect(reparsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    for (const m of reparsed.materials) {
      expect(m.decor?.finish).toBeUndefined()
    }
  })

  it('материал каталогында да finish қосымша ретінде қабылданады', () => {
    const withFinish = {
      ...catalog.materials[0]!,
      decor: { color: '#e5e0d8', kind: 'solid' as const, finish: 'stone' as const },
    }
    expect(withFinish.decor.finish).toBe('stone')
  })
})

describe('finishToMaterial — таза функция', () => {
  it('undefined → matte (қазіргі мінез)', () => {
    expect(finishToMaterial(undefined)).toEqual(finishToMaterial('matte'))
    expect(finishToMaterial(undefined)).toEqual({
      roughness: 0.75, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.4,
    })
  })

  it('gloss — material.md §3 кестесіндегі мәндер', () => {
    expect(finishToMaterial('gloss')).toEqual({
      roughness: 0.1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.2,
    })
  })

  it('stone — material.md §3 кестесіндегі мәндер', () => {
    expect(finishToMaterial('stone')).toEqual({
      roughness: 0.2, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.2, envMapIntensity: 0.9,
    })
  })

  it('metal — жоғары metalness, clearcoat жоқ', () => {
    expect(finishToMaterial('metal')).toEqual({
      roughness: 0.3, metalness: 0.8, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 1.3,
    })
  })

  it('satin — эмаль, бірақ бұл жобада clearcoat ӘДЕЙІ 0 (тек gloss/stone физикалық материал алады)', () => {
    expect(finishToMaterial('satin')).toEqual({
      roughness: 0.38, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.6,
    })
  })

  it('needsClearcoat — тек gloss/stone true қайтарады', () => {
    expect(needsClearcoat('gloss')).toBe(true)
    expect(needsClearcoat('stone')).toBe(true)
    expect(needsClearcoat('matte')).toBe(false)
    expect(needsClearcoat('satin')).toBe(false)
    expect(needsClearcoat('metal')).toBe(false)
    expect(needsClearcoat(undefined)).toBe(false)
  })
})
