import { expect, it } from 'vitest'
import { parseSilhouetteHeight, validSilhouetteHeight } from '../lib/silhouetteInput'
import { useConfigurator } from '../store/configurator'

it('accepts only whole silhouette heights from 1000 to 2200 mm', () => {
  expect(parseSilhouetteHeight('1000')).toEqual({ value: 1000 })
  expect(parseSilhouetteHeight('2200')).toEqual({ value: 2200 })
  for (const raw of ['', '0', '-1', '2300', '1.5', '1700.5', 'abc']) {
    expect(parseSilhouetteHeight(raw)).toHaveProperty('error')
  }
  expect(validSilhouetteHeight(1700)).toBe(true)
  expect(validSilhouetteHeight(1700.5)).toBe(false)
})

it('does not persist an invalid direct store update', () => {
  const prior = useConfigurator.getState().silhouette.height
  expect(() => useConfigurator.getState().setSilhouette({ height: 0 })).toThrow()
  expect(useConfigurator.getState().silhouette.height).toBe(prior)
})
