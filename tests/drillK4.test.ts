/**
 * `docs/audit/corner-2026-09-20.md` §C2 (== `docs/audit/drilling-fix-plan.md`
 * K4) бойынша регрессия тесті.
 *
 * `shelfPinHoles` (`drilling.ts:216`) полкодержатель бағанын СӨРЕНІҢ
 * габаритінен алады (`shelf.finishedWidth`, `shelf.position.z`), ал дұрысы —
 * тесік бұрғыланатын ТІК ПАНЕЛЬДІҢ (`verticalPanel`) өз жиегінен. Бұрыштық
 * шкафта сөре трапеция болғандықтан (`finishedWidth` = сол жақтың толық
 * тереңдігі, 600), ал `side-right` тек 350 мм тереңдікте тұрғандықтан —
 * алдыңғы баған оң бүйірде ТЕРІС координатаға түседі.
 *
 * Дәлел (аудиттен, нақты генерация — repro скриптімен расталды):
 *   corner(350): side-right-тағы шелфPin y мәндері { -215, 311 } — дұрысы
 *   { 35, 311 }. Артқы баған (311) кездейсоқ дұрыс, алдыңғысы (-215) теріс,
 *   панель шегінен ТЫС.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, defaultShopProfile, findTemplate, generateCabinet, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Panel } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const template = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

/** Аудиттегідей ашық переходной модуль: фасадсыз, артсыз, 3 жылжымалы сөре. */
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

describe('K4 — полкодержатель бағаны тік панельдің өз жиегінен (бұрыштық)', () => {
  it('side-right (350 мм тереңдік, сөре 600 мм трапеция): алдыңғы баған теріс ЕМЕС, панель шегінде', () => {
    const panels = generateCabinet(corner(350), catalog)
    const right = byId(panels, 'side-right')
    const pins = right.drilling.filter((d) => d.purpose === 'shelfPin')
    expect(pins.length).toBeGreaterThan(0)

    // Панельдің РЕЗ ені (cutWidth) — тесіктің y осы аралықта жатуы керек.
    for (const d of pins) {
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeLessThanOrEqual(right.cutWidth)
    }

    // Аудитте дәлелденген нақты сан: алдыңғы баған y = 35, артқысы (кездейсоқ
    // дұрыс болғандықтан) 311 күйінде қалуы керек.
    const ys = [...new Set(pins.map((d) => d.y))].sort((a, b) => a - b)
    expect(ys).toEqual([35, 311])
  })

  it('side-left (толық 600 мм тереңдік) — түзетуден кейін де өзгермеуі керек', () => {
    const panels = generateCabinet(corner(350), catalog)
    const left = byId(panels, 'side-left')
    const pins = left.drilling.filter((d) => d.purpose === 'shelfPin')
    const ys = [...new Set(pins.map((d) => d.y))].sort((a, b) => a - b)
    // Сол жақ бүйірдің тереңдігі сөренікімен бірдей (600), сондықтан ескі
    // де, жаңа формула да бірдей нәтиже беруі керек.
    expect(ys).toEqual([35, 561])
  })
})
