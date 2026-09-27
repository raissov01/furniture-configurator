import { describe, expect, it } from 'vitest'
import { applianceNicheModel, generateCabinet, generateHardware, validateApplianceNiche } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

describe('өндіруші артикулы бойынша техника ұясы', () => {
  it('духовка 60, СВЧ 38/45, ыдыс жуғыш 45/60, тоңазытқыш өлшемдері деректе', () => {
    expect(applianceNicheModel('bosch-hbf113br0b')).toMatchObject({
      height: { min: 575, max: 597 }, width: { min: 560, max: 568 }, depthMin: 550,
    })
    expect(applianceNicheModel('bosch-bfl524ms0b').height).toEqual({ min: 362, max: 365 })
    expect(applianceNicheModel('bosch-cma583ms0b').height).toEqual({ min: 450, max: 452 })
    expect(applianceNicheModel('bosch-smv4htx31e').width.min).toBe(600)
    expect(applianceNicheModel('bosch-spv2hkx42e').width.min).toBe(450)
    expect(applianceNicheModel('bosch-kin86vse0').height.min).toBe(1775)
  })

  it('артикулдық ұя сыймаса параметр мен рұқсат диапазоны шығады', () => {
    const model = applianceNicheModel('bosch-hbf113br0b')
    expect(() => validateApplianceNiche(model, { height: 600, width: 568, depth: 557 },
      'sections[0].contents[0]')).toThrow(/contents\[0\]\.height.*575\.\.597/)
    expect(() => validateApplianceNiche(model, { height: 575, width: 550, depth: 557 },
      'sections[0].contents[0]')).toThrow(/contents\[0\]\.width.*560\.\.568/)
    expect(() => validateApplianceNiche(model, { height: 575, width: 568, depth: 549 },
      'sections[0].contents[0]')).toThrow(/contents\[0\]\.depth.*≥ 550/)
  })

  it('генератор паспорттық ұяны тексереді', () => {
    const cabinet = withCabinet({ height: 900, width: 600, depth: 560,
      sections: [{ id: 's1', widthMode: 'flex',
        contents: [{ kind: 'appliance', appliance: 'oven', modelId: 'bosch-hbf113br0b' }],
        fronts: null }] })
    expect(() => generateCabinet(cabinet, catalog)).not.toThrow()
    expect(() => generateCabinet({ ...cabinet, width: 590 }, catalog)).toThrow(/contents\[0\]\.width/)
    expect(() => generateCabinet({ ...cabinet, depth: 540 }, catalog)).toThrow(/contents\[0\]\.depth/)
    expect(() => generateHardware({ ...cabinet, width: 590 }, catalog)).toThrow(/contents\[0\]\.width/)
  })
})
