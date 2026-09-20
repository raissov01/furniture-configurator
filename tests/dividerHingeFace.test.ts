/**
 * Ақау: docs/audit/drilling-2026-09-20.md §R4 (drilling.ts:264-269 маңы,
 * hingeHoles ф-ясы) — перегородканың ілгек планкасының тесігі әрқашан
 * `'inner'` бетіне жазылады. Перегородканың ЕКІ кең беті де бір секцияға
 * «ішке» қарайды (сол секцияға да, оң секцияға да), сондықтан екі жақтың
 * планка тесігі БІР бетке, БІР координатаға түсіп, қайталанып кетеді —
 * іс жүзінде тесік бір-ақ рет бұрғыланады да, екінші есіктің планкасына
 * тесік қалмайды.
 *
 * Тексеру: үш секциялы шкафтың ортаңғы перегородкасы (`divider-2`) — екі
 * жағында да секция бар, екеуінде де ілінетін есік бар. Оның планка
 * тесіктері (purpose: 'hinge') БӨЛЕК беттерде (inner/outer) болуы керек,
 * бір координатада екі рет қайталанбауы тиіс.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import { catalog, threeSectionWardrobe } from './fixtures'

describe('перегородканың екі жағындағы ілгек планкасы (§R4)', () => {
  it('divider-2: планка тесіктері (координата+бет) ЕКІ ЕСЕ ҚАЙТАЛАНБАЙДЫ', () => {
    const panels = generateCabinet(threeSectionWardrobe, catalog)
    const divider = panels.find((p) => p.id === 'divider-2')!
    const plates = divider.drilling.filter((d) => d.purpose === 'hinge')
    expect(plates.length).toBeGreaterThan(0)

    const seen = new Map<string, number>()
    for (const d of plates) {
      const key = `${d.face}:${d.x}:${d.y}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1)
    expect(duplicates, `қайталанған координаталар (face:x:y → саны): ${JSON.stringify(duplicates)}`).toEqual([])
  })

  it('divider-2: екі сектордың планкасы екі БӨЛЕК бетте (inner ЖӘНЕ outer)', () => {
    const panels = generateCabinet(threeSectionWardrobe, catalog)
    const divider = panels.find((p) => p.id === 'divider-2')!
    const faces = new Set(divider.drilling.filter((d) => d.purpose === 'hinge').map((d) => d.face))
    expect(faces).toEqual(new Set(['inner', 'outer']))
  })
})
