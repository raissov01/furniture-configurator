import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, defaultShopProfile, generateCabinet } from '../src/core/index'
import { buildStagePreview, DEFAULT_STAGE_DRAFT, stageOptions, validateStageDraft } from '../lib/stageBuilder'

describe('stage builder draft', () => {
  it('ас үй қадамдарының барлық өндірістік параметрін бір options-қа жинайды', () => {
    const draft = { ...DEFAULT_STAGE_DRAFT, layout: 'straight' as const, lengthA: 3000,
      lowerHeight: 740, carcassId: SEED_CATALOG.materials[0]!.id,
      modules: { runA: [{ kind: 'baseDoors' as const, width: 600 }], runB: [] } }
    const result = stageOptions(draft)
    expect(result.kind).toBe('kitchen')
    if (result.kind !== 'kitchen') throw new Error('wrong kind')
    expect(result.options.dims?.lowerHeight).toBe(740)
    expect(result.options.materials?.carcassId).toBe(draft.carcassId)
    expect(result.options.modules?.runA).toEqual(draft.modules.runA)
  })

  it('жатын бөлмені белсенді түрде генераторға береді және 1600 мм-ден тар қабырғаны тоқтатады', () => {
    const draft = { ...DEFAULT_STAGE_DRAFT, type: 'bedroom' as const, layout: 'u' as const, lengthA: 1500 }
    expect(validateStageDraft(draft, SEED_CATALOG.materials)?.field).toBe('lengthA')
    const valid = { ...draft, lengthA: 3000 }
    expect(stageOptions(valid)).toMatchObject({ kind: 'furniture', options: { type: 'bedroom', layout: 'straight', lengthA: 3000 } })
  })

  it('алдын ала көрініс пен смета жобаға берілетін бір конфигтен шығады', () => {
    const shop = defaultShopProfile()
    const draft = { ...DEFAULT_STAGE_DRAFT, type: 'office' as const, layout: 'straight' as const, lengthA: 3000 }
    const preview = buildStagePreview(draft, SEED_CATALOG, shop)
    const generated = preview.result.cabinets.flatMap((cabinet) => generateCabinet(cabinet, SEED_CATALOG))
    expect(preview.panels).toHaveLength(generated.length)
    expect(preview.price.total).toBeGreaterThanOrEqual(0)
    expect(preview.issues).toEqual([])
  })

  it('әдепкі ас үй де бес қадамда алдын ала көрінеді', () => {
    const preview = buildStagePreview(DEFAULT_STAGE_DRAFT, SEED_CATALOG, defaultShopProfile())
    expect(preview.panels.length).toBeGreaterThan(30)
    expect(preview.result.cabinets.length).toBeGreaterThan(2)
    expect(preview.issues).toEqual([])
  })

  it.each(['wardrobe', 'tv', 'chest', 'bedroom'] as const)('%s алдын ала 3D/баға дерегін шығарады', (type) => {
    const preview = buildStagePreview({ ...DEFAULT_STAGE_DRAFT, type, layout: 'straight', lengthA: 3000 }, SEED_CATALOG, defaultShopProfile())
    expect(preview.panels.length).toBeGreaterThan(0)
    expect(preview.price.total).toBeGreaterThanOrEqual(0)
    expect(preview.issues).toEqual([])
  })
})
