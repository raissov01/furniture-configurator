/**
 * Аудит C10 (docs/audit/corner-2026-09-20.md): бұрыштық корпустың жатық
 * детальдарында (дно/крышка/сөре) алдыңғы жиек (L1) ЕН бойынша қиғаш кесіледі
 * (§4.6a-ға ұқсас емес, `PanelBevel` widthAtStart/widthAtEnd), сондықтан оның
 * НАҒЫЗ ұзындығы `finishedLength` емес, ГИПОТЕНУЗА:
 *   √(finishedLength² + |widthAtStart − widthAtEnd|²)
 *
 * `edgeMetresByBand` бұл ретте `finishedLength`-ті тура алады да, әр жатық
 * детальде кромканы шамамен 53 мм (9%) кем есептейді — тек ақша емес,
 * материал тапсырысы да осы саннан шығады.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf,
  defaultShopProfile,
  edgeMetresByBand,
  findTemplate,
  generateCabinet,
  templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig } from '../src/core/index'
import { isWidthBevel } from '../src/core/types'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** docs/audit/corner-2026-09-20.md-дегі дәл сол 600/350 переходной пенал. */
const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
  ...template,
  depth: 600,
  back: { mode: 'none' },
  corner: { depthAtRight },
  sections: [{
    ...template.sections[0]!,
    fronts: null,
    contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
  }],
  ...patch,
})

describe('C10: бұрыштық корпустың қиғаш алдыңғы жиегінің кромка ұзындығы', () => {
  it('трапецияның екі қысқа ұшын өз енімен есептейді', () => {
    const panel = generateCabinet(corner(350), catalog).find((p) => p.bevel)!
    if (!panel.bevel || !isWidthBevel(panel.bevel)) throw new Error('width bevel expected')
    const band = { bandId: 'short-end' }
    const metres = edgeMetresByBand([{ ...panel, qty: 1, edges: { L1: null, L2: null, W1: band, W2: band } }])
    expect(metres.get('short-end')).toBe((panel.bevel.widthAtStart + panel.bevel.widthAtEnd) / 1000)
  })
  it('дно/крышка/3 сөре — әрқайсысының L1-і гипотенуза (≈621 мм), 568 емес', () => {
    const panels = generateCabinet(corner(350), catalog)
    // bottom, top, s1-shelf-1..3 — бесеуі де widthAtStart:600 → widthAtEnd:350,
    // finishedLength 568/566. Алдыңғы жиек (L1) √(fl² + 250²).
    const bevelPanels = panels.filter((p) => p.bevel)
    expect(bevelPanels.length).toBe(5)

    const metres = edgeMetresByBand(panels)
    const pvc2 = metres.get('pvc2-h1145') ?? 0

    // ЕСКІ (қате) мінез: finishedLength тура алынса — 6.834 м шығар еді
    // (5 қиғаш деталь finishedLength-пен + бүйірлердің тік жиектері).
    // ДҰРЫС: әр қиғаш детальге +53 мм (√(568²+250²)−568 ≈ 52.58→53,
    // немесе 566 негізінде дәл сол дельта 250 болғанда ұқсас), жиынтығы
    // ескі саннан ~0.26 м артық болуы керек.
    expect(pvc2).toBeGreaterThan(7.0)
    expect(pvc2).toBeCloseTo(7.099, 2)
  })
})
