import { afterEach, describe, expect, it } from 'vitest'
import { useConfigurator } from '../store/configurator'
import { importDxfBoard } from '../src/core/import/dxfBoard'
import { importObjSolid } from '../src/core/import/solid'
import { flattenTree } from '../src/core/flatten'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const baseline = useConfigurator.getState()
afterEach(() => useConfigurator.setState(baseline, true))
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)))

describe('өндірістік файл түйінін жобаға қосу', () => {
  it('DXF тақтасын ағашқа қосып, деталировкада және undo-да сақтайды', () => {
    const state = useConfigurator.getState()
    const materialId = state.catalog.materials[0]!.id
    const node = importDxfBoard(fixture('dxf-board-rect.dxf').toString('utf8'),
      { id: 'import-test-board', name: 'DXF тақта', materialId })
    state.importNode(node)
    const after = useConfigurator.getState()
    expect(after.root.children.some((child) => child.id === node.id)).toBe(true)
    expect(after.activeId).toBe(node.id)
    expect(flattenTree(after.root, after.catalog, after.projectSettings ?? after.shop.settings)
      .nodes.flatMap((entry) => entry.panels)
      .some((panel) => panel.finishedLength === 600 && panel.finishedWidth === 300)).toBe(true)
    after.undo()
    expect(useConfigurator.getState().root.children.some((child) => child.id === node.id)).toBe(false)
  })

  it('OBJ сәндік түйіні кесімге түспейді және қайталанған id өтпейді', () => {
    const node = importObjSolid(fixture('solid-box.obj').toString('utf8'),
      { id: 'import-test-solid', name: 'Декор', mmPerUnit: 100 }).node
    const beforeState = useConfigurator.getState()
    const before = flattenTree(beforeState.root, beforeState.catalog, beforeState.projectSettings ?? beforeState.shop.settings)
      .nodes.flatMap((entry) => entry.panels).length
    useConfigurator.getState().importNode(node)
    const afterState = useConfigurator.getState()
    expect(flattenTree(afterState.root, afterState.catalog, afterState.projectSettings ?? afterState.shop.settings)
      .nodes.flatMap((entry) => entry.panels)).toHaveLength(before)
    expect(() => useConfigurator.getState().importNode(node)).toThrow(/id|түйін/iu)
  })
})
