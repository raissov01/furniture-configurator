import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ShopDrillingSettings } from '../components/ShopDrillingSettings'
import {
  SEED_TEMPLATES, catalogOf, defaultShopProfile, generateCabinet, templateToCabinet,
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
})
