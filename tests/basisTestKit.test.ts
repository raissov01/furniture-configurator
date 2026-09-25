/**
 * Базис тест-жинағы (`src/core/export/basisTestKit.ts`): тестер БІР рет
 * іске қосатын жоба Базисте тексеруге болатын әр жағдайды қамтуы керек.
 */
import { describe, expect, it } from 'vitest'
import { runInFakeBazis } from './fakeBazis'
import {
  basisScriptData, basisTestKitScript, basisTestKitTree, catalogOf, defaultShopProfile,
  flattenTree, scenePanels,
} from '../src/core/index'

const catalog = catalogOf(defaultShopProfile())
const scene = flattenTree(basisTestKitTree(catalog), catalog)
const panels = scenePanels(scene)
const drills = panels.flatMap((p) => p.drilling.map((d) => ({ p, d })))
const data = basisScriptData(scene, catalog)

describe('тест-жинақ бәрін қамтиды', () => {
  it('тесіктің барлық түрі бар', () => {
    const kinds = new Set(drills.map(({ d }) => d.purpose))
    expect([...kinds].sort()).toEqual(
      ['confirmat', 'dowel', 'facadeScrew', 'handle', 'hinge', 'leg', 'minifix', 'runner', 'shelfPin'],
    )
  })

  it('минификс: бұранда Ø5 ЖӘНЕ футорка Ø8', () => {
    const bolts = drills.filter(({ d }) => d.purpose === 'minifix' && d.face === 'inner' && d.diameter < 15)
    expect(new Set(bolts.map(({ d }) => d.diameter))).toEqual(new Set([5, 8]))
  })

  it('ілгек: бұрандалы (Ø2.8) ЖӘНЕ press-fit (Ø8×12) чашка', () => {
    const hinge = drills.filter(({ d }) => d.purpose === 'hinge')
    expect(hinge.some(({ d }) => d.diameter === 2.8)).toBe(true)
    expect(hinge.some(({ d }) => d.diameter === 8 && d.depth === 12)).toBe(true)
  })

  it('тұтқа тесігі фасадтың СЫРТҚЫ бетінде', () => {
    const handles = drills.filter(({ d }) => d.purpose === 'handle')
    expect(handles.length).toBeGreaterThan(0)
    expect(handles.every(({ d, p }) => d.face === 'outer' && p.role === 'front')).toBe(true)
  })

  it('көтерілетін фасад, бұрыштық деталь (қиғаш), паз бар', () => {
    expect(panels.some((p) => p.opening?.kind === 'flap')).toBe(true)
    expect(panels.some((p) => p.bevel !== undefined)).toBe(true)
    expect(panels.some((p) => p.grooves.length > 0)).toBe(true)
  })

  it('жақтары әртүрлі кромкалы тақта (≥ 3 түрлі күй)', () => {
    const board = panels.find((p) => p.id === 'kit-board-edges')!
    const states = new Set(Object.values(board.edges).map((e) => (e ? e.bandId : 'none')))
    expect(states.size).toBeGreaterThanOrEqual(3)
  })

  it('бұрылған кірістірілген топ: 90° позасы бар түйін', () => {
    expect(scene.nodes.some((n) => n.pose.rotationY === 90)).toBe(true)
  })

  it('қолмен шкант: екі тақта арасында pair', () => {
    const edgedIndex = data.panels.findIndex((p) => p.panelId === 'kit-board-edges')
    const postIndex = data.panels.findIndex((p) => p.panelId === 'kit-board-post')
    const dowels = data.fasteners.filter((f) => f.kind === 'dowel' && f.panels.includes(edgedIndex))
    expect(dowels).toHaveLength(2)
    for (const f of dowels) {
      expect(f.mount).toBe('pair')
      expect(f.panels).toEqual([edgedIndex, postIndex])
    }
  })

  it('бірде-бір деталь өткізілмейді', () => {
    expect(data.panels.filter((p) => p.skip !== null)).toEqual([])
  })
})

describe('тест-жинақ скрипті жалған Базисте аяғына дейін жүреді', () => {
  it('audit таза: айырма жоқ', () => {
    const kinds = Object.fromEntries(data.kinds.map((k) => [k.id, true]))
    const fake = runInFakeBazis(basisTestKitScript(catalog), { mapped: kinds })
    expect(fake.isFinished()).toBe(true)
    const summary = (fake.audit!.comparison as { summary: Record<string, number> }).summary
    expect(summary).toMatchObject({ mismatch: 0, missing: 0, extra: 0, skipped: 0 })
    expect(fake.audit!.errors).toEqual([])
  })
})
