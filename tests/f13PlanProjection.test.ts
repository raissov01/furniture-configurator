import { expect, it } from 'vitest'
import { projectionForPreset } from '../lib/viewProjection'
import { useConfigurator } from '../store/configurator'

it('makes every Plan preset orthographic while preserving other view projections', () => {
  expect(projectionForPreset('plan', 'perspective')).toBe('ortho')
  expect(projectionForPreset('plan', 'ortho')).toBe('ortho')
  expect(projectionForPreset('front', 'perspective')).toBe('perspective')
  const before = useConfigurator.getState()
  before.setProjection('perspective')
  useConfigurator.getState().setCameraPreset('plan')
  expect(useConfigurator.getState().projection).toBe('ortho')
  before.setCameraPreset('three-quarter')
  before.setProjection('perspective')
})
