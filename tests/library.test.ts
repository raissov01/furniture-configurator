import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile, findTemplate, templateToCabinet } from '../src/core/index'
import { createLibraryItem, insertLibraryItem, parseLibraryItem, replaceLibraryMaterial, replaceTreeBoardMaterial, replaceTreeMaterial } from '../src/core/library'
import type { GroupNode, SceneNode } from '../src/core/tree'

const catalog = catalogOf(defaultShopProfile())
const transform = { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }
const board: SceneNode = { kind: 'board', id: 'board-1', name: 'Тақта', transform,
  board: { materialId: catalog.materials[0]!.id, length: 600, width: 400,
    orientation: { length: 'x', width: 'z', thickness: 'y' },
    edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }
const root: GroupNode = { kind: 'group', id: 'root', name: 'Жоба', transform, children: [board] }

describe('өз кітапханасы', () => {
  it('бір тақтаны материалымен сақтайды, JSON қатаң тексеріледі', () => {
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'item-1')
    expect(item.materials.map((material) => material.id)).toEqual([board.kind === 'board' ? board.board.materialId : ''])
    expect(parseLibraryItem(JSON.parse(JSON.stringify(item)))).toEqual(item)
    expect(() => parseLibraryItem({ ...item, node: { ...board, board: { ...board.board, length: 10.5 } } })).toThrow()
    expect(() => parseLibraryItem({ ...item, materials: [] })).toThrow(/material/i)
    const banded = { ...item, node: { ...board, board: { ...board.board,
      edges: { ...board.board.edges, L1: { bandId: 'missing-band' } } } } }
    expect(() => parseLibraryItem(banded)).toThrow(/band/i)
  })

  it('топ пен шкафты қайта қойғанда барлық ID жаңа әрі материалдары өндірісте бар', () => {
    const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
    const group: GroupNode = { kind: 'group', id: 'group-1', name: 'Топ', transform,
      children: [board, { kind: 'cabinet', id: cabinet.id, name: cabinet.name, transform, config: cabinet }] }
    const item = createLibraryItem(group, catalog, 'Жиһаз', '2026-09-25T00:00:00.000Z', 'item-2')
    const inserted = insertLibraryItem({ ...root, children: [group] }, item, catalog, 'root', (() => {
      let id = 0; return () => `new-${++id}`
    })())
    expect(inserted.children).toHaveLength(2)
    const copy = inserted.children[1]!
    expect(copy.id).toBe('new-1')
    if (copy.kind !== 'group') throw new Error('group expected')
    expect(copy.children.map((node) => node.id)).toEqual(['new-2', 'new-3'])
    expect(item.materials.length).toBeGreaterThan(0)
  })

  it('екі қабат терең ата-топқа элемент қояды', () => {
    const nested: GroupNode = { kind: 'group', id: 'inner', name: 'Ішкі', transform, children: [] }
    const outer: GroupNode = { kind: 'group', id: 'outer', name: 'Сыртқы', transform, children: [nested] }
    const tree: GroupNode = { ...root, children: [outer] }
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'nested')
    const changed = insertLibraryItem(tree, item, catalog, 'inner', () => 'new-nested')
    const target = changed.children[0]
    expect(target?.kind).toBe('group')
    if (target?.kind !== 'group' || target.children[0]?.kind !== 'group') throw new Error('nested group missing')
    expect(target.children[0].children[0]?.id).toBe('new-nested')
  })

  it('қою кезіндегі жаңа ID қақтығысын қабылдамайды', () => {
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'collision')
    expect(() => insertLibraryItem(root, item, catalog, root.id, () => board.id)).toThrow(/ID қайталанды/)
  })

  it('материал ID-і басқа сипаттамада қайталанса қоюды бөгейді', () => {
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'item-3')
    const changed = { ...catalog, materials: catalog.materials.map((material) =>
      material.id === item.materials[0]?.id ? { ...material, thickness: material.thickness + 2 } : material) }
    expect(() => insertLibraryItem(root, item, changed, 'root', () => 'new-1')).toThrow(/материал/i)
  })

  it('сол материалдың цех бағасы өзгерсе, кітапхана қоюға кедергі емес', () => {
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'item-price')
    const repriced = { ...catalog, materials: catalog.materials.map((material) =>
      material.id === item.materials[0]?.id ? { ...material, pricePerSheet: material.pricePerSheet + 100 } : material) }
    expect(() => insertLibraryItem(root, item, repriced, 'root', () => 'new-price')).not.toThrow()
  })

  it('кітапханадағы топтың материалын жаппай ауыстырады, бастапқы түйінді өзгертпейді', () => {
    const item = createLibraryItem(board, catalog, 'Элементтер', '2026-09-25T00:00:00.000Z', 'item-4')
    const next = replaceLibraryMaterial(item, board.kind === 'board' ? board.board.materialId : '', catalog.materials[1]!, catalog)
    expect(next.node.kind === 'board' && next.node.board.materialId).toBe(catalog.materials[1]!.id)
    expect(item.node.kind === 'board' && item.node.board.materialId).toBe(catalog.materials[0]!.id)
  })

  it('Замена жобаның канондық ағашындағы board материалын ауыстырады', () => {
    const next = replaceTreeBoardMaterial(root, catalog.materials[0]!.id, catalog.materials[1]!.id)
    expect(next.children[0]?.kind === 'board' && next.children[0].board.materialId).toBe(catalog.materials[1]!.id)
    expect(root.children[0]?.kind === 'board' && root.children[0].board.materialId).toBe(catalog.materials[0]!.id)
  })

  it('бүкіл жобалық Замена cabinet пен board-ты бір ағашта ауыстырады', () => {
    const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
    const tree: GroupNode = { ...root, children: [board,
      { kind: 'cabinet', id: cabinet.id, name: cabinet.name, transform, config: cabinet }] }
    const oldId = cabinet.carcassMaterialId
    if (board.kind !== 'board') throw new Error('board expected')
    const boardWithSameMaterial: SceneNode = { ...board, board: { ...board.board, materialId: oldId } }
    tree.children[0] = boardWithSameMaterial
    const changed = replaceTreeMaterial(tree, oldId, catalog.materials[1]!.id)
    expect(changed.children[0]?.kind === 'board' && changed.children[0].board.materialId).toBe(catalog.materials[1]!.id)
    expect(changed.children[1]?.kind === 'cabinet' && changed.children[1].config.carcassMaterialId).toBe(catalog.materials[1]!.id)
  })
})
