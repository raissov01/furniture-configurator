import { describe, expect, it } from 'vitest'
import { enableCornerCabinet } from '../lib/cornerTransition'
import { SEED_CATALOG, SEED_SETS, formatCutList, generateCabinet, setToProject } from '../src/core/index'

describe('corner set cut list scope', () => {
  it('keeps two unequal side widths for the edited cabinet and a paired side for its neighbour', () => {
    const set = SEED_SETS.find((item) => item.id === 'corner-wardrobe')!
    const { cabinets } = setToProject(set, SEED_CATALOG)
    expect(cabinets).toHaveLength(2)
    const active = cabinets[0]!
    const neighbour = cabinets[1]!
    const cornerSides = generateCabinet({ ...active, ...enableCornerCabinet(active) }, SEED_CATALOG)
    const neighbourSides = generateCabinet(neighbour, SEED_CATALOG)

    const rows = formatCutList([...cornerSides, ...neighbourSides], SEED_CATALOG)
      .filter((row) => row.name === 'Боковина')
      .map((row) => ({ width: row.finishedWidth, qty: row.qty }))
      .sort((left, right) => left.width - right.width)

    expect(rows).toEqual([
      { width: 300, qty: 1 },
      { width: 447, qty: 2 },
      { width: 600, qty: 1 },
    ])
  })
})
