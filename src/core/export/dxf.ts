/**
 * DXF экспорты (PHASE-2 A5). Сыртқы кітапханасыз — DXF мәтіндік формат,
 * ал бізге керегі оның шағын бөлігі ғана.
 *
 * Келісімдер:
 *   - өлшем бірлігі миллиметр, $INSUNITS = 4
 *   - координата басы — детальдің сол-төменгі бұрышы, X рез ұзындығы бойымен
 *   - әр диаметр+ТЕРЕҢДІК жұбына ЖЕКЕ қабат (DRILL_5_D8, DRILL_35_D12_5 …):
 *     станок қабатты аспапқа байлайды, сондықтан диаметрді араластыруға
 *     болмайды. Тереңдік атында болуы МІНДЕТТІ (§O5 аудит,
 *     docs/audit/drilling-2026-09-20.md): Ø35 ілгек ұясы (12.5 мм, соқыр) мен
 *     Ø35 өтпелі тесік бір қабатқа түссе, цех соқыр тесіктің тереңдігімен
 *     өтпелі тесікті бұрғылап, фасатты тесіп жіберуі мүмкін.
 *   - бір файлда ЕКІ БЕТ те бар (§O4 аудит): станок детальді екі рет
 *     бұрғылайды (inner, содан кейін outer), сондықтан inner/outer
 *     қабаттары да БӨЛЕК топта — DRILL_INNER_… / DRILL_OUTER_… — оператор
 *     қай кезде детальді аударатынын қабат атынан біледі. Екі бөлек DXF
 *     файлына БӨЛМЕЙМІЗ: `cnc.ts`/`labels.ts` бір деталь = бір DXF деген
 *     келісімге сүйенеді (файл аты — панельдің идентификаторы), ол осылай
 *     сақталады.
 *   - `OUTLINE`/`CUTOUT` — бір рет кесілетін inner кадр. `outer` операциясы
 *     болса, `OUTLINE_OUTER_REFERENCE`/`CUTOUT_OUTER_REFERENCE` сол пішіннің
 *     аударылған тірек көшірмесі; оны CAM cut операциясына қоспау керек.
 *     Тек `face: 'outer'` сұралса, негізгі OUTLINE/CUTOUT та outer кадрға
 *     аударылады. Асимметриялық bevel, corners (ARC), cutout бірге аударылады.
 */

import { pointOnMachinedFace } from '../faceCoordinates'
import type { NestedSheet, NestingResult } from '../nesting'
import { cutoutBounds } from '../cutouts'
import { subtractedThickness } from '../edges'
import { isWidthBevel } from '../types'
import type { Catalog, ConstructionSettings, Drill, EdgeBand, Groove, Panel } from '../types'

export const LAYER_OUTLINE = 'OUTLINE'
/** Сыртқы бет кадры: reference, CUT операциясына жіберуге болмайды. */
export const LAYER_OUTLINE_OUTER = 'OUTLINE_OUTER_REFERENCE'
export const LAYER_CUTOUT_OUTER = 'CUTOUT_OUTER_REFERENCE'
export const LAYER_GROOVE = 'GROOVE'
export const LAYER_GROOVE_OUTER = 'GROOVE_OUTER'
/** Фасадтың беттік өрнегі — БӨЛЕК қабат: ол контур емес, кесуге жатпайды. */
export const LAYER_MILLING = 'MILLING'
export const LAYER_TEXT = 'TEXT'

/**
 * Ø35, тереңдігі 12.5, inner бет → "DRILL_INNER_35_D12_5" (DXF қабат
 * атауында нүкте болмағаны жөн).
 *
 *   - тереңдік МІНДЕТТІ түрде атында: бір диаметрдің соқыр (мыс. ілгек
 *     ұясы) және өтпелі нұсқасын бір қабатқа қосуға болмайды (§O5 аудит);
 *   - `face` берілсе, атына қосылады: inner мен outer бір диаметр+тереңдік
 *     жұбын пайдаланса да (мыс. симметриялы конфирмат), олар БӨЛЕК
 *     қабатта қалады — станок операторы қай бетті бұрғылап жатқанын
 *     қабат атынан біледі (§O4 аудит). Торц тесіктері (edgeL1 …) үшін
 *     `face` берілмейді — олар контурда салынбайды, бөлек топтың қажеті
 *     жоқ.
 */
export function drillLayerName(diameter: number, depth: number, face?: 'inner' | 'outer'): string {
  const fmt = (n: number) => String(n).replace('.', '_')
  const facePart = face ? `${face.toUpperCase()}_` : ''
  return `DRILL_${facePart}${fmt(diameter)}_D${fmt(depth)}`
}

type Group = [number, string | number]

const g = (code: number, value: string | number): Group => [code, value]

function render(groups: Group[]): string {
  const out: string[] = []
  for (const [code, value] of groups) {
    out.push(String(code))
    out.push(typeof value === 'number' ? formatNumber(value) : value)
  }
  return out.join('\n') + '\n'
}

/** DXF-те сан нүктелі бөлшекпен жазылады, экспоненциалды жазусыз. */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0')
}

function header(): Group[] {
  return [
    g(0, 'SECTION'), g(2, 'HEADER'),
    // 4 = миллиметр. Мұны қоймасаң, CAM пакеті дюйм деп оқып, детальді
    // 25.4 есе үлкейтіп жібереді.
    g(9, '$INSUNITS'), g(70, 4),
    g(9, '$MEASUREMENT'), g(70, 1),
    g(0, 'ENDSEC'),
  ]
}

function tables(layers: string[]): Group[] {
  const out: Group[] = [
    g(0, 'SECTION'), g(2, 'TABLES'),
    g(0, 'TABLE'), g(2, 'LAYER'), g(70, layers.length),
  ]
  layers.forEach((name, i) => {
    out.push(
      g(0, 'LAYER'), g(2, name), g(70, 0),
      g(62, 1 + (i % 7)), // түс — тек көзбен ажырату үшін
      g(6, 'CONTINUOUS'),
    )
  })
  out.push(g(0, 'ENDTAB'), g(0, 'ENDSEC'))
  return out
}

function lwpolyline(layer: string, points: [number, number][], closed: boolean): Group[] {
  const out: Group[] = [
    g(0, 'LWPOLYLINE'), g(8, layer), g(90, points.length), g(70, closed ? 1 : 0),
  ]
  for (const [x, y] of points) out.push(g(10, x), g(20, y))
  return out
}

function circle(layer: string, x: number, y: number, radius: number): Group[] {
  return [g(0, 'CIRCLE'), g(8, layer), g(10, x), g(20, y), g(30, 0), g(40, radius)]
}

/**
 * Доға: бұрыштарды дөңгелектеу үшін. Бұрыштар ГРАДУСПЕН, DXF стандарты
 * дәл солай күтеді, әрі сағат тіліне ҚАРСЫ саналады.
 */
function arc(
  layer: string, x: number, y: number, radius: number, startDeg: number, endDeg: number,
): Group[] {
  return [
    g(0, 'ARC'), g(8, layer), g(10, x), g(20, y), g(30, 0), g(40, radius),
    g(50, startDeg), g(51, endDeg),
  ]
}

/** Айна доғаның бағытын терістейді, сондықтан start/end орын ауыстырады. */
function reflectedArcAngle(angle: number, axis: 'length' | 'width'): number {
  const raw = axis === 'length' ? -angle : 180 - angle
  return ((raw % 360) + 360) % 360
}

function text(layer: string, x: number, y: number, height: number, value: string): Group[] {
  return [g(0, 'TEXT'), g(8, layer), g(10, x), g(20, y), g(30, 0), g(40, height), g(1, value)]
}

export type DxfOptions = {
  /**
   * Қай бет(тер) шығады. Әдепкі — `'both'`: inner мен outer бір файлда,
   * бөлек қабат топтарында (`DRILL_INNER_…` / `DRILL_OUTER_…`). §O4 аудит:
   * бұрын әдепкі тек `'inner'` еді, ал бірде бір нақты шақырушы `'outer'`
   * бермейтін — соның салдарынан outer беттегі тесіктер (конфирмат бас
   * жағы, аяқ, тұтқа) және фрезеровка (тек outer кезде қосылады) DXF-ке
   * мүлде түспей тұрды. Нақты бір бетті керек қылатын шақырушы (мыс. екі
   * бөлек операциямен жұмыс істейтін станок) `'inner'`/`'outer'` беріп,
   * ескі мінезді сақтай алады.
   * `'outer'` жеке файлында OUTLINE/CUTOUT сыртқы бет кадрында болады.
   */
  face?: 'inner' | 'outer' | 'both'
  /** Мәтін биіктігі, мм */
  textHeight?: number
  /**
   * Оймалардың готовый→рез координатасын присадкамен (`cutOrigin`,
   * drilling.ts) БІР ЖҮЙЕДЕ есептеу үшін керек (§O6 аудит). Панельде ойма
   * (`cutouts`) жоқ болса, қажеті жоқ. Ойма бар да, осы екеуі берілмесе —
   * ҚАТЕ шығады: симметриялы (қате) есеппен үнсіз жалғастырғаннан гөрі
   * дұрыс, себебі бұл — мойка/розетка ойымының жиекке 1-2 мм жылжуы,
   * жиналғанда байқалатын дефект.
   */
  catalog?: Catalog
  settings?: ConstructionSettings
}

/** Бір панельдің DXF мазмұны. */
export function panelToDxf(panel: Panel, options: DxfOptions = {}): string {
  const requestedFace = options.face ?? 'both'
  const faces: ('inner' | 'outer')[] = requestedFace === 'both' ? ['inner', 'outer'] : [requestedFace]
  const textHeight = options.textHeight ?? 12
  const L = panel.cutLength
  const Wd = panel.cutWidth

  /*
   * Торц тесіктерін (edgeL1 …) ӘДЕЙІ КІРГІЗБЕЙМІЗ: олар контурда салынбайды
   * (төмендегі entity циклінде `isEdgeFace` арқылы өткізіп жіберіледі),
   * сондықтан LAYER кестесіне де түспеуі керек — әйтпесе іші бос қабат
   * («DRILL_5_D35» сияқты, face жоқ болғандықтан INNER_/OUTER_ префиксі де
   * жоқ) пайда болады да, оператор оны ашса ештеңе жоқ (Аудит Y7,
   * docs/audit/drilling-2026-09-20.md).
   */
  const drills = panel.drilling.filter((d) => !isEdgeFace(d.face) && faces.includes(d.face))
  const grooves = panel.grooves.filter((gr) => faces.includes(gr.face))
  // Өрнек ӘРҚАШАН сыртқы бетте: оны клиент көреді, ал ішкі бетте
  // фрезерлеудің мағынасы жоқ. `outer` сұралмаса (мыс. тек `face: 'inner'`),
  // шығармаймыз — сол жағдайда бұл файл inner бет үшін ғана.
  const milling = faces.includes('outer') ? panel.milling : []
  // Негізгі OUTLINE/CUTOUT — нақты бір рет кесілетін inner кадр. OUTER
  // операциясына бөлек айна reference қабаты керек; әйтпесе трапецияда
  // тесіктер бір кадрда, контур басқа кадрда қалып кетеді.
  const outerOperation = faces.includes('outer') && (
    drills.some((d) => d.face === 'outer') ||
    grooves.some((groove) => groove.face === 'outer') || milling.length > 0
  )
  const outerOnly = requestedFace === 'outer'
  const outerFrame = outerOnly || (requestedFace === 'both' && outerOperation)
  const flipAxis = options.settings?.outerFlipAxis ?? 'length'
  const framePoint = (x: number, y: number, outer: boolean): [number, number] => {
    if (!outer) return [x, y]
    const point = pointOnMachinedFace(panel, { face: 'outer', x, y }, flipAxis)
    return [point.x, point.y]
  }

  // §O6 аудит: присадка cutOrigin арқылы готовый→рез аударуды ТЕК W1/L1
  // кромкасынан шегереді (симметриялы емес — drilling.ts:455-463 қара).
  // Ойма да дәл сол жүйеде болуы керек, әйтпесе екеуінің координатасы
  // 1-2 мм алшақтап кетеді.
  const cutOrigin = { x: 0, y: 0 }
  if (panel.cutouts.length > 0) {
    if (!options.catalog || !options.settings) {
      throw new Error(
        `panelToDxf: «${panel.id}» панелінде ойма бар, DXF-ке рез координатасын дұрыс ` +
        'шығару үшін options.catalog мен options.settings керек (§O6 аудит) — ' +
        'үнсіз симметриялы есеппен жалғастыру мойка/розетка ойымын 1-2 мм жылжытып жіберуі мүмкін.',
      )
    }
    const bands: Map<string, EdgeBand> = new Map(options.catalog.edgeBands.map((b) => [b.id, b]))
    cutOrigin.x = subtractedThickness(panel.edges.W1, bands, options.settings)
    cutOrigin.y = subtractedThickness(panel.edges.L1, bands, options.settings)
  }

  const layers = [
    LAYER_OUTLINE,
    ...(outerFrame && !outerOnly ? [LAYER_OUTLINE_OUTER] : []),
    ...[...new Set(drills.map((d) => drillLayerName(d.diameter, d.depth, isEdgeFace(d.face) ? undefined : d.face)))]
      .sort(),
    ...(grooves.some((groove) => groove.face === 'inner') ? [LAYER_GROOVE] : []),
    ...(grooves.some((groove) => groove.face === 'outer') ? [LAYER_GROOVE_OUTER] : []),
    ...(milling.length > 0 ? [LAYER_MILLING] : []),
    ...(panel.cutouts.length > 0 ? [LAYER_CUTOUT] : []),
    ...(panel.cutouts.length > 0 && outerFrame && !outerOnly ? [LAYER_CUTOUT_OUTER] : []),
    LAYER_TEXT,
  ]

  const entities: Group[] = [g(0, 'SECTION'), g(2, 'ENTITIES')]

  // Негізгі кадр нақты кесуге арналған. Екінші кадр — outer операцияны
  // орналастыруға арналған reference, CAM-да кесу қабатына қосылмайды.
  const outlineFrames: { layer: string; outer: boolean }[] = outerOnly
    ? [{ layer: LAYER_OUTLINE, outer: true }]
    : [{ layer: LAYER_OUTLINE, outer: false },
      ...(outerFrame ? [{ layer: LAYER_OUTLINE_OUTER, outer: true }] : [])]
  for (const { layer: outlineLayer, outer } of outlineFrames) {
  // Қиғаш деталь: контур ТРАПЕЦИЯ болып шығады. Өлшемі (L × Wd) —
  // ЗАГОТОВКАНЫҢ габариті, ал станок осы контур бойынша кеседі.
  if (panel.bevel && isWidthBevel(panel.bevel)) {
    // Ен ұзындық бойымен өзгереді (бұрыштық корпустың крышкасы).
    const shrink = panel.finishedWidth - Wd
    const w0 = Math.max(0, panel.bevel.widthAtStart - shrink)
    const w1 = Math.max(0, panel.bevel.widthAtEnd - shrink)
    // `alignWidth` материал ен осінің қай ұшына тірелетінін айтады.
    const points: [number, number][] = panel.bevel.alignWidth === 'end'
      ? [[0, Wd - w0], [L, Wd - w1], [L, Wd], [0, Wd]]
      : [[0, 0], [L, 0], [L, w1], [0, w0]]
    entities.push(...lwpolyline(outlineLayer, points.map(([x, y]) => framePoint(x, y, outer)), true))
  } else if (panel.bevel) {
    // Кромка рез өлшемін қысқартады — қиғаштың екі ұшы да сонша қысқарады.
    const shrink = panel.finishedLength - L
    const startX = Math.max(0, panel.bevel.lengthAtStart - shrink)
    const endX = Math.max(0, panel.bevel.lengthAtEnd - shrink)
    entities.push(
      ...lwpolyline(outlineLayer, [[0, 0], [startX, 0], [endX, Wd], [0, Wd]]
        .map(([x, y]) => framePoint(x!, y!, outer)), true),
    )
  } else if (panel.corners && Object.values(panel.corners).some((r) => r > 0)) {
    /*
     * Дөңгелектелген бұрыш: контур ТҮЗУ кесінділер мен ДОҒАЛАРДАН құралады.
     * Бір LWPOLYLINE-ға сыйғызуға болар еді (bulge арқылы), бірақ ескі
     * оқығыштар bulge-ті елемей, бұрышты кесіп жібереді — сонда цех тікбұрыш
     * фрезерлейді. ARC — бәрі бірдей түсінетін нәрсе.
     *
     * Радиус РЕЗ өлшемінде қолданылады: станок соны кеседі.
     */
    const r = {
      bl: Math.min(panel.corners.bottomLeft, L / 2, Wd / 2),
      br: Math.min(panel.corners.bottomRight, L / 2, Wd / 2),
      tr: Math.min(panel.corners.topRight, L / 2, Wd / 2),
      tl: Math.min(panel.corners.topLeft, L / 2, Wd / 2),
    }
    const segments: [number, number][][] = [
      [[r.bl, 0], [L - r.br, 0]],
      [[L, r.br], [L, Wd - r.tr]],
      [[L - r.tr, Wd], [r.tl, Wd]],
      [[0, Wd - r.tl], [0, r.bl]],
    ]
    for (const [from, to] of segments) {
      if (from![0] !== to![0] || from![1] !== to![1]) {
        entities.push(...lwpolyline(outlineLayer,
          [from!, to!].map(([x, y]) => framePoint(x, y, outer)), false))
      }
    }
    const arcs: [number, number, number, number, number][] = [
      [r.bl, r.bl, r.bl, 180, 270],
      [L - r.br, r.br, r.br, 270, 360],
      [L - r.tr, Wd - r.tr, r.tr, 0, 90],
      [r.tl, Wd - r.tl, r.tl, 90, 180],
    ]
    for (const [cx, cy, radius, start, end] of arcs) {
      if (radius > 0) {
        const [ax, ay] = framePoint(cx, cy, outer)
        const startAngle = outer ? reflectedArcAngle(end, flipAxis) : start
        const endAngle = outer ? reflectedArcAngle(start, flipAxis) : end
        entities.push(...arc(outlineLayer, ax, ay, radius, startAngle, endAngle))
      }
    }
  } else {
    entities.push(...lwpolyline(outlineLayer, [[0, 0], [L, 0], [L, Wd], [0, Wd]]
      .map(([x, y]) => framePoint(x!, y!, outer)), true))
  }
  }

  for (const d of drills) {
    if (isEdgeFace(d.face)) continue // торц тесіктері бөлек операция, контурда салынбайды
    const point = pointOnMachinedFace(panel, d, options.settings?.outerFlipAxis ?? 'length')
    entities.push(...circle(drillLayerName(d.diameter, d.depth, d.face), point.x, point.y, d.diameter / 2))
  }

  for (const gr of grooves) {
    const grooveLayer = gr.face === 'outer' ? LAYER_GROOVE_OUTER : LAYER_GROOVE
    const p1 = pointOnMachinedFace(panel, { face: gr.face, x: gr.x1, y: gr.y1 }, options.settings?.outerFlipAxis ?? 'length')
    const p2 = pointOnMachinedFace(panel, { face: gr.face, x: gr.x2, y: gr.y2 }, options.settings?.outerFlipAxis ?? 'length')
    entities.push(...lwpolyline(grooveLayer, [[p1.x, p1.y], [p2.x, p2.y]], false))
    // Ені мен тереңдігі сызықтың жанында мәтінмен жүреді: DXF-те паздың
    // параметрін тасымалдайтын стандарт өріс жоқ, ал цехқа ол керек.
    entities.push(
      ...text(grooveLayer, p1.x + 10, p1.y + 3, textHeight * 0.6,
        `PAZ ${gr.width}x${gr.depth}`),
    )
  }

  /*
   * Оймалар — БӨЛЕК қабатта. Себебі станокта бұл бөлек операция: контурды
   * ара кеседі, ойманы фреза алады. Бір қабатқа қоссақ, оператор ойманы
   * контурдың бір бөлігі деп оқып, детальді қиып жіберуі мүмкін.
   *
   * Координата РЕЗ детальінде: кромка шегерілген жиектен саналады. Шегеру
   * присадкамен БІРДЕЙ: тек W1 (x) / L1 (y) кромкасы, симметриялы ЕМЕС
   * (§O6, `cutOrigin` жоғарыда).
   */
  for (const cutout of panel.cutouts) {
    const bounds = cutoutBounds(cutout, panel.finishedLength, panel.finishedWidth)
    const x = bounds.x - cutOrigin.x
    const y = bounds.y - cutOrigin.y
    const cutoutFrames: { layer: string; outer: boolean }[] = outerOnly
      ? [{ layer: LAYER_CUTOUT, outer: true }]
      : [{ layer: LAYER_CUTOUT, outer: false },
        ...(outerFrame ? [{ layer: LAYER_CUTOUT_OUTER, outer: true }] : [])]
    for (const { layer, outer } of cutoutFrames) {
      if (cutout.shape === 'circle') {
        const [cx, cy] = framePoint(x + bounds.width / 2, y + bounds.height / 2, outer)
        entities.push(...circle(layer, cx, cy, cutout.diameter / 2))
      } else {
        entities.push(...lwpolyline(layer, [
          [x, y], [x + bounds.width, y], [x + bounds.width, y + bounds.height], [x, y + bounds.height],
        ].map(([px, py]) => framePoint(px!, py!, outer)), true))
      }
    }
  }

  for (const path of milling) {
    entities.push(
      ...lwpolyline(LAYER_MILLING, path.points.map((pt) => {
        const point = pointOnMachinedFace(panel, { face: 'outer', x: pt.x, y: pt.y }, options.settings?.outerFlipAxis ?? 'length')
        return [point.x, point.y] as [number, number]
      }), path.closed),
    )
  }

  entities.push(
    ...text(LAYER_TEXT, 20, Wd / 2, textHeight,
      `${transliterate(panel.label)} ${panel.qty}x  ${L}x${Wd}x${panel.id}`),
  )

  entities.push(g(0, 'ENDSEC'))

  return render([...header(), ...tables(layers), ...entities, g(0, 'EOF')])
}

function isEdgeFace(face: Drill['face']): face is Exclude<Drill['face'], 'inner' | 'outer'> {
  return face !== 'inner' && face !== 'outer'
}

/**
 * DXF-тің ескі оқығыштары кириллицаны бұзады, ал цехтағы станок дәл сондай
 * болуы мүмкін. Сондықтан мәтін латынға аударылады.
 */
export function transliterate(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u',
    һ: 'h', і: 'i',
  }
  return [...value]
    .map((ch) => {
      const lower = ch.toLowerCase()
      const mapped = map[lower]
      if (mapped === undefined) return ch
      return ch === lower ? mapped : mapped.toUpperCase()
    })
    .join('')
}

/** Әр панельге бір файл: аты → мазмұны. */
export function cabinetToDxfFiles(panels: Panel[], options?: DxfOptions): Map<string, string> {
  const files = new Map<string, string>()
  for (const panel of panels) {
    files.set(`${panel.id}.dxf`, panelToDxf(panel, options))
  }
  return files
}

// ── Раскрой картасы ──────────────────────────────────────────────────────────

/** Ойма — контурдан БӨЛЕК қабат: станокта ол бөлек операция. */
export const LAYER_CUTOUT = 'CUTOUT'

export const LAYER_SHEET = 'SHEET'
export const LAYER_USABLE = 'USABLE'
export const LAYER_PART = 'PART'
export const LAYER_OFFCUT = 'OFFCUT'

/**
 * Бір парақтың раскрой картасы.
 *
 * Бұл — деталь файлы ЕМЕС: мұнда присадка да, паз да жоқ. Оператор параққа
 * не қалай жататынын көреді, ал кесу бағдарламасын осыдан жасайды. Сондықтан
 * әр нәрсе бөлек қабатта: парақ контуры, подрезкадан кейінгі аймақ, детальдар,
 * деловой отход.
 */
export function nestedSheetToDxf(sheet: NestedSheet, materialName: string): string {
  const layers = [LAYER_SHEET, LAYER_USABLE, LAYER_PART, LAYER_OFFCUT, LAYER_TEXT]
  const entities: Group[] = [g(0, 'SECTION'), g(2, 'ENTITIES')]

  const rect = (layer: string, x: number, y: number, w: number, h: number): Group[] =>
    lwpolyline(layer, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true)

  entities.push(...rect(LAYER_SHEET, 0, 0, sheet.sheetWidth, sheet.sheetHeight))
  entities.push(...rect(LAYER_USABLE, sheet.usable.x, sheet.usable.y, sheet.usable.width, sheet.usable.height))

  for (const part of sheet.parts) {
    entities.push(...rect(LAYER_PART, part.x, part.y, part.width, part.height))
    // Мәтін детальдің ішінде, сол-төменгі бұрышынан сәл шегініп тұрады.
    entities.push(
      ...text(LAYER_TEXT, part.x + 15, part.y + 15, Math.min(40, part.height / 4),
        `${transliterate(part.label)} ${part.width}x${part.height}`),
    )
  }

  for (const off of sheet.offcuts) {
    entities.push(...rect(LAYER_OFFCUT, off.x, off.y, off.width, off.height))
    entities.push(
      ...text(LAYER_OFFCUT, off.x + 15, off.y + 15, Math.min(40, off.height / 4),
        `OSTATOK ${off.width}x${off.height}`),
    )
  }

  entities.push(
    ...text(LAYER_TEXT, 0, sheet.sheetHeight + 40, 60,
      `${transliterate(materialName)}  LIST ${sheet.index}  ${sheet.sheetWidth}x${sheet.sheetHeight}`),
  )

  entities.push(g(0, 'ENDSEC'))
  return render([...header(), ...tables(layers), ...entities, g(0, 'EOF')])
}

/** Әр параққа бір файл: аты → мазмұны. */
export function nestingToDxfFiles(nesting: NestingResult): Map<string, string> {
  const files = new Map<string, string>()
  for (const group of nesting.byMaterial) {
    for (const sheet of group.sheets) {
      const name = `${transliterate(group.materialId)}-list-${sheet.index}.dxf`
      files.set(name, nestedSheetToDxf(sheet, group.materialName))
    }
  }
  return files
}
