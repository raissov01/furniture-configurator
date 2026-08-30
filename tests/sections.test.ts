/**
 * PHASE-2 A1 — секцияларға ен бөлу.
 * Ендер W − 2t − dividerCount·t-ға ДӘЛ жиналуы керек.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet, layoutSections } from '../src/core/index'
import type { Panel, Section } from '../src/core/index'
import { CARCASS_THICKNESS as T, catalog, threeSectionWardrobe, withCabinet } from './fixtures'

const section = (widthMode: 'fixed' | 'flex', width?: number, id = `s${width ?? widthMode}`): Section => ({
  id,
  widthMode,
  ...(width === undefined ? {} : { width }),
  contents: [],
})

const layout = (sections: Section[], W: number) =>
  layoutSections(sections, W - 2 * T, T, T)

describe('ен бөлу', () => {
  it('W=1800, 2 перегородка, [fixed 400, flex, flex] → 400 / 668 / 668', () => {
    const r = layout([section('fixed', 400, 's1'), section('flex', undefined, 's2'), section('flex', undefined, 's3')], 1800)
    expect(r.layouts.map((l) => l.width)).toEqual([400, 668, 668])
    expect(r.layouts.map((l) => l.x)).toEqual([16, 432, 1116])
    expect(r.dividerPositions).toEqual([416, 1100])
  })

  it('қалдық миллиметрлер flex секцияларға СОЛДАН ОҢҒА кетеді', () => {
    const r = layout([section('fixed', 401, 's1'), section('flex', undefined, 's2'), section('flex', undefined, 's3')], 1800)
    expect(r.layouts.map((l) => l.width)).toEqual([401, 668, 667])
  })

  it.each([600, 900, 1201, 1800, 2401])('W=%i: ендер + перегородкалар innerWidth-ке дәл жиналады', (W) => {
    for (const sections of [
      [section('flex', undefined, 'a')],
      [section('flex', undefined, 'a'), section('flex', undefined, 'b')],
      [section('fixed', 300, 'a'), section('flex', undefined, 'b'), section('flex', undefined, 'c')],
      [section('flex', undefined, 'a'), section('flex', undefined, 'b'), section('flex', undefined, 'c'), section('flex', undefined, 'd')],
    ]) {
      const r = layout(sections, W)
      const widths = r.layouts.map((l) => l.width)
      expect(widths.every(Number.isInteger)).toBe(true)
      const dividers = sections.length - 1
      expect(widths.reduce((a, b) => a + b, 0)).toBe(W - 2 * T - dividers * T)
      // Секциялар мен перегородкалар үзіліссіз тізбек құрайды
      let x = T
      r.layouts.forEach((l, i) => {
        expect(l.x).toBe(x)
        x += l.width
        if (i < r.layouts.length - 1) {
          expect(r.dividerPositions[i]).toBe(x)
          x += T
        }
      })
      expect(x).toBe(W - T)
    }
  })

  it('flex секциялар бір-бірінен ең көп 1 мм-ге өзгешеленеді', () => {
    const r = layout(
      [section('flex', undefined, 'a'), section('flex', undefined, 'b'), section('flex', undefined, 'c')],
      1801,
    )
    const w = r.layouts.map((l) => l.width)
    expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1)
  })
})

describe('секция валидациясы', () => {
  it('fixed секцияда width жоқ → өріс аты бар қате', () => {
    expect(() => layout([{ id: 'a', widthMode: 'fixed', contents: [] }], 1800)).toThrow(/sections\[0\].width/)
  })

  it('fixed секциялар сыймайды', () => {
    expect(() => layout([section('fixed', 1000, 'a'), section('fixed', 1000, 'b')], 1800))
      .toThrow(/fixed қосындысы ≤/)
  })

  it('flex жоқ әрі қосынды дәл емес → айырманы көрсетеді', () => {
    expect(() => layout([section('fixed', 800, 'a'), section('fixed', 800, 'b')], 1800))
      .toThrow(/айырма 152 мм/)
  })

  it('тым тар секция қабылданбайды', () => {
    expect(() => layout([section('fixed', 50, 'a'), section('flex', undefined, 'b')], 1800))
      .toThrow(/≥ 100 мм/)
  })

  it('секция тігінен жолақтарға бөлінеді, араларына бекітілген сөре тұрады', () => {
    const cfg = withCabinet({
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [
          { kind: 'shelves', count: 2, shelfKind: 'adjustable' },
          { kind: 'empty' },
        ],
      }],
    })
    const panels = generateCabinet(cfg, catalog)
    const shelves = panels.filter((x: Panel) => x.role === 'shelf')
    // 2 сөре + жолақтар арасындағы 1 разделитель.
    expect(shelves).toHaveLength(3)
    expect(shelves.filter((x) => x.note.includes('Разделитель'))).toHaveLength(1)
  })

  it('жолақтарға орын жетпесе — түсінікті қате', () => {
    const cfg = withCabinet({
      height: 400,
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'empty', height: 300 }, { kind: 'empty', height: 300 }],
      }],
    })
    expect(() => generateCabinet(cfg, catalog)).toThrow(/sections\[0\].contents/)
  })
})

describe('перегородка панелі', () => {
  const panels = generateCabinet(threeSectionWardrobe, catalog)
  const dividers = panels.filter((p: Panel) => p.role === 'divider')

  it('секциядан бір кем, толық ішкі биіктікте, бүйірмен бірдей тереңдікте', () => {
    expect(dividers).toHaveLength(2)
    const side = panels.find((p) => p.role === 'side')!
    for (const d of dividers) {
      expect(d.finishedLength).toBe(2100 - 2 * T)
      expect(d.finishedWidth).toBe(side.finishedWidth)
      expect(d.position.y).toBe(T)
    }
  })

  it('торцтары көрінбейді — тек алдыңғы жиегінде кромка', () => {
    const d = dividers[0]!
    expect(d.edges.L1).not.toBeNull()
    expect(d.edges.L2).toBeNull()
    expect(d.edges.W1).toBeNull()
    expect(d.edges.W2).toBeNull()
  })

  it('әр секцияның сөресі өз енімен кесіледі', () => {
    const shelves = panels.filter((p) => p.role === 'shelf')
    expect(shelves.filter((s) => s.id.startsWith('s1-'))).toHaveLength(5)
    expect(shelves.filter((s) => s.id.startsWith('s3-'))).toHaveLength(3)
    expect(shelves.find((s) => s.id.startsWith('s1-'))!.finishedLength).toBe(400 - 2)
    expect(shelves.find((s) => s.id.startsWith('s3-'))!.finishedLength).toBe(668 - 2)
  })
})
