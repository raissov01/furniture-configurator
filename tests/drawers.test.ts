/**
 * Ящиктер мен тік жолақтар (D1).
 *
 * Ящик — жиһаздың жартысы: онсыз комод та, тумба да, ящикті кухня да
 * жасалмайды. Мұнда тексерілетін басты нәрсе — қораптың өлшемі НАПРАВЛЯЮЩАҒА
 * орын қалдырып шығуы, әрі фасадтардың бір-бірін жаппауы.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, generateCabinet } from '../src/core/index'
import type { Panel } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, withCabinet } from './fixtures'

const drawerCabinet = (count: number, extra = {}) =>
  withCabinet({
    height: 850, width: 800, depth: 500,
    sections: [{
      id: 's1', widthMode: 'flex',
      contents: [{ kind: 'drawers', count }],
      fronts: null,
      ...extra,
    }],
  })

const panelsOf = (count: number, extra = {}) => generateCabinet(drawerCabinet(count, extra), catalog)

describe('ящик', () => {
  const panels = panelsOf(3)
  const byRole = (role: string) => panels.filter((p: Panel) => p.role === role)

  it('бір ящик = фасад + 2 бүйір + алды + арты + түбі', () => {
    expect(byRole('front')).toHaveLength(3)
    expect(byRole('drawerSide')).toHaveLength(6)
    expect(byRole('drawerBack')).toHaveLength(6)
    expect(byRole('drawerBottom')).toHaveLength(3)
  })

  it('қорап направляющаға екі жағынан орын қалдырады', () => {
    const cabinet = drawerCabinet(3)
    const innerWidth = cabinet.width - 2 * T
    const back = byRole('drawerBack')[0]!
    // Қораптың сыртқы ені = ішкі ен − 2 × зазор.
    const boxWidth = innerWidth - 2 * DEFAULT_SETTINGS.drawerRunnerGap
    // Алды мен арты бүйірлердің АРАСЫНА кіреді. Тік панельдің келісімі
    // бойынша ұзындығы — биіктік, ені — көлденең өлшем.
    expect(back.finishedWidth).toBe(boxWidth - 2 * T)
  })

  it('қораптың бүйірі фасадтан төмен — үстінен қол салуға орын қалады', () => {
    const front = byRole('front')[0]!
    const side = byRole('drawerSide')[0]!
    // Боковинаның ұзындығы — биіктігі (корпус боковинасындағыдай).
    expect(side.finishedLength).toBe(front.finishedLength - DEFAULT_SETTINGS.drawerBoxDrop)
    // Ені — тереңдігі, ол әрқашан биіктіктен үлкен.
    expect(side.finishedWidth).toBeGreaterThan(side.finishedLength)
  })

  it('панельдердің 3D ӨЛШЕМІ орнымен сәйкес: қорап корпустан шықпайды', () => {
    const cabinet = drawerCabinet(3)
    for (const panel of panels) {
      const thickness = catalog.materials.find((m) => m.id === panel.materialId)!.thickness
      const e = {
        x: panel.orientation.length === 'x' ? panel.finishedLength
          : panel.orientation.width === 'x' ? panel.finishedWidth : thickness,
        z: panel.orientation.length === 'z' ? panel.finishedLength
          : panel.orientation.width === 'z' ? panel.finishedWidth : thickness,
      }
      // Фасад корпустың алдында тұр, сондықтан оның z-і теріс — тек ені мен
      // тереңдігін тексереміз.
      expect(panel.position.x, panel.id).toBeGreaterThanOrEqual(0)
      expect(panel.position.x + e.x, panel.id).toBeLessThanOrEqual(cabinet.width + 0.001)
      expect(panel.position.z + e.z, panel.id).toBeLessThanOrEqual(cabinet.depth + 0.001)
    }
  })

  /**
   * ⚠ 2026-09-02-де ӨЗГЕРДІ: түбі 3 мм ХДФ-тан 16 мм ЛДСП-ға көшті
   * (qdesign-нің схемасы). Себебі: ХДФ түп буынға қатыспайтын да, қорапты
   * тек төрт қабырға ұстайтын. Енді түп те жүктеме көтереді — оған минификс
   * пен конфирмат бұрғыланады.
   */
  it('түбі КОРПУС материалынан, бүйірлердің арасында', () => {
    const bottom = byRole('drawerBottom')[0]!
    const side = byRole('drawerSide')[0]!
    expect(bottom.materialId).toBe(side.materialId)
    const material = catalog.materials.find((m) => m.id === bottom.materialId)!
    expect(material.thickness).toBeGreaterThanOrEqual(16)
    // Бүйірлердің арасында: түптің ені қораптың енінен екі қалыңдыққа кіші.
    expect(bottom.finishedLength).toBe(byRole('drawerBack')[0]!.finishedWidth)
  })

  it('фасадтар бірдей әрі бір-бірін жаппайды', () => {
    const fronts = byRole('front').sort((a, b) => a.position.y - b.position.y)
    const heights = new Set(fronts.map((f) => f.finishedLength))
    expect(heights.size).toBe(1)
    for (let i = 1; i < fronts.length; i += 1) {
      const prev = fronts[i - 1]!
      expect(fronts[i]!.position.y).toBeGreaterThanOrEqual(prev.position.y + prev.finishedLength)
    }
  })

  it('ящик тым көп болса — түсінікті қате', () => {
    expect(() => panelsOf(8)).toThrow(/фасад/)
    expect(() => panelsOf(0)).toThrow(/1\.\.8/)
  })
})

describe('ящик пен ілмелі фасад бір секцияда', () => {
  const panels = generateCabinet(
    withCabinet({
      height: 2000, width: 600, depth: 450,
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [
          { kind: 'drawers', count: 2, height: 600 },
          { kind: 'shelves', count: 2, shelfKind: 'adjustable' },
        ],
        fronts: { count: 1, mount: 'overlay' },
      }],
    }),
    catalog,
  )

  it('ілмелі фасад ящиктердің ҮСТІНЕН басталады', () => {
    const fronts = panels.filter((p: Panel) => p.role === 'front')
    const drawerFronts = fronts.filter((f) => f.label.includes('ящика'))
    const hinged = fronts.filter((f) => !f.label.includes('ящика'))
    expect(drawerFronts).toHaveLength(2)
    expect(hinged).toHaveLength(1)
    const topDrawer = Math.max(...drawerFronts.map((f) => f.position.y + f.finishedLength))
    expect(hinged[0]!.position.y).toBeGreaterThanOrEqual(topDrawer)
  })

  it('жолақтар арасында бекітілген сөре тұрады', () => {
    const dividers = panels.filter((p: Panel) => p.role === 'shelf' && p.note.includes('Разделитель'))
    expect(dividers).toHaveLength(1)
  })
})

describe('панель id-лері', () => {
  /**
   * id — экспорттың КІЛТІ: DXF архивінде әр деталь өз атымен жатады. Екі
   * панельдің id-і бірдей болса, бір файл екіншісін үнсіз басып кетеді де,
   * цехқа жетпеген деталь тек жинау кезінде байқалады.
   */
  it('әр шаблонда id-лер БІРЕГЕЙ', async () => {
    const { SEED_TEMPLATES, SEED_CATALOG, templateToCabinet } = await import('../src/core/index')
    for (const template of SEED_TEMPLATES) {
      const generated = generateCabinet(templateToCabinet(template, SEED_CATALOG), SEED_CATALOG)
      const ids = generated.map((p: Panel) => p.id)
      const seen = new Set(ids)
      expect(seen.size, `${template.id}: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')}`)
        .toBe(ids.length)
    }
  })
})
