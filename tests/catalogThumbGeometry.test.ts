import { describe, expect, it } from 'vitest'
import { catalogThumbGeometry } from '../components/panels/catalogThumbGeometry'

describe('изометриялық каталог нобайы', () => {
  it('екі есікке бір бөлгіш және екі тұтқа береді', () => {
    const shape = catalogThumbGeometry({ doorCount: 2, position: 'upper' })
    expect(shape.frontDividers).toHaveLength(1)
    expect(shape.handles).toHaveLength(2)
    expect(shape.side).toContain('M')
  })
  it('үш жәшікке екі бөлгіш береді', () => {
    const shape = catalogThumbGeometry({ drawerCount: 3, position: 'lower' })
    expect(shape.frontDividers).toHaveLength(2)
    expect(shape.handles).toHaveLength(3)
  })
})
