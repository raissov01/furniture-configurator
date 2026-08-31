/**
 * Планкалар, фальш-панель және фартук.
 *
 * Бұл детальдардың бәрі БІРДЕЙ көрінеді — тар тіктөртбұрыш. Сондықтан
 * қателікті көзбен байқау қиын: планка корпустың ішінде тұрғанын, фальш-панель
 * жанында тұрғанын, ал фартук столешницаның ҮСТІНДЕ тұрғанын тек координата
 * дәлелдейді.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  defaultShopProfile,
  findTemplate,
  formatCutList,
  generateCabinet,
  nestPanels,
  parseProject,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel, Rail } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

const t = catalog.materials.find((m) => m.id === base.carcassMaterialId)!.thickness

const rail = (patch: Partial<Rail> = {}): Rail => ({
  id: 'r1',
  kind: 'carcass',
  position: 'top',
  width: 100,
  inset: 0,
  depthOffset: 0,
  ...patch,
})

const withRails = (rails: Rail[], patch: Partial<CabinetConfig> = {}): CabinetConfig =>
  ({ ...base, ...patch, rails })

const railsOf = (panels: Panel[]) => panels.filter((p) => p.role === 'rail')
const byId = (panels: Panel[], id: string) => panels.find((p) => p.id === id)!

// ── Корпустық планка (царга) ─────────────────────────────────────────────────

describe('корпустық планка', () => {
  it('жоғарғы царга бүйірлердің АРАСЫНДА тұрады', () => {
    const panels = generateCabinet(withRails([rail({ position: 'top' })]), catalog)
    const p = byId(panels, 'rail-r1')
    expect(p.finishedLength).toBe(base.width - 2 * t)
    expect(p.finishedWidth).toBe(100)
    expect(p.position.x).toBe(t)
  })

  it('царганың ҮСТІҢГІ беті корпустың деңгейімен беттеседі', () => {
    const panels = generateCabinet(withRails([rail({ position: 'top' })]), catalog)
    // Крышканың орнында тұрғандықтан, y = H − t.
    expect(byId(panels, 'rail-r1').position.y).toBe(base.height - t)
  })

  it('төменгі царга еденнің деңгейінде', () => {
    const panels = generateCabinet(withRails([rail({ position: 'bottom' })]), catalog)
    expect(byId(panels, 'rail-r1').position.y).toBe(0)
  })

  it('тік царга бүйірге тіреледі, биіктігі ішкі саңылау', () => {
    const panels = generateCabinet(withRails([rail({ position: 'left' })]), catalog)
    const p = byId(panels, 'rail-r1')
    expect(p.finishedLength).toBe(base.height - 2 * t)
    expect(p.position.x).toBe(t)
  })

  it('depthOffset тереңдікке жылжытады', () => {
    const panels = generateCabinet(withRails([rail({ depthOffset: 40 })]), catalog)
    expect(byId(panels, 'rail-r1').position.z).toBe(40)
  })

  it('inset екі жағынан да қысқартады', () => {
    const panels = generateCabinet(withRails([rail({ inset: 30 })]), catalog)
    expect(byId(panels, 'rail-r1').finishedLength).toBe(base.width - 2 * t - 60)
  })

  it('шегініс тым үлкен болса — ҚАТЕ, үнсіз теріс ұзындық емес', () => {
    expect(() => generateCabinet(withRails([rail({ inset: 400 })]), catalog)).toThrow()
  })

  it('тым тар планка — ҚАТЕ', () => {
    expect(() => generateCabinet(withRails([rail({ width: 5 })]), catalog)).toThrow()
  })

  it('царганың нақты ені (80–120 мм) қабылданады', () => {
    // Корпустың ең кіші габариті (100 мм) мұнда жарамайды: царга одан тар.
    for (const w of [20, 60, 80, 120]) {
      expect(() => generateCabinet(withRails([rail({ width: w })]), catalog), `${w} мм`).not.toThrow()
    }
  })
})

// ── Фасадтық планка ──────────────────────────────────────────────────────────

describe('фасадтық планка', () => {
  it('корпустың АЛДЫНДА тұрады (z < 0)', () => {
    const panels = generateCabinet(withRails([rail({ kind: 'facade' })]), catalog)
    expect(byId(panels, 'rail-r1').position.z).toBeLessThan(0)
  })

  it('әдепкі материалы ФАСАДТІКІ, корпустікі емес', () => {
    const panels = generateCabinet(withRails([rail({ kind: 'facade' })]), catalog)
    expect(byId(panels, 'rail-r1').materialId).toBe(base.frontMaterialId)
  })

  it('корпустық планканың материалы КОРПУСТІКІ', () => {
    const panels = generateCabinet(withRails([rail({ kind: 'carcass' })]), catalog)
    expect(byId(panels, 'rail-r1').materialId).toBe(base.carcassMaterialId)
  })

  it('материал айқын берілсе — сол алынады', () => {
    const other = catalog.materials.find((m) => m.id !== base.carcassMaterialId && m.thickness >= 10)!
    const panels = generateCabinet(withRails([rail({ materialId: other.id })]), catalog)
    expect(byId(panels, 'rail-r1').materialId).toBe(other.id)
  })
})

// ── Фальш-панель ─────────────────────────────────────────────────────────────

describe('фальш-панель', () => {
  it('корпустың СЫРТЫНДА тұрады', () => {
    const left = generateCabinet(withRails([rail({ kind: 'filler', position: 'left', width: 80 })]), catalog)
    expect(byId(left, 'rail-r1').position.x).toBe(-80)

    const right = generateCabinet(withRails([rail({ kind: 'filler', position: 'right', width: 80 })]), catalog)
    expect(byId(right, 'rail-r1').position.x).toBe(base.width)
  })

  it('биіктігі корпустың биіктігіне тең', () => {
    const panels = generateCabinet(withRails([rail({ kind: 'filler', position: 'left' })]), catalog)
    expect(byId(panels, 'rail-r1').finishedLength).toBe(base.height)
  })

  it('жоғары-төмен қоюға БОЛМАЙДЫ — қате шығады', () => {
    // Фальш-панель саңылауды ЖАНЫНАН жабады; үстіне қою мағынасыз.
    expect(() =>
      generateCabinet(withRails([rail({ kind: 'filler', position: 'top' })]), catalog),
    ).toThrow(/left\/right/)
  })
})

// ── Фартук ───────────────────────────────────────────────────────────────────

describe('фартук', () => {
  it('корпустың ҮСТІНДЕ, қабырғаға тақалып тұрады', () => {
    const panels = generateCabinet({ ...base, backsplash: { height: 600 } }, catalog)
    const p = byId(panels, 'backsplash')
    expect(p.finishedLength).toBe(600)
    expect(p.finishedWidth).toBe(base.width)
    expect(p.position.y).toBe(base.height)
    // Артқы жиекте: z + қалыңдық = тереңдік.
    const mat = catalog.materials.find((m) => m.id === p.materialId)!
    expect(p.position.z + mat.thickness).toBe(base.depth)
  })

  it('столешница болса, фартук СОНЫҢ ҮСТІНЕ көтеріледі', () => {
    const cfg: CabinetConfig = {
      ...base,
      worktop: { overhangFront: 20, overhangSides: 0 },
      backsplash: { height: 600 },
    }
    const panels = generateCabinet(cfg, catalog)
    const worktopThickness = catalog.materials.find((m) => m.id === base.carcassMaterialId)!.thickness
    expect(byId(panels, 'backsplash').position.y).toBe(base.height + worktopThickness)
  })

  it('тым аласа фартук — ҚАТЕ', () => {
    expect(() => generateCabinet({ ...base, backsplash: { height: 10 } }, catalog)).toThrow()
  })
})

// ── Жүйемен байланысы ────────────────────────────────────────────────────────

describe('жүйенің қалған бөлігі', () => {
  const cfg = withRails(
    [
      rail({ id: 'a', position: 'top' }),
      rail({ id: 'b', position: 'bottom' }),
      rail({ id: 'c', kind: 'filler', position: 'left', width: 60 }),
    ],
    { backsplash: { height: 600 } },
  )
  const panels = generateCabinet(cfg, catalog)

  it('бәрі деталировкаға түседі', () => {
    expect(railsOf(panels)).toHaveLength(4) // 3 планка + фартук
    const rows = formatCutList(panels, catalog)
    expect(rows.some((r) => r.name.includes('Планка'))).toBe(true)
    expect(rows.some((r) => r.name.includes('Фальш-панель'))).toBe(true)
    expect(rows.some((r) => r.name.includes('Фартук'))).toBe(true)
  })

  it('раскройға да түседі — параққа сыяды', () => {
    const nesting = nestPanels(panels, catalog)
    expect(nesting.unplaced).toHaveLength(0)
  })

  it('id-лері бірегей: DXF архивінде файл бірін-бірі баспайды', () => {
    const ids = panels.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('жоба сақталып, қайта ашылады', () => {
    const project = {
      schemaVersion: 3 as const,
      name: 'Тест',
      materials: catalog.materials,
      edgeBands: catalog.edgeBands,
      cabinets: [cfg],
      room: { width: 4000, depth: 3000, height: 2700 },
      placements: [],
    }
    const parsed = parseProject(project)
    expect(parsed.cabinets[0]!.rails).toHaveLength(3)
    expect(parsed.cabinets[0]!.backsplash?.height).toBe(600)
  })
})
