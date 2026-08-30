/**
 * DXF экспорты (PHASE-2 A5). Сыртқы кітапханасыз — DXF мәтіндік формат,
 * ал бізге керегі оның шағын бөлігі ғана.
 *
 * Келісімдер:
 *   - өлшем бірлігі миллиметр, $INSUNITS = 4
 *   - координата басы — детальдің сол-төменгі бұрышы, X рез ұзындығы бойымен
 *   - әр диаметрге ЖЕКЕ қабат (DRILL_5, DRILL_7, DRILL_35 …): станок қабатты
 *     аспапқа байлайды, сондықтан диаметрлерді араластыруға болмайды
 */

import type { NestedSheet, NestingResult } from '../nesting'
import type { Drill, Groove, Panel } from '../types'

export const LAYER_OUTLINE = 'OUTLINE'
export const LAYER_GROOVE = 'GROOVE'
export const LAYER_TEXT = 'TEXT'

/** Ø12.5 → "DRILL_12_5" (DXF қабат атауында нүкте болмағаны жөн). */
export function drillLayerName(diameter: number): string {
  return `DRILL_${String(diameter).replace('.', '_')}`
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

function text(layer: string, x: number, y: number, height: number, value: string): Group[] {
  return [g(0, 'TEXT'), g(8, layer), g(10, x), g(20, y), g(30, 0), g(40, height), g(1, value)]
}

export type DxfOptions = {
  /** Тек осы беттегі присадка шығады. Станок детальді бір жағынан бұрғылайды. */
  face?: 'inner' | 'outer'
  /** Мәтін биіктігі, мм */
  textHeight?: number
}

/** Бір панельдің DXF мазмұны. */
export function panelToDxf(panel: Panel, options: DxfOptions = {}): string {
  const face = options.face ?? 'inner'
  const textHeight = options.textHeight ?? 12
  const L = panel.cutLength
  const Wd = panel.cutWidth

  const drills = panel.drilling.filter((d) => d.face === face || isEdgeFace(d.face))
  const grooves = panel.grooves.filter((gr) => gr.face === face)

  const layers = [
    LAYER_OUTLINE,
    ...[...new Set(drills.map((d) => drillLayerName(d.diameter)))].sort(),
    ...(grooves.length > 0 ? [LAYER_GROOVE] : []),
    LAYER_TEXT,
  ]

  const entities: Group[] = [g(0, 'SECTION'), g(2, 'ENTITIES')]

  entities.push(...lwpolyline(LAYER_OUTLINE, [[0, 0], [L, 0], [L, Wd], [0, Wd]], true))

  for (const d of drills) {
    if (isEdgeFace(d.face)) continue // торц тесіктері бөлек операция, контурда салынбайды
    entities.push(...circle(drillLayerName(d.diameter), d.x, d.y, d.diameter / 2))
  }

  for (const gr of grooves) {
    entities.push(...lwpolyline(LAYER_GROOVE, [[gr.x1, gr.y1], [gr.x2, gr.y2]], false))
    // Ені мен тереңдігі сызықтың жанында мәтінмен жүреді: DXF-те паздың
    // параметрін тасымалдайтын стандарт өріс жоқ, ал цехқа ол керек.
    entities.push(
      ...text(LAYER_GROOVE, gr.x1 + 10, gr.y1 + 3, textHeight * 0.6,
        `PAZ ${gr.width}x${gr.depth}`),
    )
  }

  entities.push(
    ...text(LAYER_TEXT, 20, Wd / 2, textHeight,
      `${transliterate(panel.label)} ${panel.qty}x  ${L}x${Wd}x${panel.id}`),
  )

  entities.push(g(0, 'ENDSEC'))

  return render([...header(), ...tables(layers), ...entities, g(0, 'EOF')])
}

function isEdgeFace(face: Drill['face']): boolean {
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
