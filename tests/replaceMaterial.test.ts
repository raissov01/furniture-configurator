/**
 * «Замена» — материалды жаппай ауыстыру (`src/core/replaceMaterial.ts`).
 * PRO100 паритиі: `docs/pro100/parity.md` §2.2 «Материалды жобада жаппай
 * ауыстыру» ❌ жоқ еді.
 */
import { describe, expect, it } from 'vitest'
import {
  ConfigValidationError,
  applyMaterialReplace,
  catalogOf,
  defaultShopProfile,
  findTemplate,
  generateCabinet,
  previewMaterialReplace,
  previewTreeMaterialReplace,
  flattenTree,
  scenePanels,
  replaceTreeMaterial,
  nestPanels,
  nestingOptionsOf,
  priceProject,
  IDENTITY_TRANSFORM,
  createDefaultLayer,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, GroupNode, ShopProfile } from '../src/core/index'

const shop: ShopProfile = defaultShopProfile()
const catalog = catalogOf(shop)

/** Бір декордың 16 мм және 18 мм нұсқасы (seed.ts) — қалыңдық ауысуын тексеруге. */
const OLD_MATERIAL = 'ldsp16-h1145'
const NEW_MATERIAL_SAME_THICKNESS = 'ldsp16-w980'
const NEW_MATERIAL_DIFFERENT_THICKNESS = 'ldsp18-h1145'

function baseCabinet(id: string): CabinetConfig {
  const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)
  return { ...cabinet, id, carcassMaterialId: OLD_MATERIAL }
}

describe('applyMaterialReplace', () => {
  it('тек scope-тағы корпустарды өзгертеді', () => {
    const a = baseCabinet('a')
    const b = baseCabinet('b')
    const next = applyMaterialReplace([a, b], OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, {
      kind: 'cabinets',
      cabinetIds: ['a'],
    })
    const na = next.find((c) => c.id === 'a')!
    const nb = next.find((c) => c.id === 'b')!
    expect(na.carcassMaterialId).toBe(NEW_MATERIAL_SAME_THICKNESS)
    expect(nb.carcassMaterialId).toBe(OLD_MATERIAL) // қамтылмаған корпус өзгермеуі керек
  })

  it('scope: all — барлық корпусты өзгертеді', () => {
    const a = baseCabinet('a')
    const b = baseCabinet('b')
    const next = applyMaterialReplace([a, b], OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' })
    expect(next.every((c) => c.carcassMaterialId === NEW_MATERIAL_SAME_THICKNESS)).toBe(true)
  })

  it('OLD_MATERIAL-мен сәйкес келмейтін өрістерге тимейді, тек сәйкес келгеніне', () => {
    const a = { ...baseCabinet('a'), frontMaterialId: 'ldsp16-u104' }
    expect(a.frontMaterialId).not.toBe(OLD_MATERIAL)
    const [next] = applyMaterialReplace([a], OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' })
    // frontMaterialId ескі carcass материалына тең болмағандықтан өзгермеуі керек
    expect(next!.frontMaterialId).toBe(a.frontMaterialId)
    expect(next!.carcassMaterialId).toBe(NEW_MATERIAL_SAME_THICKNESS)
  })

  it('басқа корпустың id-і секілді өрістерге тимейді (кілт атауы бойынша аралау)', () => {
    const a = baseCabinet('a')
    // Кабинеттің ӨЗ id-і кездейсоқ ескі материал id-мен сәйкес келсе де өзгермеуі керек.
    const weird = { ...a, id: OLD_MATERIAL }
    const [next] = applyMaterialReplace([weird], OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' })
    expect(next!.id).toBe(OLD_MATERIAL) // "id" кілті MATERIAL_ID_KEYS-те жоқ
    expect(next!.carcassMaterialId).toBe(NEW_MATERIAL_SAME_THICKNESS)
  })
})

describe('previewMaterialReplace — дұрыс детальдарды ғана қозғайды', () => {
  it('scope-тан тыс корпустың панельдері есепке кірмейді (affectedCabinetIds)', () => {
    const a = baseCabinet('a')
    const b = baseCabinet('b')
    const preview = previewMaterialReplace(
      [a, b], shop, OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'cabinets', cabinetIds: ['a'] },
    )
    expect(preview.affectedCabinetIds).toEqual(['a'])
    // Бір корпустың панель саны ғана totalPanels-та — эталон пенал 11 деталь (CLAUDE.md §8.7).
    const panelsOfA = generateCabinet(a, catalog)
    expect(preview.totalPanels).toBe(panelsOfA.length)
  })

  it('материал ауысқан панельдер саны 0-ден көп', () => {
    const a = baseCabinet('a')
    const preview = previewMaterialReplace(
      [a], shop, OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' },
    )
    expect(preview.changedPanels).toBeGreaterThan(0)
    expect(preview.changedPanels).toBeLessThanOrEqual(preview.totalPanels)
  })
})

describe('§4.3 — қалыңдығы басқа материалға ауысқанда рез өлшемі қайта есептеледі', () => {
  it('бірдей қалыңдықты материалға ауыстырғанда РЕЗ өлшемі өзгермейді', () => {
    const a = baseCabinet('a')
    const preview = previewMaterialReplace(
      [a], shop, OLD_MATERIAL, NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' },
    )
    expect(preview.cutSizeChanged).toBe(false)
  })

  it('16 мм → 18 мм ауысқанда көрші панельдердің РЕЗ өлшемі өзгереді', () => {
    const a = baseCabinet('a')
    const preview = previewMaterialReplace(
      [a], shop, OLD_MATERIAL, NEW_MATERIAL_DIFFERENT_THICKNESS, { kind: 'all' },
    )
    expect(preview.cutSizeChanged).toBe(true)

    // Нақты сан: дно/крышка ені W − 2·t формуласымен 4 мм-ге кішірейеді (18−16=2, екі жағынан).
    const before = generateCabinet(a, catalog)
    const [nextA] = applyMaterialReplace([a], OLD_MATERIAL, NEW_MATERIAL_DIFFERENT_THICKNESS, { kind: 'all' })
    const after = generateCabinet(nextA!, catalog)
    const bottomBefore = before.find((p) => p.id === 'bottom')!
    const bottomAfter = after.find((p) => p.id === 'bottom')!
    expect(bottomAfter.cutLength).toBe(bottomBefore.cutLength - 4)
  })
})

describe('баға айырмасы', () => {
  it('priceDiff = priceAfter − priceBefore, дәйекті есептеледі', () => {
    const pricedShop: ShopProfile = {
      ...shop,
      materials: shop.materials.map((m) => ({ ...m, pricePerSheet: 2850000 })),
      edgeBands: shop.edgeBands.map((b) => ({ ...b, pricePerMeter: 9000 })),
    }
    const a = baseCabinet('a')
    const preview = previewMaterialReplace(
      [a], pricedShop, OLD_MATERIAL, NEW_MATERIAL_DIFFERENT_THICKNESS, { kind: 'all' },
    )
    expect(preview.priceDiff).toBe(preview.priceAfter - preview.priceBefore)
  })
})

describe('жобада жоқ материалға ауыстыру', () => {
  it('newMaterialId каталогта болмаса — ConfigValidationError, өріс атымен', () => {
    const a = baseCabinet('a')
    try {
      previewMaterialReplace([a], shop, OLD_MATERIAL, 'material-that-does-not-exist', { kind: 'all' })
      expect.unreachable('ConfigValidationError лақтырылуы керек еді')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError)
      const e = err as InstanceType<typeof ConfigValidationError>
      expect(e.field).toBe('newMaterialId')
      expect(e.allowed).toBeTruthy()
    }
  })

  it('oldMaterialId каталогта болмаса — ConfigValidationError, өріс атымен', () => {
    const a = baseCabinet('a')
    try {
      previewMaterialReplace([a], shop, 'no-such-old-material', NEW_MATERIAL_SAME_THICKNESS, { kind: 'all' })
      expect.unreachable('ConfigValidationError лақтырылуы керек еді')
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError)
      const e = err as InstanceType<typeof ConfigValidationError>
      expect(e.field).toBe('oldMaterialId')
    }
  })
})

describe('канондық ағаштағы материал ауыстырудың алдын ала есебі', () => {
  const projectMaterial = { ...catalog.materials.find((m) => m.id === OLD_MATERIAL)!, id: 'project-only', pricePerSheet: 9900000 }
  const projectCatalog = { ...catalog, materials: [...catalog.materials, projectMaterial] }
  const cabinet = baseCabinet('a')
  const root: GroupNode = {
    kind: 'group', id: 'root', name: 'Жоба', transform: IDENTITY_TRANSFORM,
    children: [
      { kind: 'cabinet', id: 'a', name: 'Шкаф', transform: IDENTITY_TRANSFORM, config: cabinet },
      { kind: 'board', id: 'board', name: 'Еркін тақта', transform: IDENTITY_TRANSFORM,
        board: { materialId: OLD_MATERIAL, length: 500, width: 300, role: 'shelf',
          orientation: { length: 'x', width: 'z', thickness: 'y' },
          edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false } },
    ],
  }

  it('жоба каталогындағы материалды қабылдайды және еркін тақтаны санайды', () => {
    const preview = previewTreeMaterialReplace(root, projectCatalog, shop,
      OLD_MATERIAL, projectMaterial.id, { kind: 'all' }, { shelfGap: 10 })
    const before = scenePanels(flattenTree(root, projectCatalog, { shelfGap: 10 }))
    expect(preview.totalPanels).toBe(before.length)
    expect(preview.affectedBoardIds).toEqual(['board'])
    expect(preview.changedPanels).toBeGreaterThan(0)
    const afterRoot = replaceTreeMaterial(root, OLD_MATERIAL, projectMaterial.id)
    const after = scenePanels(flattenTree(afterRoot, projectCatalog, { shelfGap: 10 }))
    expect(after.find((p) => p.id === 'board')?.materialId).toBe(projectMaterial.id)
    const pricedShop = { ...shop, materials: projectCatalog.materials, edgeBands: projectCatalog.edgeBands }
    expect(preview.priceAfter).toBe(priceProject(after,
      nestPanels(after, projectCatalog, nestingOptionsOf(shop)), pricedShop).total)
  })

  it('жоба параметрімен генерацияланған деталь санын қолданады', () => {
    const preview = previewTreeMaterialReplace(root, projectCatalog, shop,
      OLD_MATERIAL, projectMaterial.id, { kind: 'all' }, { shelfGap: 10 })
    const expected = scenePanels(flattenTree(root, projectCatalog, { shelfGap: 10 }))
    expect(preview.totalPanels).toBe(expected.length)
    expect(() => previewTreeMaterialReplace(root, catalog, shop,
      OLD_MATERIAL, projectMaterial.id, { kind: 'all' })).toThrow(ConfigValidationError)
  })

  it('таңдалған шкаф ауқымында еркін тақтаны өзгертпейді', () => {
    const preview = previewTreeMaterialReplace(root, projectCatalog, shop,
      OLD_MATERIAL, projectMaterial.id, { kind: 'cabinets', cabinetIds: ['a'] })
    expect(preview.affectedCabinetIds).toEqual(['a'])
    expect(preview.affectedBoardIds).toEqual([])
    expect(preview.totalPanels).toBe(flattenTree(root, projectCatalog).nodes.find((node) => node.nodeId === 'a')!.panels.length)
  })

  it('жасырын қабаттағы детальдарды өндірістік санаққа қоспайды', () => {
    const layeredRoot: GroupNode = { ...root, children: root.children.map((node) =>
      node.id === 'board' ? { ...node, layerId: 'hidden' } : node) }
    const layers = [createDefaultLayer(), { id: 'hidden', name: 'Жасырын', visible: false, locked: false, color: '#000000' }]
    const preview = previewTreeMaterialReplace(layeredRoot, projectCatalog, shop,
      OLD_MATERIAL, projectMaterial.id, { kind: 'all' }, shop.settings, layers)
    expect(preview.affectedBoardIds).toEqual([])
    expect(preview.totalPanels).toBe(flattenTree(layeredRoot, projectCatalog, shop.settings, layers).nodes[0]!.panels.length)
  })
})
