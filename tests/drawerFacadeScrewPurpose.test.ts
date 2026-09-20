/**
 * Аудит Y3 (docs/audit/drilling-2026-09-20.md): ящик фасадын қорапқа
 * бекітетін еврошуруп (Ø3, `DRAWER_FACADE_SCREW_DIAMETER`) `drilling.ts`
 * `drawerFacadeScrews`-те `purpose: 'dowel'` деп бұрғыланады — ал бұл шкант
 * ЕМЕС (комментарийдің өзі де «еврошуруптар» дейді, generateCabinet.ts
 * drawerFacadeScrews шақыруының үстінде). CNC экспортында (cnc.ts, basis.ts)
 * «Назначение: шкант» болып шығады да, цех операторын шатастырады.
 *
 * Шатастыруға болмайтыны: `drawerBottomJoints`-тағы (Ø6, алдыңғы дәлдеу
 * пин) `purpose: 'dowel'` ШЫНЫМЕН шкант — оны ӨЗГЕРТПЕЙМІЗ
 * (tests/drillO1O2.test.ts осыны тексереді).
 */
import { describe, expect, it } from 'vitest'
import {
  DRAWER_FACADE_SCREW_DIAMETER, SEED_CATALOG, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'

describe('Y3: ящик фасадының еврошурупы «шкант» емес, дұрыс аталуы керек', () => {
  it('drawerFacadeScrews тесіктерінің purpose-і dowel ЕМЕС', () => {
    const config = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
    const panels = generateCabinet(config, SEED_CATALOG)
    const wallFront = panels.find((p) => p.id.endsWith('-wall-front'))!
    const screws = wallFront.drilling.filter((d) => d.diameter === DRAWER_FACADE_SCREW_DIAMETER)
    expect(screws.length).toBeGreaterThan(0)
    for (const s of screws) expect(s.purpose).not.toBe('dowel')
  })
})
