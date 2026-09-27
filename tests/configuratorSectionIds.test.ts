import { afterEach, expect, it } from 'vitest'
import { generateCabinet, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const initial = useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial, true))

it('қайта қосылған секция өшірілген ID-ді пайдаланып, шкафты генерациялайды', () => {
  useConfigurator.getState().edit('width', { width: 1200 })
  useConfigurator.getState().addSection()
  useConfigurator.getState().addSection()
  expect(useConfigurator.getState().cabinets[0]!.sections.map((section) => section.id)).toEqual(['s1', 's2', 's3'])
  useConfigurator.getState().removeSection(1)
  useConfigurator.getState().addSection()
  const cabinet = useConfigurator.getState().cabinets[0]!
  expect(new Set(cabinet.sections.map((section) => section.id)).size).toBe(3)
  expect(() => generateCabinet(cabinet, useConfigurator.getState().catalog)).not.toThrow()
  expect(() => parseProjectV4(useConfigurator.getState().exportProject())).not.toThrow()
})
