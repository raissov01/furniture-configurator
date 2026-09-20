/**
 * Аудит Y5 (docs/audit/drilling-2026-09-20.md): `drilling.ts` присадка
 * координатасын БҮТІН мм-ге дөңгелектейді (`pushFace`), ал фрезеровка
 * (`applyMilling`) 0.1 мм-ге. CLAUDE.md §0.2 «бүтін мм» ережесі ДЕТАЛЬДІҢ
 * өлшеміне қатысты (кесу ұзындығы/ені) — присадка координатасы басқа нәрсе,
 * әрі §4.9-да ілгек тереңдігі 12.5 мм болып ерекшелік ретінде жазылған,
 * яғни бұл доменде 1 мм-ден жіңішке дәлдік бұрыннан рұқсат етілген.
 *
 * НАҚТЫ САН: кромка қалыңдығы (`EdgeBand.thickness: number`, каталогта
 * шектеусіз) бүтін мм болмауы мүмкін (мыс. 1.3 мм). `toCut`-та осы шама
 * координатадан шегеріледі де, бүтін мм-ге дейін дөңгелектегенде 0.5 мм-ге
 * дейін жоғалады — 32 мм жүйесінде бұл тізбектеліп жүрсе байқалады.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, confirmatJoint, generateCabinet, mergeSettings,
} from '../src/core/index'
import type { EdgeBand } from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

describe('Y5: присадка координатасы кемінде 0.1 мм дәлдікте сақталады', () => {
  const panels = generateCabinet(referenceWardrobe, catalog)
  const bottom = panels.find((p) => p.id === 'bottom')!
  const sideLeft = panels.find((p) => p.id === 'side-left')!
  const settings = mergeSettings(DEFAULT_SETTINGS, referenceWardrobe.settings)

  const withBand = (thickness: number) => {
    const bottomClone = structuredClone(bottom)
    const sideClone = structuredClone(sideLeft)
    bottomClone.edges.W1 = { bandId: 'frac' }
    bottomClone.drilling = []
    sideClone.drilling = []
    const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
    const band: EdgeBand = { id: 'frac', name: 'test', thickness, pricePerMeter: 0 }
    bands.set('frac', band)
    const ctx = { thickness: () => 16, bands, settings }
    confirmatJoint(bottomClone, sideClone, ctx)
    return bottomClone.drilling[0]!.x
  }

  it('1.3 мм кромка шегерілгенде x бүтінге ЕМЕС, 0.1 мм-ге дөңгелектеледі', () => {
    // Бүтін мм-ге дөңгелектесе, 1.3 мм мен 1.7 мм екеуі де -9-ға (немесе
    // -10-ға) құлайды да, ажырамайды. 0.1 мм-де олар ЕКІ БАСҚА сан болуы керек.
    const x13 = withBand(1.3)
    const x17 = withBand(1.7)
    expect(x13).not.toBe(x17)
    expect(x13).toBeCloseTo(-9.3, 5)
    expect(x17).toBeCloseTo(-9.7, 5)
  })
})
