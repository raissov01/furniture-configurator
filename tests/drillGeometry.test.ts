/**
 * `lib/drillGeometry.ts` — присадка тесігін (§4.9) 3D нүктеге/бағытқа
 * түрлендіретін таза функцияның тесті. Үш қабат:
 *
 *   1. Алты бет (inner/outer/edgeW1/edgeW2/edgeL1/edgeL2) — нақты
 *      сандармен, қолмен құрастырылған `Drill` (нақты фигуралы тесік).
 *   2. Нағыз присадка (`generateCabinet(referenceWardrobe, ...)`) — әр
 *      тесіктің канондық нүктесі панельдің өз шегінде жатуы керек.
 *   3. Бұрыштық (трапеция) панель — форманың тар ұшындағы тесік те дұрыс
 *      түрленеді (`src/core/bevelBounds.ts` арқылы тексеріледі).
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, cutOrigin, defaultShopProfile, findTemplate, generateCabinet, isWidthBevel, mergeSettings,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Catalog, Drill, Panel } from '../src/core/index'
import { materialWidthRangeAt } from '../src/core/bevelBounds'
import { drillToLocalMarker } from '../lib/drillGeometry'
import { catalog, referenceWardrobe } from './fixtures'

const settings = mergeSettings(referenceWardrobe.settings)
const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))
const thicknessOf = (panel: Panel, cat: Catalog = catalog): number =>
  cat.materials.find((m) => m.id === panel.materialId)!.thickness

const baseDrill = (patch: Partial<Drill>): Drill => ({
  face: 'inner', x: 10, y: 20, diameter: 8, depth: 5, purpose: 'confirmat', ...patch,
})

describe('drillToLocalMarker — алты бет (§4.9)', () => {
  /*
   * Нақты панель алынады — синтетикалық емес: origin (cutOrigin) шынайы
   * кромка қалыңдығымен есептеледі. `side-left`-те W1 (0.4 мм, PVC04)
   * `minBandSubtract`-тан (1 мм) төмен — шегерілмейді (origin.x=0), сондықтан
   * фасад алынады: онда БАРЛЫҚ төрт жиек 2 мм PVC-мен, origin.x/y екеуі де
   * нөлден үлкен — «шегеру дұрыс жұмыс істеді ме» толық тексеріледі.
   */
  const panels = generateCabinet(referenceWardrobe, catalog)
  const side = panels.find((p) => p.id === 's1-front-1')!
  const t = thicknessOf(side)
  const origin = cutOrigin(side, bands, settings)
  it('sanity: фасадта төрт жиек те кромкамен (origin > 0)', () => {
    expect(origin.x).toBeGreaterThan(0)
    expect(origin.y).toBeGreaterThan(0)
  })

  it('inner: бет z=thickness-те, материалға −z бағытымен кіреді', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'inner', x: 10, y: 20 }), t, bands, settings)
    expect(m.point).toEqual({ x: 10 + origin.x, y: 20 + origin.y, z: t })
    expect(m.direction).toEqual({ x: 0, y: 0, z: -1 })
    expect(m.diameter).toBe(8)
    expect(m.depth).toBe(5)
  })

  it('outer: бет z=0-де, материалға +z бағытымен кіреді', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'outer', x: 10, y: 20 }), t, bands, settings)
    expect(m.point).toEqual({ x: 10 + origin.x, y: 20 + origin.y, z: 0 })
    expect(m.direction).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('edgeW1: ұзындықтың басындағы торц (x=0), y — ен бойымен (L1 шегеріледі), +x бағыты', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'edgeW1', x: 30, y: t / 2 }), t, bands, settings)
    expect(m.point).toEqual({ x: 0, y: 30 + origin.y, z: t / 2 })
    expect(m.direction).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('edgeW2: ұзындықтың соңындағы торц (x=finishedLength), −x бағыты', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'edgeW2', x: 30, y: t / 2 }), t, bands, settings)
    expect(m.point).toEqual({ x: side.finishedLength, y: 30 + origin.y, z: t / 2 })
    expect(m.direction).toEqual({ x: -1, y: 0, z: 0 })
  })

  it('edgeL1: енінің басындағы торц (y=0), x — ұзындық бойымен (W1 шегеріледі), +y бағыты', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'edgeL1', x: 40, y: t / 2 }), t, bands, settings)
    expect(m.point).toEqual({ x: 40 + origin.x, y: 0, z: t / 2 })
    expect(m.direction).toEqual({ x: 0, y: 1, z: 0 })
  })

  it('edgeL2: енінің соңындағы торц (y=finishedWidth), −y бағыты', () => {
    const m = drillToLocalMarker(side, baseDrill({ face: 'edgeL2', x: 40, y: t / 2 }), t, bands, settings)
    expect(m.point).toEqual({ x: 40 + origin.x, y: side.finishedWidth, z: t / 2 })
    expect(m.direction).toEqual({ x: 0, y: -1, z: 0 })
  })
})

describe('drillToLocalMarker — нақты присадка (referenceWardrobe), барлық тесік панель шегінде', () => {
  const panels = generateCabinet(referenceWardrobe, catalog)
  const EPS = 0.6 // §4.9/§4.6 дөңгелектеу мен кесу төзімі — drillBounds.test.ts-тегі BEVEL_EPS-пен бірдей

  for (const panel of panels) {
    if (panel.drilling.length === 0) continue
    it(`${panel.id}: ${panel.drilling.length} тесік — нүкте шекте, бағыт бірлік ось`, () => {
      const t = thicknessOf(panel)
      for (const d of panel.drilling) {
        const m = drillToLocalMarker(panel, d, t, bands, settings)
        expect(m.point.x).toBeGreaterThanOrEqual(-EPS)
        expect(m.point.x).toBeLessThanOrEqual(panel.finishedLength + EPS)
        expect(m.point.y).toBeGreaterThanOrEqual(-EPS)
        expect(m.point.y).toBeLessThanOrEqual(panel.finishedWidth + EPS)
        expect(m.point.z).toBeGreaterThanOrEqual(-EPS)
        expect(m.point.z).toBeLessThanOrEqual(t + EPS)

        // Бағыт әрқашан БІР ғана осьте ±1, қалған екеуі 0 (алты беттің
        // әрқайсысы да таза осьтік — диагональ тесік жоқ).
        const axes = [m.direction.x, m.direction.y, m.direction.z]
        const nonZero = axes.filter((v) => v !== 0)
        expect(nonZero).toHaveLength(1)
        expect(Math.abs(nonZero[0]!)).toBe(1)
      }
    })
  }
})

describe('drillToLocalMarker — бұрыштық (трапеция) панель, K1 сценарийімен бірдей', () => {
  const cornerCatalog = catalogOf(defaultShopProfile())
  const cornerBands = new Map(cornerCatalog.edgeBands.map((b) => [b.id, b]))
  const cornerSettings = mergeSettings()
  const cornerTemplate = templateToCabinet(findTemplate('wardrobe-penal-600')!, cornerCatalog)
  const corner: CabinetConfig = {
    ...cornerTemplate,
    depth: 600,
    back: { mode: 'none' },
    corner: { depthAtRight: 350 },
    sections: [{
      ...cornerTemplate.sections[0]!,
      fronts: null,
      contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
    }],
  }
  const panels = generateCabinet(corner, cornerCatalog)
  const bottom = panels.find((p) => p.id === 'bottom')!

  /*
   * `bottom` (крышка/дно ROLE) шкафтың ЕН осі (depth) бойынша қиғаш —
   * бірақ бетінде (`inner`/`outer`) бұл сценарийде тесік ЖОҚ (полкодержатель
   * бағаны бүйірлерге түседі, дноға емес). Нақты трапеция-сезімтал тесіктер
   * — `edgeW1`/`edgeW2` конфирмат буындары: аудиттің өз мысалы дәл осы
   * («bottom.edgeW2 x=48»), сондықтан соны тексереміз.
   */
  it('sanity: bottom панелінде edgeW1/edgeW2 тесіктер бар', () => {
    expect(bottom.bevel && isWidthBevel(bottom.bevel)).toBe(true)
    expect(bottom.drilling.every((d) => d.face === 'edgeW1' || d.face === 'edgeW2')).toBe(true)
    expect(bottom.drilling.length).toBeGreaterThan(0)
  })

  it('edgeW1/edgeW2 (қиғаштың тереңдігі өзгеретін ұш) — тесік НАҒЫЗ трапецияда, дұрыс канондық нүктеге түседі', () => {
    const t = thicknessOf(bottom, cornerCatalog)
    const origin = cutOrigin(bottom, cornerBands, cornerSettings)
    const BEVEL_EPS = 0.6
    let sawNarrowEnd = false

    for (const d of bottom.drilling) {
      // edgeW1 — ұзындықтың БАСЫ (x=0), edgeW2 — СОҢЫ (x=cutLength): дәл
      // сол ұштағы НАҒЫЗ ен (materialWidthRangeAt) d.x-ті шектейді (§K2).
      const lengthPos = d.face === 'edgeW1' ? 0 : bottom.cutLength
      const [xMin, xMax] = materialWidthRangeAt(bottom, lengthPos)
      expect(d.x).toBeGreaterThanOrEqual(xMin - BEVEL_EPS)
      expect(d.x).toBeLessThanOrEqual(xMax + BEVEL_EPS)
      if (xMax - xMin < bottom.cutWidth * 0.9) sawNarrowEnd = true

      // Түрлендіру формуласы трапецияда да тікбұрыштағыдай — бевельге
      // ерекше жағдай жоқ (drillGeometry.ts-тегі түсініктемені қара).
      const m = drillToLocalMarker(bottom, d, t, cornerBands, cornerSettings)
      expect(m.point.x).toBe(d.face === 'edgeW1' ? 0 : bottom.finishedLength)
      expect(m.point.y).toBeCloseTo(d.x + origin.y, 6)
      expect(m.point.z).toBeCloseTo(d.y, 6)
      expect(m.direction).toEqual(d.face === 'edgeW1' ? { x: 1, y: 0, z: 0 } : { x: -1, y: 0, z: 0 })
    }
    // Сынақ шынымен трапецияның тар ұшын қамтығанын растау — әйтпесе бұл
    // тексеру кездейсоқ кең жерде ғана өтіп, K1 жағдайын көрмей қалуы мүмкін.
    expect(sawNarrowEnd).toBe(true)
  })
})
