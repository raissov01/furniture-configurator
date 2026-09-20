/**
 * `components/dock/layout.ts` — докинг жүйесінің таза логикасына юнит-тест.
 * Тапсырма спецификациясындағы 5 талап осында тексеріледі:
 *   1. панельді жиекке бекіту орнын дұрыс есептейді
 *   2. екі панель бір жиекке → таб болып жиналады
 *   3. қалқымадан бекітуге және кері ауысу
 *   4. терезе кішірейгенде панель экраннан шығып кетпейді
 *   5. localStorage-тен бұзылған/ескі күй оқылса — құламайды, әдепкіге қайтады
 *      (5-ші талап `persist.ts`-ке қатысты, бөлек `tests/dockPersist.test.ts`-те)
 */
import { describe, expect, it } from 'vitest'
import {
  activateTab,
  bringToFront,
  clampRect,
  closePanel,
  createDockState,
  dockPanel,
  edgeAtPoint,
  isDockState,
  mergeWithDefaults,
  moveFloating,
  openPanel,
  reflowToBounds,
  resizeFloating,
  tabsForSide,
  undockPanel,
  visibleTabsForSide,
} from '../components/dock/layout'
import { MIN_FLOATING_SIZE } from '../components/dock/types'
import type { DockState } from '../components/dock/types'

const BOUNDS = { width: 1200, height: 800 }

describe('createDockState', () => {
  it('әр панельді қалқымалы етіп бастайды, бір-бірінің үстіне дәл түспейді', () => {
    const s = createDockState(['a', 'b', 'c'])
    expect(s.panels.a!.placement.kind).toBe('floating')
    expect(s.panels.b!.placement.kind).toBe('floating')
    const ra = s.panels.a!.placement.kind === 'floating' ? s.panels.a!.placement.rect : null
    const rb = s.panels.b!.placement.kind === 'floating' ? s.panels.b!.placement.rect : null
    expect(ra).not.toEqual(rb)
    expect(s.order).toEqual({ left: [], right: [], top: [], bottom: [] })
  })
})

describe('1. панельді жиекке бекіту', () => {
  it('dockPanel панельдің орнын дәл сол жиекке ауыстырады', () => {
    const s0 = createDockState(['a'])
    const s1 = dockPanel(s0, 'a', 'right')
    expect(s1.panels.a!.placement).toEqual({ kind: 'docked', side: 'right' })
    expect(s1.order.right).toEqual(['a'])
    expect(s1.activeTab.right).toBe('a')
  })

  it('белгісіз панель id-і үшін күй өзгермейді', () => {
    const s0 = createDockState(['a'])
    const s1 = dockPanel(s0, 'ghost', 'left')
    expect(s1).toEqual(s0)
  })
})

describe('2. бір жиекке екі панель → таб болып жиналады', () => {
  it('екеуі де order.left-те, соңғысы белсенді таб', () => {
    let s = createDockState(['a', 'b'])
    s = dockPanel(s, 'a', 'left')
    s = dockPanel(s, 'b', 'left')
    expect(s.order.left).toEqual(['a', 'b'])
    expect(s.activeTab.left).toBe('b')
    expect(tabsForSide(s, 'left')).toEqual(['a', 'b'])
  })

  it('activateTab белсенді табты ауыстырады, order өзгермейді', () => {
    let s = createDockState(['a', 'b'])
    s = dockPanel(s, 'a', 'left')
    s = dockPanel(s, 'b', 'left')
    s = activateTab(s, 'left', 'a')
    expect(s.activeTab.left).toBe('a')
    expect(s.order.left).toEqual(['a', 'b'])
  })
})

describe('3. қалқымадан бекітуге және кері ауысу', () => {
  it('undockPanel → dockPanel → undockPanel: соңғы қалқымалы орны сақталады', () => {
    let s = createDockState(['a'])
    s = dockPanel(s, 'a', 'top')
    expect(s.panels.a!.placement.kind).toBe('docked')

    s = undockPanel(s, 'a', { x: 10, y: 20, width: 300, height: 180 })
    expect(s.panels.a!.placement).toEqual({ kind: 'floating', rect: { x: 10, y: 20, width: 300, height: 180 } })
    expect(s.order.top).toEqual([])

    s = dockPanel(s, 'a', 'bottom')
    expect(s.panels.a!.placement).toEqual({ kind: 'docked', side: 'bottom' })
    expect(s.order.bottom).toEqual(['a'])
  })

  it('undockPanel rect берілмесе, соңғы белгілі қалқымалы rect-ке оралады', () => {
    let s = createDockState(['a'])
    const originalRect = s.panels.a!.placement.kind === 'floating' ? s.panels.a!.placement.rect : null
    s = dockPanel(s, 'a', 'left')
    s = undockPanel(s, 'a')
    expect(s.panels.a!.placement).toEqual({ kind: 'floating', rect: originalRect })
  })

  it('белсенді таб undock болса, жиектегі келесі панель белсенді болады', () => {
    let s = createDockState(['a', 'b'])
    s = dockPanel(s, 'a', 'left')
    s = dockPanel(s, 'b', 'left')
    expect(s.activeTab.left).toBe('b')
    s = undockPanel(s, 'b')
    expect(s.activeTab.left).toBe('a')
    expect(s.order.left).toEqual(['a'])
  })
})

describe('4. терезе кішірейгенде панель экраннан шықпайды', () => {
  it('clampRect панельді шекара ішіне қайтарады', () => {
    const rect = { x: 700, y: 500, width: 450, height: 200 }
    const small = { width: 400, height: 300 }
    const clamped = clampRect(rect, small)
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(small.width)
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(small.height)
    expect(clamped.x).toBeGreaterThanOrEqual(0)
    expect(clamped.y).toBeGreaterThanOrEqual(0)
  })

  it('панель ең кіші өлшемнен кішірейтпейді, тіпті терезе одан да кіші болса', () => {
    const rect = { x: 0, y: 0, width: 450, height: 200 }
    const tiny = { width: 100, height: 80 }
    const clamped = clampRect(rect, tiny)
    expect(clamped.width).toBe(MIN_FLOATING_SIZE.width)
    expect(clamped.height).toBe(MIN_FLOATING_SIZE.height)
  })

  it('reflowToBounds барлық қалқымалы панельдерді жаңа шекараға сыйғызады', () => {
    let s = createDockState(['a', 'b'])
    s = moveFloating(s, 'a', { x: 1000, y: 700, width: 450, height: 200 }, BOUNDS)
    s = reflowToBounds(s, { width: 500, height: 400 })
    const rectA = s.panels.a!.placement.kind === 'floating' ? s.panels.a!.placement.rect : null
    expect(rectA).not.toBeNull()
    expect(rectA!.x + rectA!.width).toBeLessThanOrEqual(500)
    expect(rectA!.y + rectA!.height).toBeLessThanOrEqual(400)
  })

  it('reflowToBounds докталған панельге тимейді', () => {
    let s = createDockState(['a'])
    s = dockPanel(s, 'a', 'left')
    s = reflowToBounds(s, { width: 200, height: 200 })
    expect(s.panels.a!.placement).toEqual({ kind: 'docked', side: 'left' })
  })

  it('resizeFloating өлшемді минимумнан кішірейтпейді', () => {
    let s = createDockState(['a'])
    s = resizeFloating(s, 'a', { width: 10, height: 10 }, BOUNDS)
    const rect = s.panels.a!.placement.kind === 'floating' ? s.panels.a!.placement.rect : null
    expect(rect!.width).toBe(MIN_FLOATING_SIZE.width)
    expect(rect!.height).toBe(MIN_FLOATING_SIZE.height)
  })
})

describe('жабу және мәзірден қайта ашу', () => {
  it('closePanel докталған панельді order-де қалдырады, тек visible=false', () => {
    let s = createDockState(['a', 'b'])
    s = dockPanel(s, 'a', 'left')
    s = dockPanel(s, 'b', 'left')
    s = closePanel(s, 'b')
    expect(s.order.left).toEqual(['a', 'b']) // DOM-да қалуы үшін order-ден өшпейді
    expect(s.panels.b!.visible).toBe(false)
    expect(s.activeTab.left).toBe('a') // белсенді таб көрінетінге ауысты
    expect(visibleTabsForSide(s, 'left')).toEqual(['a'])
  })

  it('openPanel докталған панельді қайта белсенді табқа шығарады', () => {
    let s = createDockState(['a', 'b'])
    s = dockPanel(s, 'a', 'left')
    s = dockPanel(s, 'b', 'left')
    s = closePanel(s, 'b')
    s = openPanel(s, 'b')
    expect(s.panels.b!.visible).toBe(true)
    expect(s.activeTab.left).toBe('b')
  })

  it('closePanel қалқымалы панельді жабады, орны сақталады', () => {
    let s = createDockState(['a'])
    const rectBefore = s.panels.a!.placement.kind === 'floating' ? s.panels.a!.placement.rect : null
    s = closePanel(s, 'a')
    expect(s.panels.a!.visible).toBe(false)
    expect(s.panels.a!.placement).toEqual({ kind: 'floating', rect: rectBefore })
  })
})

describe('bringToFront', () => {
  it('z ең үлкен мәннен де үлкен болады', () => {
    let s = createDockState(['a', 'b'])
    s = bringToFront(s, 'a')
    expect(s.panels.a!.z).toBeGreaterThan(s.panels.b!.z)
  })
})

describe('edgeAtPoint', () => {
  it('табалдырық ішінде дұрыс жиекті қайтарады', () => {
    expect(edgeAtPoint({ x: 5, y: 400 }, BOUNDS)).toBe('left')
    expect(edgeAtPoint({ x: 1195, y: 400 }, BOUNDS)).toBe('right')
    expect(edgeAtPoint({ x: 600, y: 5 }, BOUNDS)).toBe('top')
    expect(edgeAtPoint({ x: 600, y: 795 }, BOUNDS)).toBe('bottom')
    expect(edgeAtPoint({ x: 600, y: 400 }, BOUNDS)).toBeNull()
  })
})

describe('5. isDockState / mergeWithDefaults — бұзылған күйден қорғау', () => {
  it('isDockState дұрыс құрылымды растайды', () => {
    const s = createDockState(['a'])
    expect(isDockState(s)).toBe(true)
  })

  it.each([
    [null],
    [undefined],
    [42],
    ['string'],
    [{}],
    [{ panels: {}, order: {} }], // activeTab жоқ
    [{ panels: { a: { placement: { kind: 'floating', rect: { x: 0, y: 0 } } }, visible: true, z: 0 }, order: { left: [], right: [], top: [], bottom: [] }, activeTab: {} }], // rect толық емес
    [{ panels: { a: { placement: { kind: 'docked', side: 'north' }, visible: true, z: 0 } }, order: { left: [], right: [], top: [], bottom: [] }, activeTab: {} }], // жарамсыз side
  ])('бұзылған пішінді жалған деп таниды: %#', (bad) => {
    expect(isDockState(bad)).toBe(false)
  })

  it('mergeWithDefaults белгісіз панельдерді order-ден сүзеді', () => {
    const persisted: DockState = {
      panels: {
        a: { placement: { kind: 'docked', side: 'left' }, visible: true, z: 0 },
        ghost: { placement: { kind: 'docked', side: 'left' }, visible: true, z: 1 },
      },
      order: { left: ['a', 'ghost'], right: [], top: [], bottom: [] },
      activeTab: { left: 'ghost' },
    }
    const merged = mergeWithDefaults(persisted, ['a'])
    expect(merged.order.left).toEqual(['a'])
    expect(merged.panels.ghost).toBeUndefined()
    expect(merged.activeTab.left).toBe('a')
  })

  it('mergeWithDefaults жаңа панельді әдепкі қалқымалы орынмен қосады', () => {
    const persisted: DockState = {
      panels: { a: { placement: { kind: 'docked', side: 'right' }, visible: true, z: 0 } },
      order: { left: [], right: ['a'], top: [], bottom: [] },
      activeTab: { right: 'a' },
    }
    const merged = mergeWithDefaults(persisted, ['a', 'b'])
    expect(merged.panels.b!.placement.kind).toBe('floating')
    expect(merged.panels.a!.placement).toEqual({ kind: 'docked', side: 'right' })
  })

  it('mergeWithDefaults null персистке әдепкі күй қайтарады', () => {
    const merged = mergeWithDefaults(null, ['a', 'b'])
    expect(merged).toEqual(createDockState(['a', 'b']))
  })

  it('mergeWithDefaults order мен panels сәйкессіз болса (докталған деп белгіленген, бірақ order-де жоқ) — қалқымаға түсіреді, құламайды', () => {
    const persisted: DockState = {
      panels: { a: { placement: { kind: 'docked', side: 'left' }, visible: true, z: 0 } },
      order: { left: [], right: [], top: [], bottom: [] }, // 'a' тізімде жоқ — сәйкессіздік
      activeTab: {},
    }
    const merged = mergeWithDefaults(persisted, ['a'])
    expect(merged.panels.a!.placement.kind).toBe('floating')
  })
})
