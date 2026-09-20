/**
 * Аудит Y6 (docs/audit/drilling-2026-09-20.md): `DrillEditor`-да қолмен
 * қосылған тесіктің координатасы ешбір шекпен салыстырылмайды.
 * Тікбұрышты панельде бұл байқалмайды (қате координата бірден панельдің
 * сыртына шығады), бірақ ЕН бойынша қиғаш (бұрыштық корпус) панельде
 * заготовка тікбұрыш болғанымен, нақты материал трапеция — тікбұрыштың
 * ІШІНДЕ, бірақ кесіліп кететін үшбұрышта жатқан тесік ескі тексеруден
 * (0 ≤ x ≤ cutLength, 0 ≤ y ≤ cutWidth) ӨТІП КЕТЕДІ.
 *
 * `isDrillWithinMaterial` (drillEdits.ts) осы жағдайды `bevelBounds.ts`-тегі
 * `materialWidthRangeAt`-пен (K1+K2, docs/audit/drilling-fix-plan.md K2)
 * тексереді — ӨЗІНДІК жаңа геометрия жазбайды, бар көмекшіні қайта
 * пайдаланады.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  isDrillWithinMaterial,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** docs/audit/corner-2026-09-20.md-дегі дәл сол 600/350 переходной пенал. */
const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...template,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
  }],
  ...patch,
})

describe('Y6: қолмен қосылған тесіктің панель ішінде екенін тексеру', () => {
  const panels = generateCabinet(corner(350), catalog)
  const bottom = panels.find((p) => p.id === 'bottom')!

  it('трапеция дноның кесілген аймағындағы нүкте МАТЕРИАЛДАН ТЫС (ескі тексеру байқамайтын)', () => {
    // cutLength=568, cutWidth=598, widthAtEnd=350 (shrink=2) → x=cutLength-де
    // материал тек y∈[250,598], ал y=10 ЕСКІ (тікбұрыш) тексеруден өтіп кетеді.
    expect(bottom.cutLength).toBeGreaterThan(500)
    expect(isDrillWithinMaterial(bottom, 'inner', bottom.cutLength, 10)).toBe(false)
  })

  it('дәл сол x-те, бірақ материал бар y-де — ІШІНДЕ', () => {
    expect(isDrillWithinMaterial(bottom, 'inner', bottom.cutLength, bottom.cutWidth - 10)).toBe(true)
  })

  it('қиғаш басталмаған жерде (x=0) толық ен материал болады', () => {
    expect(isDrillWithinMaterial(bottom, 'inner', 0, 10)).toBe(true)
    expect(isDrillWithinMaterial(bottom, 'outer', 0, bottom.cutWidth - 1)).toBe(true)
  })

  it('панель шегінен тыс x — ІШІНДЕ ЕМЕС', () => {
    expect(isDrillWithinMaterial(bottom, 'inner', bottom.cutLength + 5, 10)).toBe(false)
    expect(isDrillWithinMaterial(bottom, 'inner', -5, 10)).toBe(false)
  })
})
