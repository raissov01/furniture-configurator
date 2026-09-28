import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dimensionLabelPositions } from '../lib/dimensionLabelPlacement'

const labels = readFileSync(new URL('../components/DimensionLabels.tsx', import.meta.url), 'utf8')

describe('F00n сахнадағы өлшем жапсырмалары', () => {
  it('ен белгісін шкаф төбесінен төмен, canvas шетінен аулақ ұстайды', () => {
    const positions = dimensionLabelPositions(2000, 600, 450)
    expect(positions.width).toEqual([300, 1880, 0])
    expect(positions.height[0]).toBeGreaterThanOrEqual(0)
    expect(positions.depth[0]).toBeLessThanOrEqual(600)
  })

  it('төмен шкафта да үш белгі корпус шегінде қалады', () => {
    const positions = dimensionLabelPositions(400, 300, 250)
    for (const position of Object.values(positions)) {
      expect(position[0]).toBeGreaterThanOrEqual(0)
      expect(position[0]).toBeLessThanOrEqual(300)
      expect(position[1]).toBeGreaterThan(0)
      expect(position[1]).toBeLessThan(400)
    }
    expect(labels).toContain('dimensionLabelPositions(H, W, D)')
  })
})
