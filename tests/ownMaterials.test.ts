import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASIS_MATERIALS, OWN_CATALOG, ownCatalogBuild, parseProjectV4, projectFingerprint, SEED_CATALOG } from '../src/core/index'
import {
  buildLegacyMaterialAliases, LEGACY_MATERIAL_ALIASES, migrateLegacyProjectMaterials, validateSupplementalCatalog,
} from '../src/core/data/catalog/materials'
import type { SupplementalBoard, SupplementalEdge } from '../src/core/data/catalog/materials'

const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../src/core/data/catalog/input/lite/${name}`, import.meta.url), 'utf8')) as T
const boards = read<SupplementalBoard[]>('materials.json')
const edges = read<SupplementalEdge[]>('edges.json')

describe('қосымша ашық материал дерегі', () => {
  it('толық кіріс валидті, бос өлшем жарияланбаған ретінде сақталады', () => {
    expect(validateSupplementalCatalog(boards, edges)).toEqual([])
    expect(boards.some((row) => row.thicknesses.length === 0 && row.sheetSizes.length === 0)).toBe(true)
  })

  it('дубль, бос код, қалыңдық және парақ өлшемі қатесін нақты өріспен қайтарады', () => {
    const first = boards.find((row) => row.thicknesses.length > 0)!
    const bad = [first, { ...first }, { ...first, decorCode: ' ' },
      { ...first, decorCode: 'BAD', thicknesses: [16.5], sheetSizes: [[900, 2070]] as [number, number][] }]
    const paths = validateSupplementalCatalog(bad, []).map((x) => x.path)
    expect(paths).toContain('materials[1].decorCode')
    expect(paths).toContain('materials[2].decorCode')
    expect(paths).toContain('materials[3].thicknesses[0]')
    expect(paths).toContain('materials[3].sheetSizes[0][0]')
  })

  it('кромка сілтемесі тек бар плита декорына өтуі тиіс', () => {
    const linked = edges.find((row) => row.matchingBoardDecorCodes.length > 0)!
    const changed = { ...linked, matchingBoardDecorCodes: ['DOES-NOT-EXIST'] }
    expect(validateSupplementalCatalog(boards, [changed]).map((x) => x.path))
      .toContain('edges[0].matchingBoardDecorCodes[0]')
  })
})

describe('ескі материал id көшуі', () => {
  const built = ownCatalogBuild()
  const aliases = buildLegacyMaterialAliases(boards, BASIS_MATERIALS, OWN_CATALOG.materials, built.materialMeta)

  it('сәйкес декор, құрылым, қалыңдық пен парақтағы Базис id-ді байлайды', () => {
    expect(Object.keys(aliases).length).toBeGreaterThan(100)
    expect(LEGACY_MATERIAL_ALIASES).toEqual(aliases)
    const id = 'basis-ldsp-LDSP-16-H1145-ST10'
    expect(aliases[id]).toMatch(/^own-ldsp-egger-h1145-st10-.*-16-2800x2070$/)
    expect(aliases['basis-ldsp-unknown']).toBeUndefined()
  })

  it('жоба конфигі мен еркін тақта сілтемесін көшіреді, тапсырыс берушінің Базис каталогы қалады', () => {
    const oldId = 'basis-ldsp-LDSP-16-H1145-ST10'
    const material = BASIS_MATERIALS.find((m) => m.id === oldId)!
    const targetId = aliases[oldId]!
    const raw = {
      schemaVersion: 4, name: 'Ескі жоба', materials: [material], edgeBands: [],
      room: { width: 4000, depth: 3000, height: 2700 }, lights: [],
      root: { kind: 'group', id: 'root', name: 'root', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
        children: [{ kind: 'board', id: 'board', name: 'Тақта', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
          board: { materialId: oldId, length: 600, width: 300, orientation: { length: 'x', width: 'z', thickness: 'y' },
            edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false, role: 'custom' } }] },
    }
    const migrated = migrateLegacyProjectMaterials(raw, aliases)
    expect(migrated.materials[0]!.id).toBe(targetId)
    expect(migrated.root.children[0]!.board.materialId).toBe(targetId)
    expect(raw.materials[0]!.id).toBe(oldId)
    expect(BASIS_MATERIALS.some((m) => m.id === oldId)).toBe(true)
    expect(parseProjectV4(raw).materials[0]?.id).toBe(targetId)
  })

  it('өлшемі не бағасы өзгерген жеке материалды автоматты алмастырмайды', () => {
    const oldId = 'basis-ldsp-LDSP-16-H1145-ST10'
    const material = BASIS_MATERIALS.find((m) => m.id === oldId)!
    const raw = { materials: [{ ...material, sheetWidth: 2750, pricePerSheet: 12345 }],
      root: { board: { materialId: oldId } } }
    expect(migrateLegacyProjectMaterials(raw, aliases)).toEqual(raw)
  })

  it('материалға байланған жолдық жеңілдік кілтін бірге көшіреді', () => {
    const oldId = 'basis-ldsp-LDSP-16-H1145-ST10'
    const material = BASIS_MATERIALS.find((m) => m.id === oldId)!
    const raw = { materials: [material], priceOverrides: { lineDiscounts: {
      [`materials:${oldId}`]: { kind: 'percent', value: 10 },
    } } }
    const migrated = migrateLegacyProjectMaterials(raw, aliases)
    expect(migrated.priceOverrides.lineDiscounts).toEqual({
      [`materials:${aliases[oldId]}`]: { kind: 'percent', value: 10 },
    })
  })

  it('келісімдегі ескі v4 материал ID-ін сақтап, fingerprint-ті өзгертпейді', async () => {
    const oldId = 'basis-ldsp-LDSP-16-H1145-ST10'
    const material = BASIS_MATERIALS.find((m) => m.id === oldId)!
    const raw = { schemaVersion: 4, name: 'Ескі келісім', materials: [material], edgeBands: [],
      room: { width: 4000, depth: 3000, height: 2700 }, lights: [], autoJoints: [],
      root: { kind: 'group', id: 'root', name: 'root', transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } }, children: [] },
      priceOverrides: { salePrice: 100_000, lineDiscounts: { [`materials:${oldId}`]: { kind: 'percent', value: 10 } } },
    }
    const before = parseProjectV4(raw, { migrateMaterials: false })
    const after = parseProjectV4(raw, { migrateMaterials: false })
    expect(after.materials[0]?.id).toBe(oldId)
    expect(await projectFingerprint(after)).toBe(await projectFingerprint(before))
  })
})
