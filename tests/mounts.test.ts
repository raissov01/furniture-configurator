/**
 * Крышка мен дноның бекітілуі, ЭЛЕМЕНТ БОЙЫНША (§4.4-тің жалғасы).
 *
 * Бұрын корпуста бір ғана шешім болатын: «бүйірлер жабады» не «крышка/дно
 * жабады». Нақты жиһазда олай емес — қатарға тұратын ас үй модулінің крышкасы
 * тек СЫРТҚЫ бүйірді жабады, ал ішкі жағы көршісіне тіреледі. Сонда екі бүйір
 * ӘРТҮРЛІ БИІКТІКТЕ болады, ал бұл — қате емес.
 *
 * Мұндағы басты тексеру: панельдер жиналғанда габарит ДӘЛ шығуы керек, ал
 * кромка жабылған торцқа жабыспауы керек (ол жердегі кромка — жоғалған ақша
 * әрі көршісіне тірелмейтін модуль).
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet } from '../src/core/index'
import type { CabinetConfig, PanelMount, Panel } from '../src/core/index'

const base = (): CabinetConfig => templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

const build = (mounts: { top?: PanelMount; bottom?: PanelMount }): Panel[] =>
  generateCabinet({ ...base(), mounts }, SEED_CATALOG)

const byId = (panels: Panel[], id: string): Panel => panels.find((p) => p.id === id)!
const T = 16

describe('ескі мінез сақталады', () => {
  it('`mounts` берілмесе — дәл бұрынғы панельдер', () => {
    expect(generateCabinet({ ...base(), mounts: undefined }, SEED_CATALOG))
      .toEqual(generateCabinet(base(), SEED_CATALOG))
  })

  it('sidesOverlay = екеуі де inset', () => {
    expect(build({ top: 'inset', bottom: 'inset' })).toEqual(generateCabinet(base(), SEED_CATALOG))
  })

  it('topBottomOverlay = екеуі де overlay', () => {
    const old = generateCabinet({ ...base(), construction: 'topBottomOverlay' }, SEED_CATALOG)
    const next = generateCabinet(
      { ...base(), construction: 'topBottomOverlay', mounts: { top: 'overlay', bottom: 'overlay' } },
      SEED_CATALOG,
    )
    expect(next).toEqual(old)
  })
})

describe('өлшемдер бекітілуден шығады', () => {
  const config = base()
  const { height: H, width: W } = config

  it('inset — көлденең панель бүйірлердің АРАСЫНДА', () => {
    const panels = build({ top: 'inset', bottom: 'inset' })
    expect(byId(panels, 'top').finishedLength).toBe(W - 2 * T)
    expect(byId(panels, 'bottom').position.x).toBe(T)
    // Бүйір толық биіктікте.
    expect(byId(panels, 'side-left').finishedLength).toBe(H)
    expect(byId(panels, 'side-left').position.y).toBe(0)
  })

  it('overlay — көлденең панель екі бүйірді де жабады', () => {
    const panels = build({ top: 'overlay', bottom: 'overlay' })
    expect(byId(panels, 'top').finishedLength).toBe(W)
    expect(byId(panels, 'top').position.x).toBe(0)
    // Екі бүйір де екі жағынан қысқарады.
    expect(byId(panels, 'side-left').finishedLength).toBe(H - 2 * T)
    expect(byId(panels, 'side-left').position.y).toBe(T)
  })

  it('overlayLeft — тек СОЛ бүйірді жабады, ені W − t', () => {
    const panels = build({ top: 'overlayLeft', bottom: 'inset' })
    const top = byId(panels, 'top')
    expect(top.finishedLength).toBe(W - T)
    expect(top.position.x).toBe(0)
    // Сол бүйір қысқарды, оң бүйір тиылмады — АСИММЕТРИЯ.
    expect(byId(panels, 'side-left').finishedLength).toBe(H - T)
    expect(byId(panels, 'side-right').finishedLength).toBe(H)
  })

  it('overlayRight — тек ОҢ бүйірді жабады', () => {
    const panels = build({ top: 'overlayRight', bottom: 'inset' })
    const top = byId(panels, 'top')
    expect(top.finishedLength).toBe(W - T)
    expect(top.position.x).toBe(T)
    expect(byId(panels, 'side-right').finishedLength).toBe(H - T)
    expect(byId(panels, 'side-left').finishedLength).toBe(H)
  })

  it('крышка мен дно ТӘУЕЛСІЗ: біреуі накладной, екіншісі вкладной', () => {
    const panels = build({ top: 'overlay', bottom: 'inset' })
    expect(byId(panels, 'top').finishedLength).toBe(W)
    expect(byId(panels, 'bottom').finishedLength).toBe(W - 2 * T)
    // Бүйір ҮСТІНЕН ғана қысқарады.
    expect(byId(panels, 'side-left').finishedLength).toBe(H - T)
    expect(byId(panels, 'side-left').position.y).toBe(0)
  })

  it('кез келген нұсқада корпус ДӘЛ H × W-ға жиналады', () => {
    const combos: PanelMount[] = ['inset', 'overlay', 'overlayLeft', 'overlayRight']
    for (const top of combos) {
      for (const bottom of combos) {
        const panels = build({ top, bottom })
        const label = `${top}/${bottom}`

        // Биіктік: бүйірдің бастауы + ұзындығы + оны жапқан панельдер.
        for (const id of ['side-left', 'side-right']) {
          const side = byId(panels, id)
          const above = side.position.y + side.finishedLength
          const covered = above === H ? 0 : T
          expect(above + covered, `${label} ${id}`).toBe(H)
        }

        // Ен: көлденең панель + оны жаппаған бүйірлер.
        for (const id of ['top', 'bottom']) {
          const panel = byId(panels, id)
          const right = panel.position.x + panel.finishedLength
          const leftGap = panel.position.x
          const rightGap = W - right
          expect(leftGap === 0 || leftGap === T, `${label} ${id} сол`).toBe(true)
          expect(rightGap === 0 || rightGap === T, `${label} ${id} оң`).toBe(true)
        }
      }
    }
  })
})

describe('кромка бекітілуге сай жүреді', () => {
  it('жабылған торцқа кромка ЖАБЫСПАЙДЫ', () => {
    // Крышка тек сол бүйірді жабады: оның СОЛ торцы көрінеді, ОҢЫ — жоқ.
    const panels = build({ top: 'overlayLeft', bottom: 'inset' })
    const top = byId(panels, 'top')
    expect(top.edges.W1).not.toBeNull()
    expect(top.edges.W2).toBeNull()
  })

  it('бүйірдің жабылған ұшында кромка болмайды', () => {
    const panels = build({ top: 'overlay', bottom: 'inset' })
    const side = byId(panels, 'side-left')
    // Асты ашық (дно вкладное) → көрінеді; үсті крышка жапты → жасырын.
    expect(side.edges.W1).not.toBeNull()
    expect(side.edges.W2).toBeNull()
  })

  it('вкладной көлденең панельдің екі торцы да жасырын', () => {
    const top = byId(build({ top: 'inset', bottom: 'inset' }), 'top')
    expect(top.edges.W1).toBeNull()
    expect(top.edges.W2).toBeNull()
  })

  /**
   * §4.3-тің ЕРЕЖЕСІ мұнда да жүреді: `minBandSubtract`-тен жұқа лента резден
   * ШЕГЕРІЛМЕЙДІ. Эталон каталогта екінші дәрежелі торцқа 0,4 мм жабысады,
   * сондықтан накладной крышканың резі готовыймен ТЕҢ болып қалады — бұл
   * дұрыс мінез, оны «кромка жоқ» деп шатастыруға болмайды.
   */
  it('жұқа лента резді өзгертпейді, ал қалың лента өзгертеді (§4.3)', () => {
    const inset = byId(build({ top: 'inset', bottom: 'inset' }), 'top')
    expect(inset.edges.W1).toBeNull()
    expect(inset.cutLength).toBe(inset.finishedLength)

    const overlay = byId(build({ top: 'overlay', bottom: 'overlay' }), 'top')
    expect(overlay.edges.W1).not.toBeNull()
    const band = SEED_CATALOG.edgeBands.find((b) => b.id === overlay.edges.W1!.bandId)!
    if (band.thickness >= 1) {
      expect(overlay.cutLength).toBe(overlay.finishedLength - 2 * band.thickness)
    } else {
      expect(overlay.cutLength).toBe(overlay.finishedLength)
    }
  })
})
