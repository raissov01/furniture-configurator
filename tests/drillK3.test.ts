/**
 * `docs/audit/corner-2026-09-20.md` §C1 (== `docs/audit/drilling-fix-plan.md`
 * K3) бойынша регрессия тесті.
 *
 * `confirmatJoint` (`drilling.ts:168`) буын ұзындығын ТЕК `edgePanel`-ден
 * алады. Дұрысы — `worldRange(edgePanel)` ∩ `worldRange(facePanel)`:
 * буын екі панель ҚАТАР тұрған жерде ғана бар.
 *
 * Бұрыштық шкафта `side-right` (350 мм тереңдік) `bottom`-ға (600 мм толық
 * тереңдік) тірелгенде буын ТЕК `z ∈ [250, 600]` аралығында бар, ал ескі
 * код бүкіл `z ∈ [0, 600]`-ды алады — нәтижесінде 250 мм тыс жерге, панель
 * шегінен ТЫС координатаға тесік түседі.
 *
 * Дәлел (аудиттен, нақты генерация — repro скриптімен расталды):
 *   depthAtRight=350: side-right outer confirmat y = [-202, 48, 298]
 *   depthAtRight=300: side-right outer confirmat y = [-252, -2, 248]
 *   Екеуінде де алғашқы мән теріс (панель шегінен тыс).
 *
 * ⚠ Түзу (тік бұрышты) шкафта фасад пен жиек панельдің қиылысы толық
 * ұзындықты береді (екеуі де сол аралықта толық тұрады), сондықтан бұл
 * түзету түзу шкафтардың присадкасын ӨЗГЕРТПЕУІ керек — соны да тексереміз.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'
import { catalog as refCatalog, referenceWardrobe } from './fixtures'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

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

const byId = (panels: Panel[], id: string): Panel => panels.find((p) => p.id === id)!

describe('K3 — конфирмат буыны ЕКІ панельдің қиылысы бойынша есептеледі (бұрыштық)', () => {
  it.each([350, 300])(
    'depthAtRight=%i: side-right-тегі бет конфирматтары панель шегінде, теріс ЕМЕС',
    (depthAtRight) => {
      const panels = generateCabinet(corner(depthAtRight), catalog)
      const right = byId(panels, 'side-right')
      const faceHoles = right.drilling.filter((d) => d.purpose === 'confirmat' && d.face === 'outer')
      expect(faceHoles.length).toBeGreaterThan(0)
      for (const d of faceHoles) {
        expect(d.y).toBeGreaterThanOrEqual(0)
        expect(d.y).toBeLessThanOrEqual(right.cutWidth)
      }
    },
  )

  it('depthAtRight=350: bottom.edgeW2-дегі торц тесіктері тек x ∈ [250, 600] аралығында (350 мм буын)', () => {
    const panels = generateCabinet(corner(350), catalog)
    const bottom = byId(panels, 'bottom')
    const edgeHoles = bottom.drilling.filter(
      (d) => d.purpose === 'confirmat' && d.face === 'edgeW2',
    )
    expect(edgeHoles.length).toBeGreaterThan(0)
    // Дұрыс буын [250, 600] (350 мм ұзындық), ескі код [0, 600] алатын —
    // сондықтан x ≥ 250 - CONFIRMAT_FIRST_OFFSET шамасынан аз болмауы керек.
    for (const d of edgeHoles) {
      expect(d.x).toBeGreaterThanOrEqual(250)
    }
  })

  it('түзу (тік бұрышты) эталон шкафта присадка ӨЗГЕРМЕЙДІ — қиылыс толық буында толық ұзындықты береді', () => {
    const panels = generateCabinet(referenceWardrobe, refCatalog)
    const side = byId(panels, 'side-left')
    const faceHoles = side.drilling.filter((d) => d.purpose === 'confirmat' && d.face === 'outer')
    // O1 тестінде расталған эталон: 6 бет тесігі (крышка+дно, әрқайсысына 3).
    expect(faceHoles).toHaveLength(6)
    const ys = faceHoles.map((d) => d.y).sort((a, b) => a - b)
    expect(ys.every((y) => y >= 0 && y <= side.cutWidth)).toBe(true)
  })
})
