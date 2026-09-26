import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ConfigValidationError } from '../src/core/errors'
import { panelToDxf } from '../src/core/export/dxf'
import { importDxfBoard } from '../src/core/import/dxfBoard'
import { importGlbSolid, importObjSolid } from '../src/core/import/solid'
import { SEED_CATALOG } from '../src/core/seed'
import { flattenTree } from '../src/core/flatten'
import type { GroupNode } from '../src/core/tree'

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)))
const dxf = () => fixture('dxf-board-rect.dxf').toString('utf8')
const boardOptions = { id: 'board-import', name: 'Сөре', materialId: SEED_CATALOG.materials[0]!.id }

function glb(json: object): Uint8Array {
  const encoded = new TextEncoder().encode(JSON.stringify(json))
  const length = Math.ceil(encoded.length / 4) * 4
  const bytes = new Uint8Array(20 + length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x46546c67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, bytes.length, true)
  view.setUint32(12, length, true)
  view.setUint32(16, 0x4e4f534a, true)
  bytes.set(encoded, 20)
  bytes.fill(32, 20 + encoded.length)
  return bytes
}

describe('DXF → BoardNode', () => {
  it('OUTLINE тікбұрышын өндірістік тақтаға аударады, drill қабатын контур деп алмайды', () => {
    const node = importDxfBoard(dxf(), boardOptions)
    expect(node).toMatchObject({ kind: 'board', id: 'board-import',
      transform: { pos: { x: 100, y: 0, z: 200 } },
      board: { length: 600, width: 300, role: 'custom', materialId: boardOptions.materialId,
        edges: { L1: null, L2: null, W1: null, W2: null } } })
    const root: GroupNode = { kind: 'group', id: 'root', name: 'Root',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [node] }
    const panel = flattenTree(root, SEED_CATALOG).nodes[0]!.panels[0]!
    expect([panel.finishedLength, panel.finishedWidth, panel.cutLength, panel.cutWidth]).toEqual([600, 300, 600, 300])
    expect(importDxfBoard(panelToDxf(panel), boardOptions).board.length).toBe(600)
  })

  it('ашық және қиғаш контурды, bulge доғасын анық қабылдамайды', () => {
    expect(() => importDxfBoard(dxf().replace('70\n1\n10\n100', '70\n0\n10\n100'), boardOptions)).toThrow(ConfigValidationError)
    expect(() => importDxfBoard(dxf().replace('10\n700\n20\n500', '10\n650\n20\n500'), boardOptions)).toThrow(/тікбұрыш/)
    expect(() => importDxfBoard(dxf().replace('10\n700\n20\n200', '10\n700\n20\n200\n42\n0.5'), boardOptions)).toThrow(/доға/)
    expect(() => importDxfBoard(dxf().replace('8\nDRILL_INNER_5_D8', '8\nOUTLINE'), boardOptions)).toThrow(/CIRCLE/)
    expect(() => importDxfBoard(dxf().replace('8\nDRILL_INNER_5_D8', '8\nCUTOUT'), boardOptions)).toThrow(/CUTOUT/)
    expect(() => importDxfBoard(dxf().replace('9\n$INSUNITS\n70\n4', '9\n$INSUNITS\n70\n0'), boardOptions)).toThrow(/INSUNITS/)
  })

  it('бұрыс DXF және материал id-і туралы түсінікті қате береді', () => {
    expect(() => importDxfBoard('not dxf', boardOptions)).toThrow(ConfigValidationError)
    expect(() => importDxfBoard(dxf(), { ...boardOptions, materialId: '' })).toThrow(/materialId/)
  })

  it('LINE контуры және сантиметр бірлігі де бір парсермен оқылады', () => {
    const lines = fixture('dxf-rect-lines.dxf').toString('utf8')
    const cm = fixture('dxf-rect-cm.dxf').toString('utf8')
    expect(importDxfBoard(lines, boardOptions).board).toMatchObject({ length: 4000, width: 3000 })
    expect(importDxfBoard(cm, boardOptions).board).toMatchObject({ length: 4000, width: 3000 })
  })
})

describe('OBJ/GLB → SolidNode spec', () => {
  it('GLB ортақ child түйіндерін қайта-қайта аралауға рұқсат бермейді', () => {
    const nodes = Array.from({ length: 13 }, (_, i) => ({ children: i === 12 ? [] : [i + 1, i + 1] }))
    const bytes = glb({ asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes })
    expect(() => importGlbSolid(bytes, { id: 'shared', name: 'Ортақ' })).toThrow(/ортақ|қайталан/)
  })
  it('OBJ габаритін мм-ге аударады, material атауларын ретімен жинайды', () => {
    const result = importObjSolid(fixture('solid-box.obj').toString('utf8'),
      { id: 'appliance', name: 'Пеш', mmPerUnit: 100 })
    expect(result.node).toMatchObject({ kind: 'solid', solid: { size: { x: 200, y: 200, z: 300 } } })
    expect(result.materialNames).toEqual(['Steel', 'Glass'])
    expect(result.node).not.toHaveProperty('board')
    const root: GroupNode = { kind: 'group', id: 'root-solid', name: 'Root',
      transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [result.node] }
    const scene = flattenTree(root, SEED_CATALOG)
    expect(scene.solids).toHaveLength(1)
    expect(scene.nodes).toHaveLength(0)
  })

  it('GLB POSITION bounds пен node translation-ды оқиды; метрді мм-ге аударады', () => {
    const bytes = fixture('solid-box.glb')
    const result = importGlbSolid(bytes, { id: 'glb', name: 'Декор' })
    expect(result.node.solid.size).toEqual({ x: 200, y: 200, z: 300 })
    expect(result.node.transform.pos).toEqual({ x: 900, y: 0, z: 0 })
    expect(result.materialNames).toEqual(['Ақ металл'])
  })

  it('OBJ бірлігі міндетті, GLB сынған metadata-сы анық қате', () => {
    expect(() => importObjSolid('v 0 0 0\nv 1 2 3', { id: 'x', name: 'X', mmPerUnit: 0 })).toThrow(/mmPerUnit/)
    expect(() => importGlbSolid(new Uint8Array([1, 2]), { id: 'x', name: 'X' })).toThrow(ConfigValidationError)
    const corruptBin = fixture('solid-box.glb')
    corruptBin.writeUInt32LE(0xffffffff, 20 + corruptBin.readUInt32LE(12))
    expect(() => importGlbSolid(corruptBin, { id: 'x', name: 'X' })).toThrow(/BIN/)
    const missingBounds = glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{}] })
    expect(() => importGlbSolid(missingBounds, { id: 'x', name: 'X' })).toThrow(/POSITION/)
    expect(() => importGlbSolid(glb(null as unknown as object), { id: 'x', name: 'X' })).toThrow(ConfigValidationError)
  })

  it('GLB түйінінің бұрылысын world габаритіне қолданады', () => {
    const half = Math.SQRT1_2
    const bytes = glb({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, rotation: [0, half, 0, half] }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ min: [0, 0, 0], max: [0.1, 0.2, 0.3] }] })
    const result = importGlbSolid(bytes, { id: 'rotated', name: 'Бұрылды' })
    expect(result.node.solid.size).toEqual({ x: 300, y: 200, z: 100 })
    expect(result.node.transform.pos).toEqual({ x: 0, y: 0, z: -100 })
  })
})
