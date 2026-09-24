/**
 * Жобаны алмастыратын генераторлар (жиынтық, ас үй) v4 ағашында id-сі
 * қайталанатын модульді ескі transform-мен қалдырмауы керек.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  SEED_SETS, generateKitchen, placementPose, setToProject, walkTree,
} from '../src/core/index'
import type { CabinetConfig, Placement, Pose } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => {
  useConfigurator.setState({
    root: baseline.root, layers: baseline.layers, room: baseline.room,
    projectSettings: baseline.projectSettings, projectMaterials: baseline.projectMaterials,
    projectEdgeBands: baseline.projectEdgeBands, catalog: baseline.catalog,
    cabinets: baseline.cabinets, placements: baseline.placements,
    activeId: baseline.activeId, past: [], future: [], projectLoadError: null,
  })
})

const s = () => useConfigurator.getState()
function worldPoses(): Map<string, Pose> {
  const out = new Map<string, Pose>()
  walkTree(s().root, (node, pose) => { out.set(node.id, pose) })
  return out
}

/** Әр шкафтың әлемдік орны генератор берген placement-пен дәл сай ма. */
function expectPosesMatch(cabinets: CabinetConfig[], placements: Placement[]) {
  const world = worldPoses()
  for (const placement of placements) {
    const cabinet = cabinets.find((c) => c.id === placement.cabinetId)!
    expect(world.get(placement.cabinetId), placement.cabinetId).toEqual(placementPose(s().room, cabinet, placement))
  }
}

describe('жобаны алмастыратын генераторлар ескі орынды қалдырмайды', () => {
  it('ас үйді басқа ұзындықпен қайта генерациялағанда модульдер жаңа орнына түседі', () => {
    s().loadKitchen({ layout: 'straight', lengthA: 3000 })
    const next = generateKitchen({ layout: 'straight', lengthA: 2400 }, s().catalog)
    s().loadKitchen({ layout: 'straight', lengthA: 2400 })
    expectPosesMatch(next.cabinets, next.placements)
  })

  it('жылжытылған жиынтықты қайта жүктегенде ол бастапқы орнына оралады', () => {
    const preset = SEED_SETS[2]!
    s().loadSet(preset.id)
    const first = s().placements[0]!
    s().movePlacement(first.cabinetId, { offset: first.offset + 300 })
    s().loadSet(preset.id)
    const { cabinets, placements } = setToProject(preset, s().catalog)
    expectPosesMatch(cabinets, placements)
  })
})
