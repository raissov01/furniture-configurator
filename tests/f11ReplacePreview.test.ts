import { describe, expect, it } from 'vitest'
import { catalogOf, defaultShopProfile, findTemplate, IDENTITY_TRANSFORM, templateToCabinet } from '../src/core/index'
import type { GroupNode } from '../src/core/index'
import { buildMaterialPreview, canApplyMaterialPreview } from '../lib/f11ReplacePreview'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const oldId = 'ldsp16-h1145'
const projectOnly = { ...catalog.materials.find((item) => item.id === oldId)!, id: 'project-only', pricePerSheet: 9900000 }
const projectCatalog = { ...catalog, materials: [...catalog.materials, projectOnly] }
const cabinet = { ...templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog), id: 'a', carcassMaterialId: oldId }
const root: GroupNode = { kind: 'group', id: 'root', name: 'Жоба', transform: IDENTITY_TRANSFORM, children: [
  { kind: 'cabinet', id: 'a', name: 'Шкаф', transform: IDENTITY_TRANSFORM, config: cabinet },
  { kind: 'board', id: 'board', name: 'Тақта', transform: IDENTITY_TRANSFORM, board: {
    materialId: oldId, length: 500, width: 300, role: 'shelf',
    orientation: { length: 'x', width: 'z', thickness: 'y' },
    edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: false,
  } },
] }

describe('F11 UI ауыстыру болжамы', () => {
  it('жоба каталогын, параметрін және еркін тақтаны есепке алады', () => {
    const preview = buildMaterialPreview({ root, catalog: projectCatalog, shop,
      oldMaterialId: oldId, newMaterialId: projectOnly.id, scope: { kind: 'all' }, settings: { shelfGap: 10 } })
    expect(preview?.affectedBoardIds).toEqual(['board'])
    expect(preview?.totalPanels).toBeGreaterThan(1)
    expect(preview?.priceDiff).toBeGreaterThan(0)
    expect(canApplyMaterialPreview(preview)).toBe(true)
  })

  it('ауқым таңдалмаған кезде болжам да, қолдану да жоқ', () => {
    const preview = buildMaterialPreview({ root, catalog: projectCatalog, shop,
      oldMaterialId: oldId, newMaterialId: projectOnly.id, scope: { kind: 'cabinets', cabinetIds: [] } })
    expect(preview).toBeNull()
    expect(canApplyMaterialPreview(preview)).toBe(false)
  })
})
