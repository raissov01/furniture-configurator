import { describe, expect, it } from 'vitest'
import { mirrorCabinet } from '../src/core/mirror'
import { mirrorFreeNodeX } from '../src/core/mirrorFree'
import { migrateV3ToV4, parseProjectV4 } from '../src/core/projectV4'
import { IDENTITY_TRANSFORM } from '../src/core/tree'
import { SEED_CATALOG } from '../src/core/seed'
import { referenceProject, referenceWardrobe } from './fixtures'

describe('айна атауы', () => {
  it('шкафтың бес айнасы қысқа әрі бірегей аталады', () => {
    let cabinet = referenceWardrobe
    const names: string[] = []
    for (let n = 1; n <= 5; n += 1) {
      cabinet = mirrorCabinet(cabinet, `mirror-${n}`)
      names.push(cabinet.name)
    }
    expect(new Set(names).size).toBe(5)
    expect(names[4]).toBe(`${referenceWardrobe.name} (зеркало 5)`)
  })

  it('еркін түйіннің бес айнасы да жиналмайды', () => {
    let node = { kind: 'solid' as const, id: 'solid', name: 'Декор', transform: IDENTITY_TRANSFORM,
      solid: { size: { x: 100, y: 100, z: 100 } } }
    const names: string[] = []
    for (let n = 1; n <= 5; n += 1) {
      node = mirrorFreeNodeX(node, SEED_CATALOG, 500, `-${n}`) as typeof node
      names.push(node.name)
    }
    expect(new Set(names).size).toBe(5)
    expect(names[4]).toBe('Декор (зеркало 5)')
  })

  it('бұрынғы v4 жобаны ашқанда ұзын атауларды қысқартады', () => {
    const old = migrateV3ToV4(referenceProject)
    const cabinet = old.root.children.find((child) => child.kind === 'cabinet')!
    cabinet.name = 'Шкаф-пенал (зеркало) (зеркало) (зеркало) (зеркало) (зеркало)'
    if (cabinet.kind !== 'cabinet') throw new Error('cabinet expected')
    cabinet.config.name = cabinet.name
    const loaded = parseProjectV4(old)
    const restored = loaded.root.children.find((child) => child.kind === 'cabinet')!
    expect(restored.name).toBe('Шкаф-пенал (зеркало 5)')
    if (restored.kind !== 'cabinet') throw new Error('cabinet expected')
    expect(restored.config.name).toBe(restored.name)
  })
})
