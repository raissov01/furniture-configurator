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
 *
 * 2026-09-20 (K1/K2, docs/audit/drilling-fix-plan.md): бұрыштық
 * (переходной) корпуста габарит ТІКБҰРЫШ болғанымен, `Panel.bevel` болса
 * НАҒЫЗ пішін трапеция — габариттің ішінде, бірақ кесілгенде жоғалатын
 * үшбұрыш аймақ бар. Төменгі `expectDrillingWithinPanel` енді осыны
 * ескереді (`src/core/bevelBounds.ts`, K2), әрі жаңа `describe` блогы
 * (K1) бұрыштық сценарийлерді қосады: трапеция (екі өлшемде), аяқ, цоколь
 * қорап, соқыр панельді бұрыштық мойка тумбасы (`frontPanel`, кухня
 * генераторының ЕҢ ЖИІ бұрыштық модулі).
 */
import { describe, expect, it } from 'vitest'
import {
  catalogOf, ConfigValidationError, defaultShopProfile, findTemplate, generateCabinet, generateKitchen,
  isWidthBevel, SEED_CATALOG, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, Catalog, Panel } from '../src/core/index'
import { materialWidthRangeAt } from '../src/core/bevelBounds'
import { catalog, referenceWardrobe, threeSectionWardrobe, withCabinet } from './fixtures'

/** materialId → қалыңдық (мм) — торц тесігінің қалыңдық бойынша шегі осыдан. */
const thicknessOf = (panel: Panel, cat: Catalog = catalog): number =>
  cat.materials.find((m) => m.id === panel.materialId)!.thickness

/**
 * Рез координатасы бүтін мм (§0.2), ал K2-дегі трапеция ені (`w(x)`)
 * сызықтық интерполяциядан шыққандықтан бөлшек болуы мүмкін
 * (`src/core/bevelBounds.ts`). ЛДСП кесу төзімі де ±0.5 мм (CLAUDE.md
 * §4.6) — сондықтан 0.6 мм рұқсат етілген қателік, ал нақты ақаулар (бұл
 * файлдағы мутация сынағында да) он-жүздеген мм-ге асып кетеді, яғни бұл
 * төзім оларды ЖАСЫРМАЙДЫ.
 */
const BEVEL_EPS = 0.6

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
 *
 * K2 түзетуі: панельде ЕН бойынша қиғаш болса (`isWidthBevel(panel.bevel)`
 * — бұрыштық корпустың крышкасы/дносы/сөресі/перегородкасы), жоғарыдағы
 * тікбұрыш шегі ЖЕТКІЛІКСІЗ — трапеция кесілгенде жоғалатын аймақ бар:
 *   - `inner`/`outer`: `y` сол `x` нүктесіндегі НАҒЫЗ ен ішінде болуы керек
 *     (`materialWidthRangeAt`), толық `cutWidth` емес;
 *   - `edgeW1`/`edgeW2` (қиғаштың тереңдігі өзгеретін ұш): сол ұштағы
 *     (`x=0` не `x=cutLength`) нағыз енімен шектеледі — қиғаштың тар
 *     ұшында (мыс. `depthAtRight`) толық `cutWidth` емес, тек сол жердегі
 *     тар ен рұқсат етіледі (аудиттің `bottom.edgeW2 x=48` мысалы дәл осы
 *     — рез 598-тің ішінде, бірақ нақты ені ~348-ден аз болатын жерде);
 *   - `edgeL1`/`edgeL2` (ұзындық бойымен жүретін екі жиек) ӨЗГЕРМЕЙДІ:
 *     `alignWidth`-қа сай келетін жиек (мыс. `'end'`-те L2, арт қабырғаға
 *     тірелген) толық `cutLength` бойы түзу жиек, ал қарсы жиек (L1) —
 *     трапецияның ГИПОТЕНУЗАСЫНЫҢ өзі: рез ұзындық осіндегі әр `x`
 *     нүктесі дәл сол диагональ шетте жатады (басқаша болуы мүмкін емес —
 *     диагональ ӘР `x`-те анықталған), сондықтан оның координата шегі де
 *     `[0, cutLength]` — өзгертудің қажеті жоқ. (Гипотенузаның НАҚТЫ,
 *     ұзынырақ физикалық ұзындығы — тек кромка/деталировка есебіне
 *     қатысты, §C10 аудит, бөлек мәселе, присадканың ӨЗ шегіне ЕМЕС.)
 */
function expectDrillingWithinPanel(panel: Panel, cat: Catalog = catalog): void {
  const t = thicknessOf(panel, cat)
  const isBevelPanel = panel.bevel !== undefined && isWidthBevel(panel.bevel)

  for (const d of panel.drilling) {
    const isEdgeFace = d.face !== 'inner' && d.face !== 'outer'
    const alongEdgeMax = d.face === 'edgeW1' || d.face === 'edgeW2' ? panel.cutWidth : panel.cutLength
    let xMin = 0
    let xMax = isEdgeFace ? alongEdgeMax : panel.cutLength
    let yMin = 0
    let yMax = isEdgeFace ? t : panel.cutWidth

    if (isBevelPanel) {
      if (!isEdgeFace) {
        ;[yMin, yMax] = materialWidthRangeAt(panel, d.x)
      } else if (d.face === 'edgeW1') {
        ;[xMin, xMax] = materialWidthRangeAt(panel, 0)
      } else if (d.face === 'edgeW2') {
        ;[xMin, xMax] = materialWidthRangeAt(panel, panel.cutLength)
      }
    }

    const where = `${panel.id} (${panel.label}), ${d.face} тесігі x=${d.x} y=${d.y}, purpose=${d.purpose}`

    expect(d.x, `${where}: x панель шегінен ТЫС (${xMin.toFixed(1)}..${xMax.toFixed(1)})`)
      .toBeGreaterThanOrEqual(xMin - BEVEL_EPS)
    expect(d.x, `${where}: x панель шегінен ТЫС (${xMin.toFixed(1)}..${xMax.toFixed(1)})`)
      .toBeLessThanOrEqual(xMax + BEVEL_EPS)
    expect(d.y, `${where}: y панель шегінен ТЫС (${yMin.toFixed(1)}..${yMax.toFixed(1)})`)
      .toBeGreaterThanOrEqual(yMin - BEVEL_EPS)
    expect(d.y, `${where}: y панель шегінен ТЫС (${yMin.toFixed(1)}..${yMax.toFixed(1)})`)
      .toBeLessThanOrEqual(yMax + BEVEL_EPS)
  }
}

/**
 * Кейбір тіркесім (мыс. аяқ/цоколь-короб + бұрыштық трапеция, §C8/K10)
 * ҚАЗІР не дұрыс бейімделген присадка шығарады, не CLAUDE.md §10 бойынша
 * АЙҚЫН `ConfigValidationError` лақтырады — екеуі де қауіпсіз. Үшінші жол
 * (үнсіз, шектен тыс координата) — ЕМЕС, дәл сол ақауды ұстау үшін бұл
 * көмекші бар.
 */
function expectSafeOrRejected(build: () => Panel[], cat: Catalog = catalog): void {
  let panels: Panel[]
  try {
    panels = build()
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigValidationError)
    return
  }
  for (const panel of panels) expectDrillingWithinPanel(panel, cat)
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

  /**
   * 2026-09-20 (drill-a4): цоколь ҚОРАП + МИНИФИКС буыны — жоғарыдағы
   * конфирмат сценарийінің минификс нұсқасы. Әдейі қосылған: дәл осы
   * сценарийде `generateCabinet.ts`-тегі `minifixJoint(face, side, ctx)`
   * рөлдері ауысқан шақыруы `plinth-left/right`-тың тесіктерін панельден
   * тыс шығаратын (`tests/minifixEdgeFace.test.ts`-те `it.fails` ретінде
   * құжатталған болатын). Бұл тест жалпы тексерудің бөлігі болмағандықтан
   * ақау бұрын осы файлда ұсталмайтын — енді ұсталады, ақау қайта оралса.
   */
  it('цоколь ҚОРАП, МИНИФИКС буыны — plinth-left/right де шегінде (drill-a4)', () => {
    const panels = generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { kind: 'plinth', height: 95, plinthShape: 'box', plinthJoint: 'minifix' },
    }), catalog)
    expect(panels.some((p) => p.id === 'plinth-left')).toBe(true)
    for (const panel of panels) expectDrillingWithinPanel(panel)
  })

  it('цокольсіз эталон шкаф — жалпы тексеру барлық рөлге қолданылады', () => {
    for (const panel of generateCabinet(referenceWardrobe, catalog)) expectDrillingWithinPanel(panel)
  })

  it('үш секциялы шкаф (перегородка, сөре, фасад) — жалпы тексеру', () => {
    for (const panel of generateCabinet(threeSectionWardrobe, catalog)) expectDrillingWithinPanel(panel)
  })
})

/**
 * K1 (docs/audit/drilling-fix-plan.md, docs/audit/corner-2026-09-20.md §5.1)
 * — бұрыштық (переходной) корпус сценарийлері жоғарыдағы жалпы тексеруге
 * ЖОҚ болатын. `corner()` — `tests/corner.test.ts`/`tests/drillK3.test.ts`-
 * тегімен бірдей: ашық переходной модуль (фасадсыз, артсыз, бір секция,
 * реттелетін сөрелер).
 */
describe('K1 — бұрыштық (переходной) корпус, присадка НАҒЫЗ пішіннің ішінде (K2)', () => {
  const cornerCatalog = catalogOf(defaultShopProfile())
  const cornerTemplate = templateToCabinet(findTemplate('wardrobe-penal-600')!, cornerCatalog)

  const corner = (depthAtRight: number, patch: Partial<CabinetConfig> = {}): CabinetConfig => ({
    ...cornerTemplate,
    depth: 600,
    back: { mode: 'none' },
    corner: { depthAtRight },
    sections: [{
      ...cornerTemplate.sections[0]!,
      fronts: null,
      contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
    }],
    ...patch,
  })

  it.each([350, 300])(
    'трапеция corner(600, %i): крышка/дно/сөренің тесіктері ГАБАРИТТЕ ЕМЕС, НАҒЫЗ трапецияда',
    (depthAtRight) => {
      const panels = generateCabinet(corner(depthAtRight), cornerCatalog)
      // Тексерудің өзі ешбір панельді елемей қалмауы үшін: кемінде бір
      // қиғаш панель (bottom) шынымен бар екенін растаймыз.
      const bottom = panels.find((p) => p.id === 'bottom')!
      expect(bottom.bevel && isWidthBevel(bottom.bevel)).toBe(true)
      for (const panel of panels) expectDrillingWithinPanel(panel, cornerCatalog)
    },
  )

  /**
   * Аяқ пен цоколь-короб (§C8/K10 аудит, `docs/audit/drilling-fix-plan.md`)
   * трапецияны МҮЛДЕ БІЛМЕЙТІН детальдар: аудитте өлшенгенде дноның бұранда
   * тесігінің бір бөлігі қиғаш кесілгенде жоғалатын аймаққа түсетін еді
   * (нақты мысал: `bottom, outer (464,70)(464,135)(529,70)(529,135)` —
   * материал y ≥ 204..233-тен басталатын жерде, тесіктер 70/135-те).
   *
   * Бұл жазу жазылып жатқан кезде дәл осы екеуін (K10a аяқ, K10b короб)
   * ЖЕКЕ, ПАРАЛЛЕЛЬ жұмыс АЙҚЫН тыйым салуға (`ConfigValidationError`)
   * ауыстырып жатыр (`tests/cornerK10.test.ts`, тапсырмада аталмаған, кодта
   * табылды) — сондықтан «дұрыс күй» осы екі сценарийде ЕКІ ТҮРЛІ болуы
   * мүмкін: не генерация трапецияға дұрыс бейімделген присадка шығарады,
   * не CLAUDE.md §10 бойынша АЙҚЫН қате лақтырады («жартылай дұрыс
   * присадка — цехта ғана байқалатын ақау, оны шығарғаннан гөрі тоқтаған
   * дұрыс»). Үшінші жол ЖОҚ: үнсіз, шектен тыс координата — әрқашан ақау.
   * `expectSafeOrRejected` дәл осы екеуін қабылдайды, үшінші жолды —
   * ЕМЕС.
   */
  it('аяқ (legs) + бұрыштық: не трапецияға дұрыс бейімделген, не АЙҚЫН тыйым салынған (§C8/K10a)', () => {
    expectSafeOrRejected(
      () => generateCabinet(corner(350, { base: { kind: 'legs', height: 100 } }), cornerCatalog),
      cornerCatalog,
    )
  })

  it('цоколь ҚОРАП (plinthShape: box) + бұрыштық: не дұрыс бейімделген, не АЙҚЫН тыйым салынған (§C8/K10b)', () => {
    expectSafeOrRejected(
      () => generateCabinet(corner(350, { base: { kind: 'plinth', height: 95, plinthShape: 'box' } }), cornerCatalog),
      cornerCatalog,
    )
  })
})

/**
 * K1 — соқыр панельді бұрыштық мойка тумбасы (`CabinetConfig.frontPanel`).
 * `corner` (трапеция) ЕМЕС: корпус ТІКБҰРЫШ күйінде қалады, тек алдыңғы
 * жиектің бір бөлігі тік панельмен жабылады (§C4 аудит, K6 түзетілді).
 * Кухня генераторының (`generateKitchen`) ЕҢ ЖИІ бұрыштық модулі — әр
 * `corner`/`u` кухняда 1 төменгі + 1 үстіңгі осылай жиналады.
 */
describe('K1 — соқыр панельді бұрыштық мойка тумбасы (frontPanel, generateKitchen corner)', () => {
  it('төменгі + үстіңгі бұрыштық мойка тумбасы: присадка шегінде (§C4/C6/C7 түзетілді)', () => {
    const result = generateKitchen(
      { layout: 'corner', lengthA: 3200, lengthB: 2400, sink: true, upper: true },
      SEED_CATALOG,
    )
    const blindCabinets = result.cabinets.filter((c) => c.frontPanel)
    // Сорғыш соқыр панель екеуде де бар болуы керек — тексерудің өзі
    // ешнәрсені елемей қалмауы үшін (төменгі + үстіңгі).
    expect(blindCabinets.length).toBeGreaterThanOrEqual(2)
    for (const cabinet of blindCabinets) {
      for (const panel of generateCabinet(cabinet, SEED_CATALOG)) {
        expectDrillingWithinPanel(panel, SEED_CATALOG)
      }
    }
  })
})
