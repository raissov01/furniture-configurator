/**
 * Ящиктің фасадын қорапқа бекіту.
 *
 * Бұл бізде МҮЛДЕ жоқ еді: направляющаяның тесіктері бар, ал фасадты не
 * ұстайтыны айтылмайтын — цех оны қолмен өлшеп бұрғылайтын. Ал фасад
 * қисайса, оны клиент бірінші көреді.
 *
 * Сандар qdesign-ның CNC экспортынан алынған (constants.ts қара), сондықтан
 * тест те дәл сол схеманы күзетеді: қабырғаны ТЕСІП өтеді, фасадқа тек пилот.
 */
import { describe, expect, it } from 'vitest'
import {
  DRAWER_FACADE_SCREW_DIAMETER, DRAWER_FACADE_SCREW_PILOT_DEPTH,
  SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const withDrawers = (count = 2): Panel[] => {
  const config: CabinetConfig = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
  return generateCabinet({
    ...config,
    sections: config.sections.map((s) => ({
      ...s,
      contents: s.contents.map((c) => (c.kind === 'drawers' ? { ...c, count } : c)),
    })),
  }, SEED_CATALOG)
}

const panels = withDrawers()
const walls = panels.filter((p) => p.id.endsWith('-wall-front'))
const facades = panels.filter((p) => p.label === 'Фасад ящика')
const screws = (panel: Panel) =>
  panel.drilling.filter((d) => d.diameter === DRAWER_FACADE_SCREW_DIAMETER)

describe('фасадты қорапқа бекіту', () => {
  it('әр ящикте қораптың алдыңғы қабырғасы да, фасады да бар', () => {
    expect(walls.length).toBeGreaterThan(0)
    expect(facades).toHaveLength(walls.length)
  })

  it('қабырғада ТӨРТ тесік, әрі ол ТЕСІП өтеді', () => {
    for (const wall of walls) {
      const holes = screws(wall)
      expect(holes).toHaveLength(4)
      for (const hole of holes) {
        // Тереңдігі панельдің қалыңдығына тең — яғни өтпелі.
        expect(hole.depth).toBe(16)
        expect(hole.face).toBe('inner')
      }
    }
  })

  it('фасадта ТӨРТ пилот тесік, ол ТЕСІП ШЫҚПАЙДЫ', () => {
    for (const facade of facades) {
      const holes = screws(facade)
      expect(holes).toHaveLength(4)
      for (const hole of holes) {
        expect(hole.depth).toBe(DRAWER_FACADE_SCREW_PILOT_DEPTH)
        expect(hole.depth).toBeLessThan(16)
        // Ішкі бетінде: сыртқы бет клиентке көрінеді.
        expect(hole.face).toBe('inner')
      }
    }
  })

  it('тік бойынша қабырға биіктігінің 1/3 пен 2/3-інде', () => {
    const wall = walls[0]!
    const rows = [...new Set(screws(wall).map((d) => d.x))].sort((a, b) => a - b)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toBe(Math.round(wall.finishedLength / 3))
    expect(rows[1]).toBe(Math.round((wall.finishedLength * 2) / 3))
  })

  it('көлденеңінен симметриялы: екі ұштан бірдей шегініс', () => {
    const wall = walls[0]!
    const cols = [...new Set(screws(wall).map((d) => d.y))].sort((a, b) => a - b)
    expect(cols).toHaveLength(2)
    expect(cols[0]).toBe(wall.finishedWidth - cols[1]!)
  })

  /**
   * Екі тесік БІР бұранданың екі ұшы, сондықтан олар бір физикалық нүктеде
   * тұр. Бірақ координаталар РЕЗ панелінде беріледі (§4.9), ал қораптың
   * қабырғасы мен фасадтың кромкасы әртүрлі — сол себепті сандар дәлме-дәл
   * теңеспейді, айырма кромканың қалыңдығынан аспауы керек.
   */
  it('фасадтағы тесік қабырғадағымен бір нүктеде (кромка шегерімін ескергенде)', () => {
    const TOLERANCE = 3
    for (const wall of walls) {
      const facade = panels.find((p) => p.id === `${wall.id.slice(0, -'-wall-front'.length)}-front`)!
      const wallWorld = screws(wall)
        .map((d) => [wall.position.y + d.x, wall.position.x + d.y] as const)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      const facadeWorld = screws(facade)
        .map((d) => [facade.position.y + d.x, facade.position.x + d.y] as const)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])

      expect(facadeWorld).toHaveLength(wallWorld.length)
      wallWorld.forEach(([wy, wx], i) => {
        const [fy, fx] = facadeWorld[i]!
        expect(Math.abs(fy - wy), 'биіктік').toBeLessThanOrEqual(TOLERANCE)
        expect(Math.abs(fx - wx), 'ен').toBeLessThanOrEqual(TOLERANCE)
      })
    }
  })

  it('тар ящикте шегініс қысылады — тесік панельден шықпайды', () => {
    for (const panel of [...walls, ...facades]) {
      for (const hole of screws(panel)) {
        expect(hole.x).toBeGreaterThan(0)
        expect(hole.x).toBeLessThan(panel.cutLength)
        expect(hole.y).toBeGreaterThan(0)
        expect(hole.y).toBeLessThan(panel.cutWidth)
      }
    }
  })

  it('ящик жоқ корпуста бұл тесіктер де ЖОҚ', () => {
    const plain = generateCabinet(
      templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG),
      SEED_CATALOG,
    )
    const found = plain.flatMap((p) => p.drilling)
      .filter((d) => d.diameter === DRAWER_FACADE_SCREW_DIAMETER)
    expect(found).toEqual([])
  })
})
