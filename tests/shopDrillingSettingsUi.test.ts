import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { DRILLING_NUMBER_FIELDS, ShopDrillingSettings, resetDrillingSetting } from '../components/ShopDrillingSettings'
import {
  SEED_TEMPLATES, catalogOf, defaultShopProfile, generateCabinet, parseShopProfile, templateToCabinet,
} from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const render = () => renderToString(createElement(ShopDrillingSettings, { shop, editShop: () => {} }))

describe('Shop Settings → Присадка', () => {
  it('minifixPairEndOffset түсіндірмесі ящик түбін де атайды — ол center режимінде де жылжиды', () => {
    // Мінез: center режимінде де offset ящик түбінің минификсін жылжытады
    // (drawerBottomJoints ұзын буында placement-ті қолданбайды).
    const template = SEED_TEMPLATES.find((item) => item.id === 'chest-800')!
    const cabinet = templateToCabinet(template, catalog)
    const bottomCams = (endOffset: number) => generateCabinet(cabinet, catalog, { minifixPairEndOffset: endOffset })
      .find((panel) => panel.role === 'drawerBottom')!.drilling
      .filter((drill) => drill.purpose === 'minifix' && drill.diameter === 15)
      .map((drill) => drill.y)
    expect(bottomCams(40)).not.toEqual(bottomCams(60))
    expect(render()).toContain('дна ящика')
  })

  it('өрістің UI қадамы схемамен келіседі: бөлшек рұқсат өрісте 0.1 мм, бүтінде 1 мм', () => {
    // §0.2: өлшем — бүтін мм; фурнитура артикулының физикалық Ø/тереңдігі
    // (ілгек чашкасы 12.5, минификс ұясы 12.7 сияқты) 0.1 мм дәлдікпен.
    // Бұрын NumberInput 11.5 → 12 деп дөңгелектейтін (hingeScrewPilotDepth,
    // minifixSleeveDepth), ал схема 11.5-ті қабылдайтын.
    const mismatched = DRILLING_NUMBER_FIELDS.filter(({ key, step }) => {
      let fractionalAllowed = true
      try { parseShopProfile({ ...shop, settings: { [key]: 11.5 } }) } catch { fractionalAllowed = false }
      return fractionalAllowed !== ((step ?? 1) < 1)
    }).map(({ key }) => key)
    expect(mismatched).toEqual([])
    expect(DRILLING_NUMBER_FIELDS.find(({ key }) => key === 'hingeScrewPilotDepth')?.step).toBe(0.1)
    expect(DRILLING_NUMBER_FIELDS.find(({ key }) => key === 'minifixSleeveDepth')?.step).toBe(0.1)
  })

  it('Reset тек өзіне тәуелді бекіту режимін қайтарады, басқасын қозғамайды', () => {
    const pressFit = { hingeCupMount: 'press-fit' as const, hingePressFitDepth: 12,
      hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 8 }
    // Бұрын пилот Ø/тереңдігін Reset жасау press-fit режимін де cup-only-ге қайтаратын.
    expect(resetDrillingSetting(pressFit, 'hingeScrewPilotDiameter'))
      .toEqual({ hingeCupMount: 'press-fit', hingePressFitDepth: 12, hingeScrewPilotDepth: 8 })
    expect(resetDrillingSetting(pressFit, 'hingeScrewPilotDepth').hingeCupMount).toBe('press-fit')
    // Белсенді режимнің міндетті өрісі null-ға қайтса — режим де қайтады.
    expect(resetDrillingSetting(pressFit, 'hingePressFitDepth').hingeCupMount).toBeUndefined()
    const screw = { ...pressFit, hingeCupMount: 'screw' as const }
    expect(resetDrillingSetting(screw, 'hingeScrewPilotDiameter').hingeCupMount).toBeUndefined()
    expect(resetDrillingSetting(screw, 'hingeScrewPilotDepth').hingeCupMount).toBeUndefined()
    expect(resetDrillingSetting(screw, 'hingePressFitDepth').hingeCupMount).toBe('screw')
    const sleeve = { minifixBoltMount: 'sleeve-8' as const, minifixSleeveDepth: 12 }
    expect(resetDrillingSetting(sleeve, 'minifixSleeveDepth')).toEqual({})
    expect(resetDrillingSetting({ ...sleeve, minifixBoltMount: 'screw-5' }, 'minifixSleeveDepth'))
      .toEqual({ minifixBoltMount: 'screw-5' })
  })
})
