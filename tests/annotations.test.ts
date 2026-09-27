import { describe, expect, it } from 'vitest'
import { createDefaultLayer, flattenTree, migrateV3ToV4, parseProjectV4, scenePanels, SEED_CATALOG, visibleAnnotations } from '../src/core/index'
import type { GroupNode, SceneNode } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { treeSceneBounds } from '../lib/treeSceneItems'

const annotation: SceneNode = { kind: 'annotation', id: 'note-1', name: 'Ескерту',
  transform: { pos: { x: 120, y: 400, z: 230 }, rot: { x: 0, y: 90, z: 0 } },
  annotation: { text: 'Розетка орны', fontSize: 80, color: '#262626' } }
const root: GroupNode = { kind: 'group', id: 'root', name: 'Жоба',
  transform: { pos: { x: 100, y: 0, z: 50 }, rot: { x: 0, y: 0, z: 0 } }, children: [annotation] }

describe('өндіріске кірмейтін мәтін', () => {
  it('v4 JSON арқылы мәтіні, өлшемі мен әлемдегі орны сақталады; панель шығармайды', () => {
    const project = migrateV3ToV4({ schemaVersion: 3, name: 'Тест',
      materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [], placements: [], room: { width: 4000, depth: 3000, height: 2700 } })
    project.root = root
    const restored = parseProjectV4(JSON.parse(JSON.stringify(project)))
    expect(visibleAnnotations(restored.root, [createDefaultLayer()])).toEqual([{
      nodeId: 'note-1', text: 'Розетка орны', fontSize: 80, color: '#262626',
      pose: { position: { x: 220, y: 400, z: 280 }, rotationY: 90 },
    }])
    expect(scenePanels(flattenTree(restored.root, SEED_CATALOG))).toEqual([])
  })

  it('жасырын ата мен қабат мәтінді көріністен алып тастайды', () => {
    const layers = [createDefaultLayer(), { id: 'notes', name: 'Жазбалар',
      visible: false, locked: false, color: '#000000' }]
    expect(visibleAnnotations({ ...root, children: [{ ...annotation, layerId: 'notes' }] }, layers)).toEqual([])
    expect(visibleAnnotations({ ...root, hidden: true }, [createDefaultLayer()])).toEqual([])
  })

  it('кадрға сыйдыру мәтіннің әлемдегі орнын қамтиды', () => {
    const bounds = treeSceneBounds({ items: [], boards: [], solids: [] }, SEED_CATALOG,
      visibleAnnotations(root, [createDefaultLayer()]))
    expect(bounds).toMatchObject({ x0: 220, y0: 400, z1: 280 })
    expect(bounds?.x1).toBeGreaterThan(220)
  })

  it('бос мәтінді және бөлшек мм өлшемді v4 қабылдамайды', () => {
    const project = migrateV3ToV4({ schemaVersion: 3, name: 'Тест',
      materials: SEED_CATALOG.materials, edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [], placements: [], room: { width: 4000, depth: 3000, height: 2700 } })
    project.root = root
    const raw = JSON.parse(JSON.stringify(project)) as { root: { children: { annotation: { text: string; fontSize: number } }[] } }
    raw.root.children[0]!.annotation.text = '   '
    expect(() => parseProjectV4(raw)).toThrow()
    raw.root.children[0]!.annotation.text = 'OK'
    raw.root.children[0]!.annotation.fontSize = 12.5
    expect(() => parseProjectV4(raw)).toThrow()
  })
})

describe('мәтін редакторы', () => {
  it('қосу, өзгерту, undo және v4 export бір түйінді сақтайды', () => {
    const before = useConfigurator.getState()
    try {
      const id = useConfigurator.getState().addAnnotation()
      useConfigurator.getState().editAnnotation(id, { text: 'Клиент ескертпесі', fontSize: 120 })
      const file = useConfigurator.getState().exportProject()
      const saved = parseProjectV4(JSON.parse(JSON.stringify(file)))
      const found = saved.root.children.find((node) => node.id === id)
      expect(found?.kind === 'annotation' && found.annotation.text).toBe('Клиент ескертпесі')
      expect(scenePanels(flattenTree(saved.root, SEED_CATALOG))).toEqual(
        scenePanels(flattenTree(before.root, SEED_CATALOG)),
      )
      useConfigurator.getState().undo()
      const reverted = useConfigurator.getState().root.children.find((node) => node.id === id)
      expect(reverted?.kind === 'annotation' && reverted.annotation.text).not.toBe('Клиент ескертпесі')
    } finally {
      useConfigurator.setState(before, true)
    }
  })
})
