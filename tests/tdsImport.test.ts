import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTdsSolid } from '../lib/meshImport'
import { validateTdsBytes } from '../src/core/import/tds'

const fixture = new Uint8Array(readFileSync(new URL('./fixtures/3ds/own-tetra.3ds', import.meta.url)))

describe('3DS import through TDSLoader', () => {
  it('reads a small self-authored mesh, scales units to whole millimetres and keeps it decorative', () => {
    const result = parseTdsSolid(fixture, { id: 'tds-1', name: 'Тетраэдр', mmPerUnit: 10 })
    expect(result.node.solid.size).toEqual({ x: 10, y: 20, z: 30 })
    expect(result.node.solid.importedModel).toMatchObject({ format: '3ds', mmPerUnit: 10 })
    expect(result.node.solid).not.toHaveProperty('fabrication')
  })

  it('rejects corrupt and oversized files before invoking the loader', () => {
    expect(() => validateTdsBytes(new Uint8Array([0, 1, 2, 3]))).toThrow(/3ds/i)
    expect(() => validateTdsBytes(new Uint8Array(2 * 1024 * 1024 + 1))).toThrow(/size/i)
    const broken = fixture.slice(); broken[2] = 0
    expect(() => validateTdsBytes(broken)).toThrow(/length/i)
  })
})
