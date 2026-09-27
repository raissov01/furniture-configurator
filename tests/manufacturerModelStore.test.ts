import { afterEach, expect, it } from 'vitest'
import { findNode, parseProjectV4 } from '../src/core/index'
import { useConfigurator } from '../store/configurator'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))

it('өндіруші бетінің HTTPS сілтемесін solid түйінімен сақтайды, жарамсызын қабылдамайды', () => {
  const id = useConfigurator.getState().addSolid()
  const source = { kind: 'manufacturer-page' as const, manufacturer: 'Blum', article: 'A123',
    pageUrl: 'https://www.blum.com/example', licenseStatus: 'unverified' as const }
  useConfigurator.getState().editSolid(id, { modelSource: source })
  const saved = parseProjectV4(useConfigurator.getState().exportProject())
  const node = findNode(saved.root, id)
  expect(node?.kind === 'solid' ? node.solid.modelSource : undefined).toEqual(source)
  expect(() => useConfigurator.getState().editSolid(id, {
    modelSource: { ...source, pageUrl: 'javascript:alert(1)' },
  })).toThrow(/modelSource|HTTPS/)
  const after = findNode(useConfigurator.getState().root, id)
  expect(after?.kind === 'solid' ? after.solid.modelSource : undefined).toEqual(source)
})
