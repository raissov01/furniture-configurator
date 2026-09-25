/**
 * K6 / audit C4 (docs/audit/corner-2026-09-20.md §C4,
 * docs/audit/drilling-fix-plan.md K6).
 *
 * Соқыр панельді бұрыштық тумбада (генератор шығаратын ЕҢ ЖИІ бұрыштық
 * модуль — «Мойка угловая», `kitchen.ts` `CORNER_SINK_WIDTH`) фасадтың
 * ілгек планкасы `openingInset` ескерместен ӘРҚАШАН `side-left`/
 * `side-right`-қа бұрғыланады — тіпті есік одан алшақ, соқыр панельдің
 * АРТЫНДА тұрса да (`carcassPanel` таңдауы `generateCabinet.ts`-тегі
 * `boundsOf`-тан келеді, `frontPanel`-ді мүлде ескермейді).
 *
 * Нақты жиһазда есікті іліп қоятын ешнәрсе жоқ: соқыр панельдің АРТЫНДА
 * тұратын ТІК СТОЙКА керек, планка соған ілінуі керек — бұл тест дәл
 * осыны талап етеді.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const cabinet = (extra: Partial<CabinetConfig> = {}): CabinetConfig => withCabinet({
  height: 800, width: 800, depth: 500,
  sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{ kind: 'shelves', count: 1, shelfKind: 'adjustable' }],
    fronts: { count: 1, mount: 'overlay' },
  }],
  ...extra,
})

const gen = (extra: Partial<CabinetConfig> = {}) => generateCabinet(cabinet(extra), catalog)

const hingePlatePanels = (panels: Panel[]): Panel[] =>
  panels.filter((p) => p.role !== 'front' && p.drilling.some((d) => d.purpose === 'hinge'))

describe('соқыр панельдің ілгек планкасы (K6 / audit C4)', () => {
  it.each([
    ['left', 'adjustable'], ['right', 'adjustable'],
    ['left', 'fixed'], ['right', 'fixed'],
  ] as const)('%s жақтағы %s сөре тірекпен қиылыспайды және оған бұрғыланады', (side, shelfKind) => {
    const panels = gen({
      frontPanel: { width: 120, side },
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'shelves', count: 1, shelfKind }],
        fronts: { count: 1, mount: 'overlay' },
      }],
    })
    const stand = panels.find((p) => p.id === 'front-panel-stand')!
    const shelf = panels.find((p) => p.role === 'shelf')!
    const t = catalog.materials.find((m) => m.id === stand.materialId)!.thickness
    const shelfLeft = shelf.position.x
    const shelfRight = shelfLeft + shelf.finishedLength
    const standLeft = stand.position.x
    const standRight = standLeft + t

    if (side === 'left') expect(shelfLeft).toBeGreaterThanOrEqual(standRight)
    else expect(shelfRight).toBeLessThanOrEqual(standLeft)
    if (shelfKind === 'adjustable') {
      expect(stand.drilling.some((d) => d.purpose === 'shelfPin')).toBe(true)
    } else {
      // Дно/крышка буындары да стойкаға конфирмат салады. Дәл СӨРЕНІҢ
      // биіктігіндегі бет тесіктерін оның торц тесіктерімен жұптаймыз.
      const shelfMidY = shelf.position.y + t / 2
      const faceHoles = stand.drilling.filter((d) => d.purpose === 'confirmat'
        && (d.face === 'inner' || d.face === 'outer')
        && Math.abs(stand.position.y + d.x - shelfMidY) < 0.1)
      const edgeFace = side === 'left' ? 'edgeW1' : 'edgeW2'
      const edgeHoles = shelf.drilling.filter((d) => d.purpose === 'confirmat' && d.face === edgeFace)
      expect(faceHoles.length).toBeGreaterThanOrEqual(2)
      expect(edgeHoles).toHaveLength(faceHoles.length)
      for (const faceHole of faceHoles) {
        const worldZ = stand.position.z + faceHole.y
        expect(edgeHoles.some((edgeHole) => Math.abs(shelf.position.z + edgeHole.x - worldZ) < 0.1)).toBe(true)
      }
    }
  })

  it('side-left ЕНДІ жоқ ілгекке планка алмайды (538 мм қашық жалған координата)', () => {
    const panels = gen({ frontPanel: { width: 120, side: 'left' } })
    const side = panels.find((p) => p.id === 'side-left')!
    const plates = side.drilling.filter((d) => d.purpose === 'hinge')
    expect(plates).toEqual([])
  })

  it('side-right ЕНДІ жоқ ілгекке планка алмайды (frontPanel оң жақта болғанда)', () => {
    const panels = gen({
      frontPanel: { width: 120, side: 'right' },
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'shelves', count: 1, shelfKind: 'adjustable' }],
        fronts: { count: 1, mount: 'overlay', opening: 'right' },
      }],
    })
    const side = panels.find((p) => p.id === 'side-right')!
    const plates = side.drilling.filter((d) => d.purpose === 'hinge')
    expect(plates).toEqual([])
  })

  it('планка НАҚТЫ ТІК ДЕТАЛЬГЕ түседі — соқыр панельдің артындағы стойкаға', () => {
    const panels = gen({ frontPanel: { width: 120, side: 'left' } })
    const platePanels = hingePlatePanels(panels)
    expect(platePanels).toHaveLength(1)
    const stand = platePanels[0]!
    expect(stand.id).not.toBe('side-left')
    // Стойка соқыр панельдің дәл артында тұруы керек: x = frontPanel.width.
    expect(stand.position.x).toBe(120)
  })

  it('стойка НАҚТЫ ДЕТАЛЬ ретінде деталировкада болады (қалыңдық, кромка)', () => {
    const panels = gen({ frontPanel: { width: 120, side: 'left' } })
    const stand = panels.find((p) => p.position.x === 120 && p.role === 'divider')
    expect(stand).toBeDefined()
    expect(stand!.finishedLength).toBeGreaterThan(0)
    expect(stand!.finishedWidth).toBeGreaterThan(0)
    expect(stand!.edges.L1).not.toBeNull()
  })
})
