/**
 * Детальдің АШЫЛУЫ (3D анимациясы).
 *
 * Мұндағы басты ереже: 3D ешнәрсе БОЛЖАМАЙДЫ. Есіктің ілгегі қай жақта
 * екенін геометрия шешеді, ал 3D сол шешімді оқиды. Егер экран оны панельдің
 * атауынан не тесігінің орнынан тапса, екеуі бір күні алшақтайды да,
 * клиентке есігі басқа жаққа ашылатын шкаф көрсетіледі.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const doors = (opening?: 'left' | 'right'): CabinetConfig => withCabinet({
  height: 2000, width: 800, depth: 450,
  sections: [{
    id: 's1', widthMode: 'flex', contents: [],
    fronts: { count: 2, mount: 'overlay', ...(opening ? { opening } : {}) },
  }],
})

const drawers = (): CabinetConfig => withCabinet({
  height: 850, width: 800, depth: 500,
  sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{ kind: 'drawers', count: 2 }],
    fronts: null,
  }],
})

const fronts = (config: CabinetConfig) => generateCabinet(config, catalog)
  .filter((p: Panel) => p.role === 'front')
  .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)

describe('ілмелі есік', () => {
  it('ілгектің жағы ПРИСАДКАМЕН бір шешімнен алынады', () => {
    const [left, right] = fronts(doors())
    expect(left!.opening).toEqual({ kind: 'door', side: 'left' })
    expect(right!.opening).toEqual({ kind: 'door', side: 'right' })
  })

  it('цех жағын нақты таңдаса, ол сақталады', () => {
    for (const side of ['left', 'right'] as const) {
      for (const front of fronts(doors(side))) {
        expect(front.opening).toEqual({ kind: 'door', side })
      }
    }
  })

  it('ілгектің ЧАШКАСЫ сол жақта тұрады', () => {
    // Тесік те, анимация да бір шешімнен шыққанын осы тексереді: чашка
    // фасадтың ілгек жағындағы жиегіне жақын болуы керек.
    for (const front of fronts(doors())) {
      const cups = front.drilling.filter((d) => d.purpose === 'hinge' && d.diameter >= 30)
      expect(cups.length).toBeGreaterThan(0)
      const side = front.opening!.kind === 'door' ? front.opening!.side : null
      // Фасадтың локал y-і солдан оңға (ORIENT_FACING), ал x — биіктік.
      const nearLeft = cups.every((c) => c.y < front.cutWidth / 2)
      expect(side === 'left' ? nearLeft : !nearLeft).toBe(true)
    }
  })
})

describe('ящик', () => {
  const panels = generateCabinet(drawers(), catalog)

  it('фасады да, ҚОРАБЫ да бірге жылжиды', () => {
    const box = panels.filter((p: Panel) => p.id.startsWith('s1-b1-drawer-1'))
    expect(box.length).toBeGreaterThan(4)
    for (const panel of box) {
      expect(panel.opening?.kind, panel.id).toBe('drawer')
    }
  })

  it('шығу жолы қораптың тереңдігінен аспайды', () => {
    const bottom = panels.find((p: Panel) => p.role === 'drawerBottom')!
    const travel = bottom.opening!.kind === 'drawer' ? bottom.opening!.travel : 0
    expect(travel).toBeGreaterThan(0)
    expect(travel).toBeLessThanOrEqual(bottom.finishedWidth)
  })

  it('бір ящиктің бөлшектері БІРДЕЙ жолмен шығады', () => {
    const first = panels.filter((p: Panel) => p.id.startsWith('s1-b1-drawer-1'))
    const travels = new Set(first.map((p) => (p.opening?.kind === 'drawer' ? p.opening.travel : -1)))
    expect(travels.size).toBe(1)
  })
})

describe('қалған детальдер', () => {
  it('корпустың панельдері АШЫЛМАЙДЫ', () => {
    for (const panel of generateCabinet(doors(), catalog)) {
      if (panel.role === 'front') continue
      expect(panel.opening, panel.id).toBeUndefined()
    }
  })

  it('купе есігі әзірге ашылмайды — «шамамен» көрсетілмейді', () => {
    const sliding = generateCabinet(withCabinet({
      height: 2400, width: 1800, depth: 600,
      sections: [{ id: 's1', widthMode: 'flex', contents: [], fronts: null }],
      sliding: { count: 2 },
    }), catalog)
    for (const panel of sliding.filter((p: Panel) => p.role === 'front')) {
      expect(panel.opening).toBeUndefined()
    }
  })
})
