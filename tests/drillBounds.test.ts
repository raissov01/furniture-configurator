/**
 * Присадка/кесу координатасы панельдің ӨЗ шекарасында жатуы керек — жалпы
 * тексеру, кез келген панель рөліне қолданылады.
 *
 * docs/audit/drilling-2026-09-20.md §R1: цоколь тақтайлары (`plinth`,
 * `plinth-back`) бұрыс бағдармен (`ORIENT_FACING` орнына `ORIENT_UPRIGHT`
 * керек еді) жасалатын, сондықтан ұзындығы (900 мм) БИІКТІККЕ түсіп, оның
 * тесіктері панельден тыс не теріс координатада шығатын.
 *
 * Жұп-салыстыру тестері (мысалы «бір сызықта» деп екі жақтың координатасын
 * теңестіретін тексеру) мұны ҰСТАМАЙДЫ, себебі екі жақ та БІРДЕЙ бұрыс
 * кеңістікте есептеледі де бір-бірімен «сәйкес» болып көрінеді. Ұстайтын
 * жалғыз тексеру — әр тесіктің АБСОЛЮТ координатасын сол панельдің өз
 * өлшемімен салыстыру, төменде.
 */
import { describe, expect, it } from 'vitest'
import { generateCabinet } from '../src/core/index'
import type { Panel } from '../src/core/index'
import { catalog, referenceWardrobe, threeSectionWardrobe, withCabinet } from './fixtures'

/** materialId → қалыңдық (мм) — торц тесігінің қалыңдық бойынша шегі осыдан. */
const thicknessOf = (panel: Panel): number =>
  catalog.materials.find((m) => m.id === panel.materialId)!.thickness

/**
 * Бір панельдің БАРЛЫҚ тесігі сол панельдің шекарасында жатуы керек:
 *   - кең беттер (`inner`/`outer`): 0 ≤ x ≤ cutLength, 0 ≤ y ≤ cutWidth
 *   - торц беттер (`edgeL1`/`edgeL2`): жиек — cutLength бойымен,
 *     қалыңдық — [0, materialThickness] бойымен (types.ts:141 «y қалыңдық бойымен»)
 *   - торц беттер (`edgeW1`/`edgeW2`): жиек — cutWidth бойымен,
 *     қалыңдық — [0, materialThickness] бойымен
 *
 * Бұл CLAUDE.md §4.9 («x,y — панельдің сол-төменгі бұрышынан, РЕЗ
 * координатасында») талабының тікелей тексеруі — қандай панель рөлі
 * болмасын қолданылады, тек цокольге емес.
 */
function expectDrillingWithinPanel(panel: Panel): void {
  const t = thicknessOf(panel)
  for (const d of panel.drilling) {
    const isEdgeFace = d.face !== 'inner' && d.face !== 'outer'
    const alongEdgeMax = d.face === 'edgeW1' || d.face === 'edgeW2' ? panel.cutWidth : panel.cutLength
    const xMax = isEdgeFace ? alongEdgeMax : panel.cutLength
    const yMax = isEdgeFace ? t : panel.cutWidth
    const where = `${panel.id} (${panel.label}), ${d.face} тесігі x=${d.x} y=${d.y}, purpose=${d.purpose}`

    expect(d.x, `${where}: x панель шегінен ТЫС (0..${xMax})`).toBeGreaterThanOrEqual(0)
    expect(d.x, `${where}: x панель шегінен ТЫС (0..${xMax})`).toBeLessThanOrEqual(xMax)
    expect(d.y, `${where}: y панель шегінен ТЫС (0..${yMax})`).toBeGreaterThanOrEqual(0)
    expect(d.y, `${where}: y панель шегінен ТЫС (0..${yMax})`).toBeLessThanOrEqual(yMax)
  }
}

describe('присадка координатасы — әр панельдің өз шегінде (docs/audit/drilling-2026-09-20.md §R1)', () => {
  it('цоколь ҚОРАП, конфирмат буыны — әр панельдің әр тесігі өз шегінде', () => {
    // Аудитте өлшенген нақты жағдай: 900 × 1540 × 700, цоколь 95, короб.
    const panels = generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { kind: 'plinth', height: 95, plinthShape: 'box' },
    }), catalog)
    expect(panels.some((p) => p.id === 'plinth')).toBe(true)
    for (const panel of panels) expectDrillingWithinPanel(panel)
  })

  it('цокольсіз эталон шкаф — жалпы тексеру барлық рөлге қолданылады', () => {
    for (const panel of generateCabinet(referenceWardrobe, catalog)) expectDrillingWithinPanel(panel)
  })

  it('үш секциялы шкаф (перегородка, сөре, фасад) — жалпы тексеру', () => {
    for (const panel of generateCabinet(threeSectionWardrobe, catalog)) expectDrillingWithinPanel(panel)
  })
})
