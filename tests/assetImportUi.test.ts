import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseAssetImport } from '../lib/assetImportUi'
import { SEED_CATALOG } from '../src/core/seed'

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`fixtures/${name}`, import.meta.url)))
const materialId = SEED_CATALOG.materials[0]!.id

describe('импорт панелінің файл маршруты', () => {
  it('DXF-ті материал таңдауымен тақтаға, OBJ/GLB-ті сәндік денеге өткізеді', () => {
    const board = parseAssetImport('shelf.dxf', fixture('dxf-board-rect.dxf'), 'board-1', { materialId })
    expect(board.node).toMatchObject({ kind: 'board', board: { materialId, length: 600, width: 300 } })
    const obj = parseAssetImport('stove.obj', fixture('solid-box.obj'), 'solid-1', { mmPerUnit: 100 })
    expect(obj.node).toMatchObject({ kind: 'solid', solid: { size: { x: 200, y: 200, z: 300 } } })
    expect(obj.materialNames).toEqual(['Steel', 'Glass'])
    const glb = parseAssetImport('decor.glb', fixture('solid-box.glb'), 'solid-2', {})
    expect(glb.node.kind).toBe('solid')
  })

  it('белгісіз пішімге, OBJ бірлігіне және бұрыс DXF-ке анық қате береді', () => {
    expect(() => parseAssetImport('mesh.stl', new Uint8Array(), 'x', {})).toThrow(/dxf|obj|glb/i)
    expect(() => parseAssetImport('stove.obj', fixture('solid-box.obj'), 'x', {})).toThrow(/mmPerUnit/)
    expect(() => parseAssetImport('bad.dxf', new TextEncoder().encode('broken'), 'x', { materialId })).toThrow()
  })
})
