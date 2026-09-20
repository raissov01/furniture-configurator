/**
 * K12 (docs/audit/drilling-fix-plan.md K12, drilling-2026-09-20.md).
 *
 * Ящікті тумбада направляющаның тесігі бүйір панельдің ІШКІ бетіне
 * бұрғыланады (`runnerHoles`, `drilling.ts`), әлем координатасы
 * (`boxBottomWorldY`) арқылы. Ол `generateCabinet.ts`-тегі
 * `drawerRuns`-қа `run.boxBottomY` ретінде салынады — БІРАҚ бұл мән
 * `makeDrawers` ішіндегі ШИКІ локал `boxY` (цоколь биіктігіне КӨТЕРІЛМЕГЕН),
 * ал бүйір панельдің өз позициясы (`make()` арқылы) баршасы `baseHeight`-ке
 * көтерілген. Нәтиже: цоколі бар (`base: { kind: 'plinth' }`) тумбада
 * направляюшая тесігінің панельдегі локал x координатасы теріс не панельден
 * тыс шығады (`x = -baseHeight` шамасында ығысады).
 *
 * Тексеру: цоколі бар ящікті тумбада бүйір панельдің `purpose: 'runner'`
 * тесіктерінің БӘРІ `0 ≤ x ≤ cutLength` шегінде жатуы керек.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const withDrawersAndPlinth = withCabinet({
  width: 800, height: 800, depth: 500,
  sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{ kind: 'drawers', count: 2 }],
    fronts: null,
  }],
  base: { kind: 'plinth', height: 95, plinthShape: 'box' },
})

describe('направляюшаның тесігі цоколі бар тумбада (K12)', () => {
  it('side-left: purpose=runner тесіктерінің бәрі панель шегінде (0 ≤ x ≤ cutLength)', () => {
    const panels = generateCabinet(withDrawersAndPlinth, catalog)
    const side = panels.find((p: Panel) => p.id === 'side-left')!
    const runnerHoles = side.drilling.filter((d) => d.purpose === 'runner')
    expect(runnerHoles.length).toBeGreaterThan(0)
    for (const hole of runnerHoles) {
      expect(hole.x, `x=${hole.x} панель шегінен ТЫС (0..${side.cutLength}), y=${hole.y}`)
        .toBeGreaterThanOrEqual(0)
      expect(hole.x, `x=${hole.x} панель шегінен ТЫС (0..${side.cutLength}), y=${hole.y}`)
        .toBeLessThanOrEqual(side.cutLength)
    }
  })

  it('side-right: purpose=runner тесіктерінің бәрі панель шегінде', () => {
    const panels = generateCabinet(withDrawersAndPlinth, catalog)
    const side = panels.find((p: Panel) => p.id === 'side-right')!
    const runnerHoles = side.drilling.filter((d) => d.purpose === 'runner')
    expect(runnerHoles.length).toBeGreaterThan(0)
    for (const hole of runnerHoles) {
      expect(hole.x).toBeGreaterThanOrEqual(0)
      expect(hole.x).toBeLessThanOrEqual(side.cutLength)
    }
  })
})
