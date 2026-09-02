/**
 * ВКЛАДНОЙ арт қабырға (§4.5-тің жалғасы).
 *
 * Үш режимнің де бір ортақ ережесі бар: ЖИНАЛҒАН корпустың тереңдігі ДӘЛ D
 * болуы керек, ал сөре арт қабырғаға тірелмеуі тиіс. Вкладной режим соны
 * басқаша орындайды: корпус толық тереңдікте қалады да, ХДФ ішке кіреді.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const build = (back: CabinetConfig['back']): Panel[] =>
  generateCabinet({ ...base(), back }, SEED_CATALOG)

const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!
const T = 16

describe('вкладной арт қабырға', () => {
  const config = base()
  const { height: H, width: W, depth: D } = config
  const hdf = SEED_CATALOG.materials.find((m) => m.id === config.backMaterialId)!

  it('өлшемі — таза ішкі ойық', () => {
    const back = byId(build({ mode: 'inset' }), 'back')
    expect(back.finishedLength).toBe(H - 2 * T)
    expect(back.finishedWidth).toBe(W - 2 * T)
  })

  it('корпус ТОЛЫҚ тереңдікте қалады (накладнойдан айырмасы)', () => {
    const inset = byId(build({ mode: 'inset' }), 'side-left')
    const overlay = byId(build({ mode: 'overlay' }), 'side-left')
    expect(inset.finishedWidth).toBe(D)
    expect(overlay.finishedWidth).toBe(D - hdf.thickness)
  })

  it('шегініссіз арт жиекпен беттеседі', () => {
    const back = byId(build({ mode: 'inset' }), 'back')
    expect(back.position.z + hdf.thickness).toBe(D)
  })

  it('шегініс берілсе, сонша алға жылжиды', () => {
    const back = byId(build({ mode: 'inset', inset: 40 }), 'back')
    expect(back.position.z).toBe(D - 40 - hdf.thickness)
  })

  it('сөре арт қабырғаға ТІРЕЛМЕЙДІ', () => {
    for (const inset of [0, 25, 60]) {
      const panels = build({ mode: 'inset', inset })
      const shelf = panels.find((p) => p.role === 'shelf')!
      const back = byId(panels, 'back')
      const shelfBack = shelf.position.z + shelf.finishedWidth
      expect(shelfBack, `отступ ${inset}`).toBeLessThanOrEqual(back.position.z)
    }
  })

  it('жарамсыз шегініс ҚАТЕ береді', () => {
    expect(() => build({ mode: 'inset', inset: -5 })).toThrow(/0\.\.200/)
    expect(() => build({ mode: 'inset', inset: 12.5 })).toThrow(/бүтін сан/)
  })

  it('ХДФ-қа кромка жабыспайды', () => {
    const back = byId(build({ mode: 'inset' }), 'back')
    expect(Object.values(back.edges).every((e) => e === null)).toBe(true)
  })

  it('басқа режимдер ӨЗГЕРМЕЙДІ', () => {
    expect(build({ mode: 'overlay' })).toEqual(generateCabinet(base(), SEED_CATALOG))
    // Пазда арт қабырға ойықтың өлшемінен ҮЛКЕН (әр жағынан 4 мм кіреді).
    const groove = byId(build({ mode: 'groove' }), 'back')
    expect(groove.finishedWidth).toBeGreaterThan(W - 2 * T)
  })
})
