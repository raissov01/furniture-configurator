/**
 * v3 → v4: орны жоқ шкаф hidden түйін болады, бірақ тізімдегі орнын
 * сақтайды — белсенді модуль мен деталировка реті ауыспауы керек.
 */
import { describe, expect, it } from 'vitest'
import { SEED_CATALOG, SEED_SETS, parseProjectV4, setToProject } from '../src/core/index'
import type { CabinetConfig, Placement, Room } from '../src/core/index'

const room: Room = { width: 4000, depth: 3000, height: 2700 }
const seed = setToProject(SEED_SETS[0]!, SEED_CATALOG).cabinets[0]!
const cab = (id: string): CabinetConfig => ({ ...seed, id, name: `Модуль ${id}` })
const v3 = (cabinets: CabinetConfig[], placements: Placement[]) => ({
  schemaVersion: 3, name: 'Жоба', materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
  room, cabinets, placements,
})

describe('v3 → v4 миграциясы шкаф ретін сақтайды', () => {
  it('орны жоқ шкаф тізімнің соңына ауыспайды', () => {
    const file = parseProjectV4(v3([cab('a'), cab('b'), cab('c')], [
      { cabinetId: 'b', wall: 'south', offset: 0 }, { cabinetId: 'c', wall: 'south', offset: 700 },
    ]))
    expect(file.root.children.map((node) => node.id)).toEqual(['a', 'b', 'c'])
    expect(file.root.children[0]).toMatchObject({ hidden: true })
  })
})
