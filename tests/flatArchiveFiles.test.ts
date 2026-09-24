import { describe, expect, it } from 'vitest'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { flattenTree, IDENTITY_TRANSFORM, ORIENT_HORIZONTAL, parseProjectV4 } from '../src/core/index'
import { cabinetToDxfFiles } from '../src/core/export/dxf'
import { flatArchiveFiles } from '../lib/flatArchiveFiles'
import { catalog, referenceProject } from './fixtures'

describe('downloaded DXF ZIP paths', () => {
  it('keeps untrusted node IDs inside the intended folder without filename collisions', () => {
    const file = parseProjectV4(referenceProject)
    const ids = ['../../../escaped', '..%2F..%2F..%2Fescaped', 'C:\\escaped', 'normal']
    file.root.children = ids.map((id) => ({
      kind: 'board', id, name: id, transform: IDENTITY_TRANSFORM,
      board: { materialId: catalog.materials[0]!.id, length: 600, width: 400,
        orientation: ORIENT_HORIZONTAL, role: 'custom', grainAlongLength: false,
        edges: { L1: null, L2: null, W1: null, W2: null } },
    }))
    const panels = flattenTree(file.root, catalog).nodes.flatMap((node) => node.panels)
    const source = cabinetToDxfFiles(panels)
    const entries = Object.fromEntries([...flatArchiveFiles(source)].map(([name, content]) =>
      [`detali/${name}`, strToU8(content)]))
    const extracted = unzipSync(zipSync(entries))
    expect(Object.keys(extracted)).toHaveLength(ids.length)
    for (const [name, content] of source) {
      const path = `detali/${encodeURIComponent(name)}`
      expect(extracted[path]).toEqual(strToU8(content))
      expect(path.split('/')).toHaveLength(2)
      expect(path).not.toContain('\\')
    }
    expect(extracted['detali/normal.dxf']).toBeDefined()
    expect(extracted['detali/../../../escaped.dxf']).toBeUndefined()
  })
})
