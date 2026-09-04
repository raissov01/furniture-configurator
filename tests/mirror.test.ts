/**
 * Айна көшірмесі.
 *
 * Мұндағы басты қауіп — ЖАРТЫЛАЙ айна: секциялар айналып, ал есіктің ашылу
 * жағы сол күйінде қалса, цех оны құрастыру кезінде ғана байқайды. Сондықтан
 * тесттер әр «жақты» өрісті бөлек күзетеді.
 */
import { describe, expect, it } from 'vitest'
import { canMirror, generateCabinet, mirrorCabinet, mirrorNotes } from '../src/core/index'
import { catalog, referenceWardrobe, withCabinet } from './fixtures'

const mirrored = (patch: Parameters<typeof withCabinet>[0]) =>
  mirrorCabinet(withCabinet(patch), 'mirror-1')

describe('айна көшірмесі', () => {
  it('id мен аты жаңа, қалғаны сол күйінде', () => {
    const m = mirrorCabinet(referenceWardrobe, 'mirror-1')
    expect(m.id).toBe('mirror-1')
    expect(m.name).toMatch(/зеркало/)
    expect(m.width).toBe(referenceWardrobe.width)
    expect(m.height).toBe(referenceWardrobe.height)
    expect(m.depth).toBe(referenceWardrobe.depth)
  })

  it('СЕКЦИЯЛАРДЫҢ РЕТІ керіленеді', () => {
    const src = withCabinet({
      sections: [
        { id: 'a', widthMode: 'fixed', width: 300, contents: [{ kind: 'empty' }] },
        { id: 'b', widthMode: 'fixed', width: 400, contents: [{ kind: 'empty' }] },
        { id: 'c', widthMode: 'flex', contents: [{ kind: 'empty' }] },
      ],
    })
    expect(mirrorCabinet(src, 'm').sections.map((s) => s.id)).toEqual(['c', 'b', 'a'])
  })

  it('фасадтың АШЫЛУ ЖАҒЫ ауысады, «auto» мен «up» тимейді', () => {
    const left = mirrored({
      sections: [{
        id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }],
        fronts: { count: 1, mount: 'overlay', opening: 'left' },
      }],
    })
    expect(left.sections[0]!.fronts!.opening).toBe('right')

    for (const opening of ['auto', 'up'] as const) {
      const same = mirrored({
        sections: [{
          id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }],
          fronts: { count: 1, mount: 'overlay', opening },
        }],
      })
      expect(same.sections[0]!.fronts!.opening).toBe(opening)
    }
  })

  it('фасадтың ЗАЗОРЛАРЫ мен ТҰТҚАСЫ айналады', () => {
    const m = mirrored({
      sections: [{
        id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }],
        fronts: {
          count: 1, mount: 'overlay',
          gaps: { left: 3, right: 7, top: 2, bottom: 2 },
          handle: { handleId: 'handle-bar', boreSpacing: 128, position: 'topLeft', edgeOffset: 60, endOffset: 40 },
        },
      }],
    })
    const fronts = m.sections[0]!.fronts!
    expect(fronts.gaps).toMatchObject({ left: 7, right: 3, top: 2, bottom: 2 })
    expect(fronts.handle!.position).toBe('topRight')
  })

  it('крышка/дноның АСИММЕТРИЯЛЫ бекітілуі ауысады', () => {
    const m = mirrored({ mounts: { top: 'overlayLeft', bottom: 'overlayRight' } })
    expect(m.mounts).toEqual({ top: 'overlayRight', bottom: 'overlayLeft' })
    // Симметриялылар тимейді.
    expect(mirrored({ mounts: { top: 'inset', bottom: 'overlay' } }).mounts)
      .toEqual({ top: 'inset', bottom: 'overlay' })
  })

  it('фронтальдық панель мен планкалардың жағы ауысады', () => {
    const m = mirrored({
      frontPanel: { width: 120, side: 'left' },
      rails: [
        { id: 'r1', kind: 'carcass', position: 'left', width: 100, inset: 0, depthOffset: 0 },
        { id: 'r2', kind: 'carcass', position: 'top', width: 100, inset: 0, depthOffset: 0 },
      ],
    })
    expect(m.frontPanel!.side).toBe('right')
    expect(m.rails!.map((r) => r.position)).toEqual(['right', 'top'])
  })

  it('сөренің бүйір шегіністері мен ящиктің планкалары айналады', () => {
    const m = mirrored({
      sections: [{
        id: 's1', widthMode: 'flex',
        contents: [
          { kind: 'shelves', count: 2, shelfKind: 'adjustable', insets: { left: 10, right: 30 } },
          { kind: 'drawers', count: 2, fillers: { left: 20, right: 0 } },
        ],
      }],
    })
    const [shelves, drawers] = m.sections[0]!.contents
    expect((shelves as { insets: { left: number; right: number } }).insets)
      .toMatchObject({ left: 30, right: 10 })
    expect((drawers as { fillers: { left: number; right: number } }).fillers)
      .toMatchObject({ left: 0, right: 20 })
  })

  it('стойканың НАҚТЫ орны ұяның екінші шетінен саналады', () => {
    const m = mirrored({
      sections: [{
        id: 's1', widthMode: 'fixed', width: 600,
        contents: [{ kind: 'stand', count: 2, at: [100, 250] }],
      }],
    })
    expect((m.sections[0]!.contents[0] as { at: number[] }).at).toEqual([350, 500])
  })

  it('ҚОЛМЕН қойылған ойма мен присадка КӨШІРІЛМЕЙДІ, ал себебі айтылады', () => {
    const src = withCabinet({
      panelCutouts: { 'side-left': [{ id: 'c', corner: 'bottomLeft', x: 50, y: 50, shape: 'rect', width: 40, height: 40 }] },
      drillEdits: { 'side-left': { removed: ['x'], added: [] } },
    })
    const m = mirrorCabinet(src, 'm')
    expect(m.panelCutouts).toBeUndefined()
    expect(m.drillEdits).toBeUndefined()
    const notes = mirrorNotes(src)
    expect(notes.join(' ')).toMatch(/вырез/)
    expect(notes.join(' ')).toMatch(/присадк/)
  })

  it('БҰРЫШТЫҚ корпус айналмайды әрі себебі айтылады', () => {
    const corner = withCabinet({ corner: { depthAtRight: 300 } })
    const check = canMirror(corner)
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toMatch(/[Уу]гловой/)
    expect(() => mirrorCabinet(corner, 'm')).toThrow()
  })

  it('айна көшірмесі ЖИНАЛАДЫ: деталь саны сол күйінде', () => {
    const src = referenceWardrobe
    const m = mirrorCabinet(src, 'm')
    expect(generateCabinet(m, catalog)).toHaveLength(generateCabinet(src, catalog).length)
  })

  it('екі рет айналдырғанда бастапқы күйге оралады', () => {
    const src = withCabinet({
      frontPanel: { width: 120, side: 'left' },
      mounts: { top: 'overlayLeft' },
      sections: [
        { id: 'a', widthMode: 'fixed', width: 300, contents: [{ kind: 'empty' }] },
        { id: 'b', widthMode: 'flex', contents: [{ kind: 'empty' }] },
      ],
    })
    const twice = mirrorCabinet(mirrorCabinet(src, 'm1'), 'm2')
    expect(twice.frontPanel!.side).toBe('left')
    expect(twice.mounts!.top).toBe('overlayLeft')
    expect(twice.sections.map((s) => s.id)).toEqual(['a', 'b'])
  })
})
