/**
 * ҚАБАТТАР (слои) — PRO100 паритеті `docs/pro100/parity.md` §2.1.
 *
 * flattenTree-мен байланысты (hidden жолы), құлыппен байланысты мутация
 * күзеті, қабат өшірілгендегі түйін тағдыры, жоба деңгейінде сақталуы
 * (schema.ts) және жоқ қабатқа сілтеме гочасы.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LAYER_ID,
  createDefaultLayer,
  createLayer,
  deleteLayer,
  isNodeHiddenByLayer,
  renameLayer,
  resolveLayer,
  setLayerLocked,
  setLayerVisible,
  setNodeLayer,
  updateNodeTransform,
} from '../src/core/layers'
import type { Layer } from '../src/core/layers'
import {
  ConfigValidationError, SEED_CATALOG, findNode, flattenTree,
} from '../src/core/index'
import type { GroupNode, SceneNode, Transform } from '../src/core/index'
import { parseProjectWithLayers, serializeProjectWithLayers } from '../src/core/schema'
import type { ProjectFileWithLayers } from '../src/core/schema'

const tr = (x = 0, y = 0, z = 0, rotY = 0): Transform => ({ pos: { x, y, z }, rot: { x: 0, y: rotY, z: 0 } })

const solid = (id: string, opts: Partial<SceneNode> = {}): SceneNode =>
  ({
    kind: 'solid', id, name: id, transform: tr(), solid: { size: { x: 100, y: 100, z: 100 } }, ...opts,
  } as SceneNode)

const group = (id: string, children: SceneNode[], opts: Partial<SceneNode> = {}): GroupNode =>
  ({ kind: 'group', id, name: id, transform: tr(), children, ...opts } as GroupNode)

describe('createLayer / renameLayer / видимость / құлып', () => {
  it('жаңа қабат қосады, әдепкі көрінеді/құлыпсыз', () => {
    const layers = createLayer([], 'l1', 'Техника')
    expect(layers).toEqual([{ id: 'l1', name: 'Техника', visible: true, locked: false, color: '#4a90d9' }])
  })

  it('қайталанған id — ConfigValidationError', () => {
    const layers = createLayer([], 'l1', 'Техника')
    expect(() => createLayer(layers, 'l1', 'Тағы')).toThrow(ConfigValidationError)
  })

  it('renameLayer, setLayerVisible, setLayerLocked — таза, өзгертпейді', () => {
    const layers = createLayer([], 'l1', 'Техника')
    const renamed = renameLayer(layers, 'l1', 'Жаңа ат')
    expect(renamed[0]!.name).toBe('Жаңа ат')
    expect(layers[0]!.name).toBe('Техника') // түпнұсқа өзгермеген

    const hidden = setLayerVisible(layers, 'l1', false)
    expect(hidden[0]!.visible).toBe(false)

    const locked = setLayerLocked(layers, 'l1', true)
    expect(locked[0]!.locked).toBe(true)
  })
})

describe('flattenTree — жасырылған қабат', () => {
  it('көрінбейтін қабаттағы түйін шығысында ЖОҚ', () => {
    const layers: Layer[] = [
      createDefaultLayer(),
      { id: 'tech', name: 'Техника', visible: false, locked: false, color: '#ff0000' },
    ]
    const root = group('root', [
      solid('s-visible'),
      solid('s-hidden', { layerId: 'tech' }),
    ])
    const scene = flattenTree(root, SEED_CATALOG, undefined, layers)
    const ids = scene.solids.map((s) => s.nodeId)
    expect(ids).toContain('s-visible')
    expect(ids).not.toContain('s-hidden')
  })

  it('layers параметрі берілмесе — тек node.hidden қаралады (ескі шақыру бұзылмайды)', () => {
    const root = group('root', [solid('s1')])
    const scene = flattenTree(root, SEED_CATALOG)
    expect(scene.solids.map((s) => s.nodeId)).toEqual(['s1'])
  })

  it('node.hidden true болса — қабат бар/жоқ, бәрібір шықпайды', () => {
    const layers: Layer[] = [createDefaultLayer()]
    const root = group('root', [solid('s1', { hidden: true })])
    const scene = flattenTree(root, SEED_CATALOG, undefined, layers)
    expect(scene.solids).toHaveLength(0)
  })
})

describe('құлыпталған қабат — мутация күзеті', () => {
  it('құлыпталған қабаттағы түйінді жылжытуға әрекет → ConfigValidationError, өріс атымен', () => {
    const layers: Layer[] = [
      createDefaultLayer(),
      { id: 'locked-layer', name: 'Құлыпты', visible: true, locked: true, color: '#00ff00' },
    ]
    const root = group('root', [solid('s1', { layerId: 'locked-layer' })])
    let err: unknown
    try {
      updateNodeTransform(root, 's1', tr(500, 0, 0), layers)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ConfigValidationError)
    expect((err as InstanceType<typeof ConfigValidationError>).field).toBe('node.layerId')
  })

  it('түйіннің өз locked=true белгісі де тоқтатады, өріс атымен', () => {
    const layers: Layer[] = [createDefaultLayer()]
    const root = group('root', [solid('s1', { locked: true })])
    expect(() => updateNodeTransform(root, 's1', tr(1, 0, 0), layers))
      .toThrow(ConfigValidationError)
    try {
      updateNodeTransform(root, 's1', tr(1, 0, 0), layers)
    } catch (e) {
      expect((e as InstanceType<typeof ConfigValidationError>).field).toBe('node.locked')
    }
  })

  it('құлыпсыз қабаттағы түйін еркін жылжиды', () => {
    const layers: Layer[] = [createDefaultLayer()]
    const root = group('root', [solid('s1')])
    const next = updateNodeTransform(root, 's1', tr(777, 0, 0), layers)
    expect(findNode(next, 's1')!.transform.pos.x).toBe(777)
  })
})

describe('setNodeLayer — түйінді қабатқа тағайындау', () => {
  it('түйінді басқа қабатқа ауыстырады', () => {
    const layers: Layer[] = [createDefaultLayer(), { id: 'tech', name: 'Техника', visible: true, locked: false, color: '#123456' }]
    const root = group('root', [solid('s1')])
    const next = setNodeLayer(root, 's1', 'tech', layers)
    expect(findNode(next, 's1')!.layerId).toBe('tech')
  })

  it('құлыпталған қабаттағы түйінді басқа қабатқа ауыстыруға әрекет → ConfigValidationError', () => {
    const layers: Layer[] = [
      createDefaultLayer(),
      { id: 'locked-layer', name: 'Құлыпты', visible: true, locked: true, color: '#00ff00' },
    ]
    const root = group('root', [solid('s1', { layerId: 'locked-layer' })])
    expect(() => setNodeLayer(root, 's1', DEFAULT_LAYER_ID, layers)).toThrow(ConfigValidationError)
  })
})

describe('deleteLayer — қабат өшірілгенде түйіндер жоғалмайды', () => {
  it('ондағы түйіндер ӘДЕПКІ қабатқа ауысады, жоғалмайды', () => {
    const layers: Layer[] = [
      createDefaultLayer(),
      { id: 'tech', name: 'Техника', visible: true, locked: false, color: '#ff0000' },
    ]
    const root = group('root', [
      solid('s1', { layerId: 'tech' }),
      solid('s2', { layerId: 'tech' }),
      solid('s3'),
    ])
    const result = deleteLayer(root, layers, 'tech')
    expect(result.layers.map((l) => l.id)).toEqual([DEFAULT_LAYER_ID])
    expect(findNode(result.root, 's1')!.layerId).toBe(DEFAULT_LAYER_ID)
    expect(findNode(result.root, 's2')!.layerId).toBe(DEFAULT_LAYER_ID)
    // s3 бұрыннан layerId жоқ еді — сол күйінде қалады
    expect(findNode(result.root, 's3')!.layerId).toBeUndefined()
  })

  it('әдепкі қабатты өшіруге болмайды', () => {
    const root = group('root', [])
    expect(() => deleteLayer(root, [createDefaultLayer()], DEFAULT_LAYER_ID)).toThrow(ConfigValidationError)
  })
})

describe('resolveLayer / isNodeHiddenByLayer — жоқ қабатқа сілтеме', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { warnSpy.mockRestore() })

  it('жоқ қабатқа сілтеген түйін ҚҰЛАМАЙДЫ, әдепкіге түседі әрі console.warn жазады', () => {
    const layers: Layer[] = [createDefaultLayer()]
    const resolved = resolveLayer('joq-qabat', layers)
    expect(resolved.id).toBe(DEFAULT_LAYER_ID)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(String(warnSpy.mock.calls[0]![0])).toContain('joq-qabat')
  })

  it('flattenTree де осы жолмен құламайды: жоқ қабатқа сілтеген түйін әдепкідей (көрінеді)', () => {
    const layers: Layer[] = [createDefaultLayer()]
    const root = group('root', [solid('s1', { layerId: 'joq-qabat' })])
    const scene = flattenTree(root, SEED_CATALOG, undefined, layers)
    expect(scene.solids.map((s) => s.nodeId)).toEqual(['s1'])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('isNodeHiddenByLayer — тіке тексеру', () => {
    expect(isNodeHiddenByLayer({ layerId: undefined }, [createDefaultLayer()])).toBe(false)
    expect(isNodeHiddenByLayer(
      { layerId: 'l1' },
      [{ id: 'l1', name: 'X', visible: false, locked: false, color: '#000000' }],
    )).toBe(true)
  })
})

describe('жобамен бірге сақталу (schema.ts)', () => {
  const testCabinet = {
    id: 'c1',
    name: 'Шкаф',
    construction: 'sidesOverlay' as const,
    height: 2000,
    width: 600,
    depth: 450,
    carcassMaterialId: SEED_CATALOG.materials[0]!.id,
    frontMaterialId: SEED_CATALOG.materials[0]!.id,
    backMaterialId: SEED_CATALOG.materials[0]!.id,
    back: { mode: 'overlay' as const },
    edging: { visibleFront: null, visibleSecondary: null, hidden: null },
    sections: [{ id: 's1', widthMode: 'flex' as const, contents: [{ kind: 'empty' as const }] }],
  }

  const baseProject = {
    schemaVersion: 3 as const,
    name: 'Тест жоба',
    materials: SEED_CATALOG.materials,
    edgeBands: SEED_CATALOG.edgeBands,
    cabinets: [testCabinet],
    room: { width: 4000, depth: 3000, height: 2700 },
    placements: [],
  }

  it('қабаттарсыз жоба — parseProjectWithLayers бос тізім қайтарады', () => {
    const result = parseProjectWithLayers(baseProject)
    expect(result.layers).toEqual([])
    expect(result.name).toBe('Тест жоба')
  })

  it('сақтап (serialize) → JSON → оқып (parse) алғанда қабаттар САҚТАЛАДЫ', () => {
    const layers: Layer[] = [
      createDefaultLayer(),
      { id: 'tech', name: 'Техника', visible: false, locked: true, color: '#ff00ff' },
    ]
    const project: ProjectFileWithLayers = { ...baseProject, layers }
    const serialized = serializeProjectWithLayers(project)
    const roundTripped = JSON.parse(JSON.stringify(serialized)) as unknown
    const parsed = parseProjectWithLayers(roundTripped)
    expect(parsed.layers).toEqual(layers)
  })

  it('ескі жоба (v1, schemaVersion=1, cabinets жоқ) де қабатсыз — бос тізіммен көтеріледі', () => {
    const v1 = {
      schemaVersion: 1 as const,
      name: 'Ескі жоба',
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets: [
        {
          id: 'c1',
          name: 'Шкаф',
          construction: 'sidesOverlay' as const,
          height: 2000,
          width: 600,
          depth: 450,
          carcassMaterialId: SEED_CATALOG.materials[0]!.id,
          frontMaterialId: SEED_CATALOG.materials[0]!.id,
          backMaterialId: SEED_CATALOG.materials[0]!.id,
          back: { mode: 'overlay' as const },
          edging: { visibleFront: null, visibleSecondary: null, hidden: null },
          shelves: { count: 0, kind: 'adjustable' as const },
          fronts: null,
        },
      ],
    }
    const parsed = parseProjectWithLayers(v1)
    expect(parsed.layers).toEqual([])
    expect(parsed.schemaVersion).toBe(3)
  })
})
