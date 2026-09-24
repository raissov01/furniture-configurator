/**
 * Қабырғаға тірелмеген (еркін тұрған) шкафтың legacy `placement`-і тек
 * жуықтау: `placementFromPose` оны ең жақын қабырғаға «тартады». Сондықтан
 * «От пола» не «Смещение» өрісін өзгерту шкафты қабырғаға секіртеді
 * (x 700 → 450). 3D-де мұндай шкафты сүйреу бұрыннан өшірулі (`wallBound`),
 * store да соны ұстауы керек: еркін шкаф қабырға бойымен жылжымайды.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { ConfigValidationError, parseProjectV4, walkTree } from '../src/core/index'
import type { Pose } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

const poseOf = (id: string): Pose => {
  let found: Pose | undefined
  walkTree(useConfigurator.getState().root, (node, pose) => { if (node.id === id) found = pose })
  return found!
}

describe('еркін шкаф қабырғаға секірмейді', () => {
  it('movePlacement еркін шкафты өзгертпей, қате береді', () => {
    const file = parseProjectV4(referenceProject)
    const cabinet = file.root.children[0]!
    file.root.children = [{ ...cabinet, transform: { ...cabinet.transform,
      pos: { ...cabinet.transform.pos, x: 700, z: cabinet.transform.pos.z - 300 } } }]
    useConfigurator.getState().loadProject(file)
    const before = useConfigurator.getState().root
    const pose = poseOf(cabinet.id)
    expect(() => useConfigurator.getState().movePlacement(cabinet.id, { elevation: 100 }))
      .toThrow(ConfigValidationError)
    expect(useConfigurator.getState().root).toBe(before)
    expect(poseOf(cabinet.id)).toEqual(pose)
  })

  it('қабырғадағы шкаф бұрынғыша жылжиды', () => {
    useConfigurator.getState().loadProject(parseProjectV4(referenceProject))
    const id = referenceProject.cabinets[0]!.id
    useConfigurator.getState().movePlacement(id, { elevation: 100 })
    expect(poseOf(id).position.y).toBe(100)
  })
})
