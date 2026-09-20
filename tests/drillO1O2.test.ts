/**
 * `docs/audit/drilling-2026-09-20.md` §O1 және §O2 бойынша регрессия тесттері.
 *
 * §O1 — CLAUDE.md §4.9: «Two per joint minimum, three if the joint is longer
 * than 400 mm». `constants.ts`-тегі `confirmatSpanForThird: null` бұл
 * ережені өшіріп тұрған (drilling.ts:105-111 — `null` болса әрқашан 2).
 * Бұл тест 400 мм рету КЕЛТІРІЛГЕННЕН кейін жасыл өтеді.
 *
 * §O2 — торц тесігінің x координатасы кейбір жерлерде готовый өлшемде
 * жазылатын (кромка шегерілмейтін). Коммит 10d97c6 (A2) осыны
 * `minifixJoint`-те (drilling.ts:577 еді) және `drawerBottomJoints`-тың
 * минификс дюбель тесігінде (:628 еді) түзетті, бірақ сол функцияның
 * алдыңғы жиектегі дәлдеу шканттарында (:650 еді, face: 'edgeL1') кромка
 * шегеру ҚАЛЫП ҚОЙҒАН еді — осы файлдағы drilling.ts түзетуі соны жабады.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, SEED_CATALOG, drawerBottomJoints, findTemplate, generateCabinet,
  mergeSettings, subtractedThickness, templateToCabinet,
} from '../src/core/index'
import type { Drill, Panel } from '../src/core/index'
import { catalog, referenceWardrobe } from './fixtures'

const byId = (panels: Panel[], id: string): Panel => panels.find((p) => p.id === id)!
const of = (p: Panel, purpose: Drill['purpose']) => p.drilling.filter((d) => d.purpose === purpose)

describe('O1 — 400 мм-ден ұзын буынға 3 конфирмат (§4.9, constants.ts:confirmatSpanForThird)', () => {
  it('эталон шкафтың боковина↔крышка/дно буыны (447 мм, >400) — әр буында 3 конфирмат', () => {
    const panels = generateCabinet(referenceWardrobe, catalog)
    const side = byId(panels, 'side-left')
    const faceHoles = of(side, 'confirmat').filter((d) => d.face === 'outer')
    // Крышка + дно, әрқайсысына ҮШ (§4.9: буын 400 мм-ден ұзын).
    expect(faceHoles).toHaveLength(6)
  })
})

describe('O2 — drawerBottomJoints алдыңғы дәлдеу шканттарында да W1 кромкасы шегеріледі', () => {
  const config = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
  const panels = generateCabinet(config, SEED_CATALOG)
  const bottom = byId(panels, 's1-b1-drawer-1-bottom')
  const sideL = byId(panels, 's1-b1-drawer-1-side-l')
  const sideR = byId(panels, 's1-b1-drawer-1-side-r')

  it('кромкасыз W1 болғанда шегеру нөлге тең — тесіктер эталонмен сәйкес', () => {
    const settings = mergeSettings(DEFAULT_SETTINGS, config.settings)
    const ctx = { thickness: () => 16, bands: new Map(SEED_CATALOG.edgeBands.map((b) => [b.id, b])), settings }
    const clone: Panel = structuredClone(bottom)
    clone.drilling = []
    drawerBottomJoints(clone, [structuredClone(sideL), structuredClone(sideR)], ctx)
    const dowels = clone.drilling.filter((d) => d.purpose === 'dowel' && d.face === 'edgeL1')
    expect(dowels).toHaveLength(2)
  })

  it('W1-ге 2 мм кромка қойылса, алдыңғы дәлдеу шканттарының x-і сол 2 мм-ге ЖЫЛЖУЫ керек', () => {
    const bands = new Map(SEED_CATALOG.edgeBands.map((b) => [b.id, b]))
    const settings = mergeSettings(DEFAULT_SETTINGS, config.settings)
    const ctx = { thickness: () => 16, bands, settings }

    const plain: Panel = structuredClone(bottom)
    plain.drilling = []
    drawerBottomJoints(plain, [structuredClone(sideL), structuredClone(sideR)], ctx)
    const plainDowels = plain.drilling.filter((d) => d.purpose === 'dowel' && d.face === 'edgeL1')

    const banded: Panel = structuredClone(bottom)
    banded.edges.W1 = { bandId: 'pvc2-w980' }
    banded.drilling = []
    drawerBottomJoints(banded, [structuredClone(sideL), structuredClone(sideR)], ctx)
    const bandedDowels = banded.drilling.filter((d) => d.purpose === 'dowel' && d.face === 'edgeL1')

    const shift = subtractedThickness(banded.edges.W1, bands, settings)
    expect(shift).toBeGreaterThan(0)
    expect(bandedDowels).toHaveLength(2)
    for (let i = 0; i < plainDowels.length; i += 1) {
      expect(bandedDowels[i]!.x).toBe(plainDowels[i]!.x - shift)
    }
  })
})
