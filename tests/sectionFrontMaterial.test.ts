/**
 * Секцияға БӨЛЕК фасад декоры (qdesign паритеті): бір шкафта әр есік әртүрлі
 * түсте болуы мүмкін. `sections[i].fronts.materialId` берілсе, СОЛ секцияның
 * фасады соны алады, қалғаны — корпустікін.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'

describe('секция фасадының бөлек декоры', () => {
  it('берілген секция фасады өз материалын алады', () => {
    const base = templateToCabinet(findTemplate('wardrobe-2sec-1200')!, SEED_CATALOG)
    const other = SEED_CATALOG.materials.find((m) => m.id !== base.frontMaterialId && m.thickness >= 10)!
    const cfg = {
      ...base,
      sections: base.sections.map((sec, i) =>
        i === 0 && sec.fronts ? { ...sec, fronts: { ...sec.fronts, materialId: other.id } } : sec),
    }
    const fronts = generateCabinet(cfg, SEED_CATALOG).filter((p) => p.role === 'front')
    expect(fronts.some((p) => p.materialId === other.id)).toBe(true)
    expect(fronts.some((p) => p.materialId === base.frontMaterialId)).toBe(true)
  })
})
