import { describe, expect, it } from 'vitest'
import {
  SEED_TEMPLATES, catalogOf, defaultShopProfile, generateCabinet, templateToCabinet,
} from '../src/core/index'
import { panelExtents } from '../src/core/geometry'
import type { Panel } from '../src/core/types'

/*
 * Перегородка — ЕКІ секцияның шегі (`boundsOf`): i-ші секцияның оң шегі де,
 * i+1-ші секцияның сол шегі де сол бір панель. Сөре тесіктері мен
 * направляющая тесіктері әрқашан 'inner'-ге жазылатын кезде, көрші екі
 * секцияның тесіктері бір бетке, бір координатаға түсіп қосарланатын
 * (8 шаблонда сөре, chest-wide-1200-де направляющая). Ілгек планкасындағы
 * §R4 ақауымен бір түбір.
 */
const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const generate = (id: string): Panel[] => {
  const template = SEED_TEMPLATES.find((item) => item.id === id)
  if (!template) throw new Error(`missing template ${id}`)
  return generateCabinet(templateToCabinet(template, catalog), catalog, shop.settings)
}

describe('перегородканың екі бетіндегі сөре/направляющая тесіктері', () => {
  it('ешбір seed шаблонда бір панельде бірдей тесік қайталанбайды', () => {
    const duplicates: string[] = []
    for (const template of SEED_TEMPLATES) {
      for (const panel of generate(template.id)) {
        const seen = new Set<string>()
        for (const drill of panel.drilling) {
          const key = JSON.stringify(drill)
          if (seen.has(key)) duplicates.push(`${template.id}:${panel.id}:${drill.purpose}`)
          seen.add(key)
        }
      }
    }
    expect([...new Set(duplicates)]).toEqual([])
  })

  it('bookcase-2sec-1200: сол секцияның сөре тесіктері outer-де, оң секциянікі inner-де', () => {
    const panels = generate('bookcase-2sec-1200')
    const divider = panels.find((panel) => panel.id === 'divider-1')!
    const pins = divider.drilling.filter((drill) => drill.purpose === 'shelfPin')
    const inner = pins.filter((drill) => drill.face === 'inner')
    const outer = pins.filter((drill) => drill.face === 'outer')
    // Екі секцияда сөре саны бірдей → екі бетте тесік саны да бірдей.
    expect(inner.length).toBeGreaterThan(0)
    expect(outer).toHaveLength(inner.length)
  })

  it('chest-wide-1200: перегородкадағы направляющая тесіктері екі бетке бөлінеді', () => {
    const divider = generate('chest-wide-1200').find((panel) => panel.id === 'divider-1')!
    const runners = divider.drilling.filter((drill) => drill.purpose === 'runner')
    expect(runners.some((drill) => drill.face === 'inner')).toBe(true)
    expect(runners.some((drill) => drill.face === 'outer')).toBe(true)
  })

  it('side-right-тың сөре/направляющая тесіктері корпус ішіне қарайтын outer бетке түседі', () => {
    // ORIENT_SIDE: thickness = x, side-right [W − t, W] аралығында — оның
    // +қалыңдық (inner) беті корпустың СЫРТЫ. Ілгек планкасы бұрыннан outer.
    for (const id of ['wardrobe-penal-600', 'chest-800']) {
      const panels = generate(id)
      const left = panels.find((panel) => panel.id === 'side-left')!
      const right = panels.find((panel) => panel.id === 'side-right')!
      const holes = (panel: Panel) => panel.drilling
        .filter((drill) => drill.purpose === 'shelfPin' || drill.purpose === 'runner')
      expect(holes(right).length).toBeGreaterThan(0)
      expect(new Set(holes(left).map((drill) => drill.face))).toEqual(new Set(['inner']))
      expect(new Set(holes(right).map((drill) => drill.face))).toEqual(new Set(['outer']))
    }
  })
})

/*
 * §8 (айна жұп панельдер). side-left пен side-right — ЕКЕУІ де ORIENT_SIDE,
 * канондық кадры бірдей (x — биіктік W1→W2, y — тереңдік L1→L2), айналған
 * емес; сондықтан жаһандық бір `outerFlipAxis` екеуіне де бірдей жүреді.
 * Бұзылатын жалғыз нәрсе — БЕТ белгісі: соқыр тесік физикалық түрде
 * қорап/корпус ішіне қарауы тиіс, ал inner = +қалыңдық жағы.
 */
describe('соқыр тесік корпус/ящик қорабының ішіне қарайды', () => {
  const BOX = /^(.*)-(wall-front|wall-back|side-l|side-r|bottom)$/
  it.each(SEED_TEMPLATES.map((template) => template.id))('%s', (id) => {
    const panels = generate(id)
    const th = (panel: Panel) => catalog.materials.find((m) => m.id === panel.materialId)!.thickness
    const groupOf = (panel: Panel): Panel[] | null => {
      if (panel.id === 'side-left' || panel.id === 'side-right') {
        return panels.filter((p) => ['side-left', 'side-right', 'bottom'].includes(p.id))
      }
      const match = BOX.exec(panel.id)
      if (!match || !panels.some((p) => p.id === `${match[1]}-side-l`)) return null
      return panels.filter((p) => p.id.startsWith(`${match[1]}-`) && BOX.test(p.id))
    }
    const wrong: string[] = []
    for (const panel of panels) {
      const group = groupOf(panel)
      if (!group) continue
      const axis = panel.orientation.thickness
      const lo = Math.min(...group.map((p) => p.position[axis]))
      const hi = Math.max(...group.map((p) => p.position[axis] + panelExtents(p, th(p))[axis]))
      const centre = (lo + hi) / 2
      for (const drill of panel.drilling) {
        if (drill.face !== 'inner' && drill.face !== 'outer') continue
        if (drill.depth >= th(panel)) continue
        const faceAt = drill.face === 'inner' ? panel.position[axis] + th(panel) : panel.position[axis]
        const towardCentre = drill.face === 'inner' ? centre > faceAt : centre < faceAt
        if (!towardCentre) wrong.push(`${panel.id}:${drill.purpose}:${drill.face}`)
      }
    }
    expect([...new Set(wrong)]).toEqual([])
  })
})
