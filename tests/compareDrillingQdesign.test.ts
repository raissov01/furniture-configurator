import { describe, expect, it } from 'vitest'
import { compareDrilling, normalizeOurHoles, normalizeQdesignHoles, parseQdesignCsv } from '../scripts/compare-drilling-qdesign.mjs'

const header = 'cab_label,cab_uuid,panel,hole_id,type,side,x_mm,y_mm,dia_mm,depth_mm,through,source,preset_id,group_id'
const row = (panel: string, type: string, side: string, x: number, y: number, diameter: number, depth: number, through = false) =>
  `Шкаф,id,${panel},hole,${type},${side},${x},${y},${diameter},${depth},${through},auto,preset,group`

describe('qdesign присадка CSV салыстыруы', () => {
  it('BOM мен 14 бағанды оқиды, қате/белгісіз түрді жасырмайды', () => {
    const parsed = parseQdesignCsv(`\uFEFF${header}\n${row('facade_0', 'hinge_cup', 'back', 22, 100, 35, 12)}\n`)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({ panel: 'facade_0', x_mm: 22, through: false })
    expect(() => parseQdesignCsv(`${header}\nШкаф,id,facade_0`)).toThrow(/14/)
    expect(() => normalizeQdesignHoles(parseQdesignCsv(`${header}\n${row('side_left', 'mystery', 'front', 1, 2, 5, 8)}`), {
      side_left: { panelId: 'side-left', qLength: 2000, qWidth: 450, sideMap: { front: 'inner' } },
    })).toThrow(/mystery/)
  })

  it('фасадта qdesign ен/биіктік осьтерін біздің x/y-ге аударады', () => {
    const q = normalizeQdesignHoles(parseQdesignCsv(`${header}\n${row('facade_0', 'hinge_cup', 'back', 22, 100, 35, 12)}`), {
      facade_0: { panelId: 's1-front-1', qLength: 1994, qWidth: 295, axes: 'yx', sideMap: { back: 'inner' } },
    })
    expect(q[0]).toMatchObject({ panelId: 's1-front-1', purpose: 'hinge', face: 'inner', x: 100, y: 22, diameter: 35, depth: 12, through: false })
  })

  it('бүйірдің арттан саналатын осін аударады; өтпелі тесіктің кең беті эквивалент', () => {
    const q = normalizeQdesignHoles(parseQdesignCsv(`${header}\n${row('side_left', 'hinge_dowel', 'front', 198, 547, 3, 3)}\n${row('side_left', 'confirmat', 'front', 103, 50, 8, 16, true)}`), {
      side_left: { panelId: 'side-left', qLength: 2495, qWidth: 600, reverseY: true, sideMap: { front: 'inner' } },
    })
    expect(q[0]).toMatchObject({ face: 'inner', x: 198, y: 53, through: false })
    expect(q[1]).toMatchObject({ face: 'through', x: 103, y: 550, through: true })
    const ours = normalizeOurHoles([{ id: 'side-left', cutLength: 2495, cutWidth: 600, drilling: [
      { face: 'outer', x: 103, y: 550, diameter: 8, depth: 16, purpose: 'confirmat' },
    ] }], { 'side-left': 16 })
    expect(compareDrilling(ours, [q[1]])).toMatchObject({ matched: 1, oursCount: 1, qdesignCount: 1, percent: 100 })
  })

  it('әр тесік тек бір рет жұптасады; тереңдік пен координата шегі жеке тексеріледі', () => {
    const base = { panelId: 'front', purpose: 'hinge', face: 'inner', x: 100, y: 22, diameter: 35, depth: 12.5, through: false }
    const exact = compareDrilling([base, { ...base, x: 100.4 }], [base, { ...base, x: 100.5 }])
    expect(exact).toMatchObject({ matched: 2, percent: 100 })
    const different = compareDrilling([base], [{ ...base, x: 100.6, depth: 12 }])
    expect(different).toMatchObject({ matched: 0, percent: 0 })
    expect(different.differences).toHaveLength(2)
  })

  it('бір түп панелінің кең беті мен торцы бөлек координата жақтауын қолданады', () => {
    const csv = `${header}\n${row('bottom', 'custom', 'back', 51.5, 340.5, 3, 3)}\n${row('bottom', 'confirmat_pilot', 'left', 50, 8, 5, 35)}`
      .replace('custom,back,51.5,340.5,3,3,false,auto,preset', 'custom,back,51.5,340.5,3,3,false,auto,leg_screw')
    const holes = normalizeQdesignHoles(parseQdesignCsv(csv), {
      bottom: { panelId: 'bottom', frames: {
        back: { qLength: 568, qWidth: 450, sideMap: { back: 'outer' } },
        left: { qLength: 450, qWidth: 16, sideMap: { left: 'edgeW1' } },
      } },
    })
    expect(holes.map((hole: { purpose: string; face: string; x: number; y: number }) => [hole.purpose, hole.face, hole.x, hole.y]))
      .toEqual([['leg', 'outer', 51.5, 340.5], ['confirmat', 'edgeW1', 50, 8]])
  })
})
