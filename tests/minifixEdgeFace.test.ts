/**
 * Ақау: `docs/audit/drilling-2026-09-20.md` §R2 — минификс буынының торц тесігі
 * ТҰРАҚТЫ `edgeW1/edgeW2`-ге жазылады, ал ол `edgePanel.orientation`-ға
 * тәуелді болуы керек (`confirmatJoint`-тегідей, `drilling.ts:145-148`).
 *
 * Ящікті тумба (кухня, `kitchen-base-drawers-600`) — қораптың алдыңғы
 * қабырғасы (`s1-b1-drawer-1-wall-front`, ORIENT_FACING) дәл осы қатеге
 * ұшырайды: оның СОЛ/ОҢ тік жиектері — types.ts §76-77 бойынша L1/L2
 * (finishedLength, яғни БИІКТІК, бойымен жүретін жиектер), ал бұрын код
 * тұрақты W-ны жазатын. Дноның (`ORIENT_HORIZONTAL`) буыны кездейсоқ дұрыс
 * шығатынын да қоса тексереміз — регрессияға қорған.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, SEED_CATALOG, findTemplate, generateCabinet, mergeSettings,
  minifixJoint, subtractedThickness, templateToCabinet,
} from '../src/core/index'
import type { Drill, Panel } from '../src/core/index'
import { catalog, withCabinet } from './fixtures'

const config = templateToCabinet(findTemplate('kitchen-base-drawers-600')!, SEED_CATALOG)
const panels = generateCabinet(config, SEED_CATALOG)
const byId = (id: string): Panel => panels.find((p) => p.id === id)!

const bands = new Map(SEED_CATALOG.edgeBands.map((b) => [b.id, b]))
const settings = mergeSettings(undefined, config.settings)

/**
 * Дюбель тесігінің ӘЛЕМДІК биіктігі. Екі панельдің де (қабырға мен бүйір)
 * `orientation.length === 'y'` (биіктік), сондықтан екеуі де БІР формуламен
 * қалпына келтіріледі: `pushFace`/edge-face екеуі де REZ-ке W1 кромкасымен
 * ауысады (drilling.ts:150-155 қара).
 */
function worldHeight(panel: Panel, drill: Drill): number {
  return drill.x + subtractedThickness(panel.edges.W1, bands, settings) + panel.position.y
}

describe('минификс: торц тесігінің жиегі бағдарға сай болуы керек (§R2)', () => {
  const wall = byId('s1-b1-drawer-1-wall-front')
  const sideL = byId('s1-b1-drawer-1-side-l')
  const bottom = byId('s1-b1-drawer-1-bottom')

  it('ORIENT_FACING қабырғада торц тесігі — edgeL1/edgeL2 (сол/оң тік жиек)', () => {
    expect(wall.orientation).toEqual({ length: 'y', width: 'x', thickness: 'z' })
    const edgeHoles = wall.drilling.filter((d) => d.purpose === 'minifix' && d.face.startsWith('edge'))
    expect(edgeHoles.length).toBeGreaterThan(0)
    for (const d of edgeHoles) {
      expect(['edgeL1', 'edgeL2']).toContain(d.face)
    }
  })

  it('ORIENT_HORIZONTAL дноның буыны бұрыннан дұрыс — edgeW1/edgeW2 (регрессияға қорған)', () => {
    expect(bottom.orientation).toEqual({ length: 'x', width: 'z', thickness: 'y' })
    const edgeHoles = bottom.drilling.filter((d) => d.purpose === 'minifix' && d.face.startsWith('edge'))
    expect(edgeHoles.length).toBeGreaterThan(0)
    for (const d of edgeHoles) {
      expect(['edgeW1', 'edgeW2']).toContain(d.face)
    }
  })

  it('ұя мен торц тесігі — бір-біріне сәйкес бүйірде, әлемде БІР биіктікте түйісуі керек', () => {
    const wallDowels = wall.drilling.filter((d) => d.purpose === 'minifix' && d.diameter === 8)
    const sideScrews = sideL.drilling.filter((d) => d.purpose === 'minifix' && d.diameter === 5)
    expect(wallDowels.length).toBeGreaterThan(0)
    expect(sideScrews.length).toBeGreaterThan(0)

    const wallHeights = new Set(wallDowels.map((d) => worldHeight(wall, d)))
    const sideHeights = new Set(sideScrews.map((d) => worldHeight(sideL, d)))
    // Бүйірдегі әр стяжка биіктігі қабырғаның біреуімен ДӘЛ сәйкес келуі керек.
    for (const h of wallHeights) {
      const nearest = Math.min(...[...sideHeights].map((s) => Math.abs(s - h)))
      expect(nearest, `биіктік ${h}`).toBeLessThanOrEqual(0.001)
    }
  })

  /**
   * `confirmatJoint`-те торц бетінің x-і кромка қалыңдығына түзетіледі
   * (drilling.ts:151-155). Жоғарыдағы фикстурада қабырғаның W1 жиегі
   * кромкасыз (0.4 мм-ден төмен де болса шегерілмес еді), сондықтан ол
   * жерде түзету нөлге тең болып, байқалмай қалады. Мұнда 2 мм кромканы
   * қолмен қойып тексереміз: ұяның (`inner` беті) де, дюбельдің (торц беті)
   * де x-і БІР панельдің W1-і арқылы БІРДЕЙ шегерілуі керек — өйткені екеуі
   * де сол физикалық нүкте, тек әр түрлі бетте. Бұрынғы тұрақты
   * `edgeW1/edgeW2`-де шегеру ЖОҚ болатын, сондықтан бұл тест дюбельдің x-і
   * ұяныкінен АЙЫРМАШЫЛЫҒЫН (қате шегеру таңдалса) ұстап қалады.
   */
  it('торц бетінің x-і W1 кромкасына түзетіледі (шегеру, §4.9)', () => {
    const wallClone: Panel = structuredClone(wall)
    const sideClone: Panel = structuredClone(sideL)
    wallClone.edges.W1 = { bandId: 'pvc2-w980' }
    wallClone.drilling = []
    sideClone.drilling = []

    const ctx = {
      thickness: (p: Panel) => (p.id === wallClone.id ? 16 : 18),
      bands,
      settings: mergeSettings(DEFAULT_SETTINGS, config.settings),
    }
    minifixJoint(wallClone, sideClone, ctx)

    const dowel = wallClone.drilling.find((d) => d.purpose === 'minifix' && d.diameter === 8)!
    const cam = wallClone.drilling.find((d) => d.purpose === 'minifix' && d.diameter === 15)!
    expect(dowel).toBeDefined()
    expect(cam).toBeDefined()
    // Шегеру шынымен қолданылғанын да растаймыз (нөл болмауы керек).
    expect(dowel.x).not.toBe(69)
    // Ұя мен дюбель — БІР физикалық биіктік, БІРДЕЙ РЕЗ x болуы керек.
    expect(dowel.x).toBe(cam.x)
  })
})

/**
 * §R2-ден кейінгі коллега ескертуі: `minifixJoint` бұрын `wall.orientation`
 * ЕСКЕРМЕЙТІН — `wall.finishedLength`, `wall.position.y/z` тұрақты
 * ORIENT_FACING деп қатырылатын. Оны да түзеттім: buын осі (`jointAxis`)
 * мен бұранда осі (`screwAxis`) `confirmatJoint`-тегідей `orientation`-нан
 * динамикалық алынады, тіпті ORIENT_UPRIGHT қабырғада да (мыс. цоколь
 * тақтасы) тесік панель шегінде қалады.
 */
function expectDrillingWithinPanel(panel: Panel, materials: { id: string; thickness: number }[]): void {
  const t = materials.find((m) => m.id === panel.materialId)!.thickness
  for (const d of panel.drilling) {
    const isEdgeFace = d.face !== 'inner' && d.face !== 'outer'
    const alongEdgeMax = d.face === 'edgeW1' || d.face === 'edgeW2' ? panel.cutWidth : panel.cutLength
    const xMax = isEdgeFace ? alongEdgeMax : panel.cutLength
    const yMax = isEdgeFace ? t : panel.cutWidth
    const where = `${panel.id} ${d.face} x=${d.x} y=${d.y}`
    expect(d.x, where).toBeGreaterThanOrEqual(0)
    expect(d.x, where).toBeLessThanOrEqual(xMax)
    expect(d.y, where).toBeGreaterThanOrEqual(0)
    expect(d.y, where).toBeLessThanOrEqual(yMax)
  }
}

describe('минификс тесіктері панель шегінде (§R2 кеңейтімі)', () => {
  it('ЯЩИКТІ қорап: wall/side дұрыс рөлмен шақырылады — бәрі шегінде', () => {
    // s1-b1-drawer-1-wall-front/back + side-l/r: минификс дұрыс аргумент
    // ретімен шақырылады (generateCabinet.ts, wall=edge-рөл, side=face-рөл).
    for (const panel of panels) expectDrillingWithinPanel(panel, SEED_CATALOG.materials)
  })

  /**
   * 2026-09-20 түзетілді (drill-a4): бұрын бұл тест `it.fails` болатын —
   * белгілі ақаудың құжатталуы.
   *
   * Цоколь қорабында (`plinthJoint: 'minifix'`) `plinth-left/right`
   * панельдің ТОРЦІ (өз ұзындығының ұшы емес, `boxDepth` осіндегі ұшы)
   * `plinth`/`plinth-back`-тың БЕТІНЕ тіреледі — яғни бұл жерде рөлдер
   * КЕРІСІНШЕ: `side` (бүйір) — «edge» рөлінде (торц тесігі КЕРЕК), ал
   * `wall` (плинт тақтасы) — «face» рөлінде. `generateCabinet.ts` бұрын
   * `minifixJoint(face, side, ctx)` деп шақыратын — аргумент реті
   * `minifixJoint`-тің ЖОРАМАЛЫНА (wall=edge, side=face) СӘЙКЕС ЕМЕС еді.
   *
   * Түзету: `generateCabinet.ts` енді `minifixJoint(side, face, ctx)` деп
   * шақырады (§1246 маңындағы түсініктемені қара) — `drilling.ts`-тегі
   * координата логикасының өзі дұрыс болатын, тек шақыру жердегі аргумент
   * реті бұрыс еді. Енді тест ЖАСЫЛ өтеді.
   */
  it('ЦОКОЛЬ қорабы, минификс: plinth-left/right де шегінде (generateCabinet.ts:1255 түзетілді)', () => {
    const plinthPanels = generateCabinet(withCabinet({
      width: 900, height: 1540, depth: 700,
      base: { kind: 'plinth', height: 95, plinthShape: 'box', plinthJoint: 'minifix' },
    }), catalog)
    for (const panel of plinthPanels) expectDrillingWithinPanel(panel, catalog.materials)
  })
})
