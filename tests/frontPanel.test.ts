/**
 * ФРОНТАЛЬДЫҚ ПАНЕЛЬ (qdesign: «Фронт. панель»).
 *
 * Бұрыштық орында екі модуль 90°-қа тіреледі де, біреуінің фасады
 * екіншісінің тұтқасына соғылады. Шешімі — алдыңғы жиектің бір бөлігін тік
 * панельмен жабу.
 *
 * ⚠ ЕҢ МАҢЫЗДЫСЫ: корпус ТІКБҰРЫШ күйінде қалады. Сондықтан фасад та,
 * ящик те, сөре де ешбір ерекше жағдайсыз жұмыс істейді — трапеция
 * (`corner`) жолында олар мүлде жасалмайтын.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const cabinet = (extra: Partial<CabinetConfig> = {}): CabinetConfig => withCabinet({
  height: 800, width: 800, depth: 500,
  sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{ kind: 'shelves', count: 1, shelfKind: 'adjustable' }],
    fronts: { count: 1, mount: 'overlay' },
  }],
  ...extra,
})

const gen = (extra = {}) => generateCabinet(cabinet(extra), catalog)
const byLabel = (panels: Panel[], label: string) => panels.filter((p) => p.label === label)
const front = (panels: Panel[]) => panels.find((p) => p.role === 'front' && p.label === 'Фасад')!

describe('панельдің өзі', () => {
  const panels = gen({ frontPanel: { width: 120, side: 'left' } })

  it('ДЕТАЛЬ болып шығады, толық биіктікте', () => {
    const panel = byLabel(panels, 'Фронтальная панель')
    expect(panel).toHaveLength(1)
    expect(panel[0]!.finishedWidth).toBe(120)
    expect(panel[0]!.finishedLength).toBe(800)
  })

  it('әдепкіде ФАСАД материалынан — ол көрінеді', () => {
    const panel = byLabel(panels, 'Фронтальная панель')[0]!
    expect(panel.materialId).toBe(cabinet().frontMaterialId)
  })

  it('фасадпен БІР жазықтықта тұрады', () => {
    const panel = byLabel(panels, 'Фронтальная панель')[0]!
    expect(panel.position.z).toBe(front(panels).position.z)
  })

  it('сол/оң жақта тұрады', () => {
    expect(byLabel(gen({ frontPanel: { width: 120, side: 'left' } }), 'Фронтальная панель')[0]!.position.x)
      .toBe(0)
    expect(byLabel(gen({ frontPanel: { width: 120, side: 'right' } }), 'Фронтальная панель')[0]!.position.x)
      .toBe(800 - 120)
  })
})

describe('ұя тарылады', () => {
  it('фасад дәл сол еніне кішірейеді', () => {
    const plain = front(gen()).finishedWidth
    const narrowed = front(gen({ frontPanel: { width: 120, side: 'left' } })).finishedWidth
    expect(narrowed).toBe(plain - 120)
  })

  it('сол жақта фасад ОҢҒА жылжиды, оң жақта орнында қалады', () => {
    const plainX = front(gen()).position.x
    expect(front(gen({ frontPanel: { width: 120, side: 'left' } })).position.x).toBe(plainX + 120)
    expect(front(gen({ frontPanel: { width: 120, side: 'right' } })).position.x).toBe(plainX)
  })

  it('панель мен фасад ҚАБАТТАСПАЙДЫ', () => {
    const panels = gen({ frontPanel: { width: 120, side: 'left' } })
    const panel = byLabel(panels, 'Фронтальная панель')[0]!
    expect(front(panels).position.x)
      .toBeGreaterThanOrEqual(panel.position.x + panel.finishedWidth)
  })
})

describe('ІШКІ геометрия тиылмайды', () => {
  it('сөре бұрынғы енінде қалады — панель корпустың АЛДЫНДА', () => {
    const shelf = (extra = {}) => generateCabinet(cabinet(extra), catalog)
      .find((p: Panel) => p.role === 'shelf')!
    expect(shelf({ frontPanel: { width: 120, side: 'left' } }).finishedLength)
      .toBe(shelf().finishedLength)
  })
})

describe('ЯЩИК панельге соғылмайды', () => {
  const withDrawers = (extra = {}) => generateCabinet(cabinet({
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'drawers', count: 2 }],
      fronts: null,
    }],
    ...extra,
  }), catalog)

  it('қорап та, фасады да тарылады', () => {
    const box = (panels: Panel[]) => panels.find((p) => p.role === 'drawerBottom')!.finishedLength
    expect(box(withDrawers({ frontPanel: { width: 120, side: 'left' } })))
      .toBe(box(withDrawers()) - 120)
  })

  it('қорап панельдің ШЕТІНЕН оңға басталады', () => {
    const panels = withDrawers({ frontPanel: { width: 120, side: 'left' } })
    const box = panels.find((p) => p.role === 'drawerBottom')!
    expect(box.position.x).toBeGreaterThanOrEqual(120)
  })
})

describe('тексерулер', () => {
  it('фасадқа орын қалмаса — ҚАТЕ', () => {
    expect(() => gen({ frontPanel: { width: 780, side: 'left' } })).toThrow(/фасад/)
  })

  it('тым тар панель — ҚАТЕ', () => {
    expect(() => gen({ frontPanel: { width: 5, side: 'left' } })).toThrow()
  })
})

/**
 * K5 / audit C3 (docs/audit/corner-2026-09-20.md §C3): `make()` позицияны
 * ӨЗІ `baseHeight`-ке көтереді (`raised = { ...position, y: position.y +
 * baseHeight }`), ал фронтальдық панель шақыруында `y: baseHeight` тағы бір
 * рет беріліп, панель цоколь биіктігіне ЕКІ РЕТ көтеріледі. Цокольсіз
 * корпуста (`baseHeight = 0`) ақау көрінбейді — сондықтан осы тестке дейін
 * ешбір фикстурада цоколь болмаған.
 */
describe('цоколі бар (K5 / audit C3)', () => {
  it('панельдің y аралығы корпустың (бүйірдің) y аралығымен сәйкес келуі керек', () => {
    const panels = gen({
      frontPanel: { width: 120, side: 'left' },
      base: { kind: 'plinth', height: 95, plinthShape: 'box' },
    })
    const panel = byLabel(panels, 'Фронтальная панель')[0]!
    const side = panels.find((p) => p.id === 'side-left')!

    expect(panel.position.y).toBe(side.position.y)
    expect(panel.position.y + panel.finishedLength).toBe(side.position.y + side.finishedLength)
  })
})

