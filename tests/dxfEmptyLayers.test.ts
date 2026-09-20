/**
 * Аудит Y7 (docs/audit/drilling-2026-09-20.md): `dxf.ts` торц тесіктерін
 * (`edgeL1`/`edgeL2`/`edgeW1`/`edgeW2`) қабат аттарын құрғанда `drills`-ке
 * қосады, бірақ entity салғанда `isEdgeFace(d.face)` болса ӨТКІЗІП ЖІБЕРЕДІ
 * (торц тесіктері бөлек операция, контурда салынбайды). Нәтижесінде DXF-тің
 * LAYER кестесінде іші бос қабат («DRILL_5_D35» сияқты, `face` берілмегендіктен
 * INNER_/OUTER_ префиксі жоқ) пайда болады — оператор оны ашса, ештеңе жоқ.
 *
 * Эталон шкафтың дно/крышкасында дәл осы жағдай бар: edgeW1/edgeW2-де
 * Ø5×35 конфирмат пилоты, ал сол диаметр+тереңдіктегі inner/outer тесік
 * ЖОҚ (беттегі конфирмат Ø8) — сондықтан «DRILL_5_D35» ТЕК edge-тен шығады.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet, panelToDxf } from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

describe('Y7: DXF-те бос (entity-сіз) DRILL_ қабаты болмауы керек', () => {
  it('топ панельдің edgeW1/edgeW2 Ø5×35 тесіктері LAYER кестесінде бос қабат тудырмайды', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const top = panels.find((p) => p.id === 'top')!
    const edgeDrills = top.drilling.filter((d) => d.face.startsWith('edge'))
    expect(edgeDrills.length).toBeGreaterThan(0)

    const dxf = panelToDxf(top)
    const [tableSection, entitySection] = dxf.split('ENTITIES')
    // Бос болатын нақты дәлел: «DRILL_5_D35» (face жоқ, тек edge-тен шығады).
    expect(tableSection).not.toContain('DRILL_5_D35')
    expect(entitySection).not.toContain('DRILL_5_D35')
  })
})
