/**
 * DXF импорты — ТЕК 2D жоспар (PHASE-2 «free-form editor», DXF импорты).
 *
 * Цехта нақты керек жағдай: сәулетшіден не клиенттен бөлменің жоспары DXF
 * болып келеді. Мұнда оны оқып, қабырғаларды (кесінділерді) шығарамыз —
 * жиһазды ЕМЕС, тек контурды (`docs/pro100/parity.md`: PRO100-дың
 * `TDXFFORM` диалогына сәйкес қамту).
 *
 * Сыртқы кітапханасыз: DXF ASCII форматта — топтық код / мән жұптарынан
 * тұратын жәй мәтін, ал бізге керегі соның шағын бөлігі ғана (§2, CLAUDE.md:
 * тәуелділік қоспас бұрын себебін айту керек — мұнда тіпті қосу қажеті жоқ).
 *
 * Қамту:
 *   - нысандар: LINE, LWPOLYLINE, POLYLINE (+VERTEX/SEQEND), CIRCLE, ARC;
 *   - қабат (LAYER, топтық код 8) бойынша сүзу — пайдаланушы таңдайды;
 *   - $INSUNITS арқылы мм-ге қайта санау (дюйм/фут/см/м); белгісіз бірлік —
 *     ҚАТЕ (үнсіз болжам қауіпті: масштаб қатесі бөлмені ондаған есе
 *     үлкейтіп/кішірейтіп жіберуі мүмкін);
 *   - барлық өлшем — CLAUDE.md §0.2 бойынша БҮТІН мм.
 *
 * ЖОҚ (бөлек спек): 3D модель импорты, INSERT (блок) толық қолдауы,
 * SPLINE, TEXT/MTEXT. Кездессе — еленбей өтеді, саны `skipped`-те
 * хабарланады (§10: тыныш жұтылмайды).
 *
 * Бинарлы DXF қолдамаймыз (қарапайым мәтіндік талдағыш оны оқи алмайды) —
 * анық қатемен, сынған нәтижемен емес.
 */

import { ConfigValidationError } from '../errors'

// ── Төменгі деңгей: топтық код / мән жұптары ────────────────────────────────

export type RawGroup = { code: number; value: string }

/** Бинарлы DXF-тің стандартты сигнатурасы (AutoCAD-тың өз спецификациясы). */
const BINARY_SENTINEL = 'AutoCAD Binary DXF'

function assertNotBinary(text: string): void {
  if (text.startsWith(BINARY_SENTINEL) || text.slice(0, 32).includes('\u0000')) {
    throw new ConfigValidationError(
      'dxf.format',
      'бинарлы DXF (AutoCAD Binary DXF) — қарапайым мәтіндік талдағыш оны оқи алмайды',
      'ASCII DXF (мәтіндік, топтық код/мән жұп)',
    )
  }
}

/** Мәтінді топтық код / мән жұптарына бөледі. Тек ASCII DXF үшін. */
function tokenize(text: string): RawGroup[] {
  const lines = text.split(/\r\n|\r|\n/)
  // Файл соңындағы бос жолдар (EOF алдындағы келтіру) кедергі жасамайды.
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()

  if (lines.length === 0) {
    throw new ConfigValidationError('dxf.content', 'файл бос', 'кемінде бір SECTION/ENTITIES блогы')
  }
  if (lines.length % 2 !== 0) {
    throw new ConfigValidationError(
      'dxf.content',
      `файл аяқталмаған: соңғы топтық кодтың (жол ${lines.length}, «${lines[lines.length - 1]!.trim()}») мәні жоқ`,
      'жұп жол саны (топтық код + мән)',
    )
  }

  const groups: RawGroup[] = []
  for (let i = 0; i < lines.length; i += 2) {
    const codeRaw = lines[i]!.trim()
    const code = Number(codeRaw)
    if (!Number.isFinite(code) || codeRaw === '') {
      throw new ConfigValidationError(
        `dxf.line[${i + 1}]`,
        `топтық код сан емес («${codeRaw}»)`,
        'бүтін сан (DXF топтық код)',
      )
    }
    groups.push({ code, value: lines[i + 1]!.trim() })
  }
  return groups
}

// ── Секциялар мен нысандарға бөлу ───────────────────────────────────────────

export type DxfEntity = {
  type: string
  groups: RawGroup[]
  /** Тек POLYLINE үшін: әр VERTEX-тің өз тобы (SEQEND-ке дейін). */
  vertices?: RawGroup[][]
}

export type Parsed = {
  /** $INSUNITS мәні — код (4 = мм, 5 = см, ...). Жоқ болса `undefined`. */
  insunits: number | undefined
  entities: DxfEntity[]
}

export function findValue(groups: RawGroup[], code: number): string | undefined {
  return groups.find((g) => g.code === code)?.value
}

/** SECTION/ENDSEC шекараларын тауып, ENTITIES ішіндегі топтарды, HEADER-дегі $INSUNITS-ты бөліп алады. */
function parseSections(groups: RawGroup[]): Parsed {
  let insunits: number | undefined
  const entityGroups: RawGroup[] = []
  let section: string | null = null

  let i = 0
  while (i < groups.length) {
    const g = groups[i]!

    if (g.code === 9 && g.value === '$INSUNITS' && groups[i + 1]?.code === 70) {
      insunits = Number(groups[i + 1]!.value)
      i += 2
      continue
    }
    if (g.code === 0 && g.value === 'SECTION') {
      section = groups[i + 1]?.code === 2 ? groups[i + 1]!.value : null
      i += 2
      continue
    }
    if (g.code === 0 && g.value === 'ENDSEC') {
      section = null
      i += 1
      continue
    }
    if (section === 'ENTITIES') entityGroups.push(g)
    i += 1
  }

  if (entityGroups.length === 0) {
    throw new ConfigValidationError(
      'dxf.ENTITIES',
      'DXF файлында ENTITIES секциясы табылмады (не бос)',
      'SECTION/2/ENTITIES блогы, ішінде кемінде бір нысан',
    )
  }

  return { insunits, entities: foldPolylines(groupEntities(entityGroups)) }
}

/** ENTITIES ішіндегі жалпақ топтар тізімін код-0 шекаралары бойынша нысандарға бөледі. */
function groupEntities(entityGroups: RawGroup[]): DxfEntity[] {
  const entities: DxfEntity[] = []
  let current: DxfEntity | null = null
  for (const g of entityGroups) {
    if (g.code === 0) {
      if (current) entities.push(current)
      current = { type: g.value, groups: [] }
    } else if (current) {
      current.groups.push(g)
    }
  }
  if (current) entities.push(current)
  return entities
}

/** Ескі стильдегі POLYLINE — өз VERTEX-терін SEQEND-ке дейін жеке нысан ретінде береді, соларды жинап қосамыз. */
function foldPolylines(entities: DxfEntity[]): DxfEntity[] {
  const out: DxfEntity[] = []
  let i = 0
  while (i < entities.length) {
    const e = entities[i]!
    if (e.type !== 'POLYLINE') {
      out.push(e)
      i += 1
      continue
    }
    const vertices: RawGroup[][] = []
    let j = i + 1
    while (j < entities.length && entities[j]!.type === 'VERTEX') {
      vertices.push(entities[j]!.groups)
      j += 1
    }
    if (j < entities.length && entities[j]!.type === 'SEQEND') j += 1
    out.push({ type: 'POLYLINE', groups: e.groups, vertices })
    i = j
  }
  return out
}

// ── Өлшем бірлігі ────────────────────────────────────────────────────────────

/**
 * $INSUNITS коды → мм коэффициенті. Тек цехта нақты кездесетін бірліктер.
 * 0 (белгісіз/анықталмаған) — жобаның конвенциясы бойынша мм деп есептеледі
 * (сәулетші DXF-і әдетте мм-де келеді); басқа код кестеде жоқ болса —
 * ҚАТЕ, үнсіз болжам қауіпті (масштаб қатесі бөлмені ондаған есе бұрмалайды).
 */
const UNIT_MM_FACTOR: Record<number, number> = {
  0: 1, // белгісіз — мм деп есептейміз
  1: 25.4, // дюйм
  2: 304.8, // фут
  4: 1, // мм
  5: 10, // см
  6: 1000, // м
}

export function unitFactor(insunits: number | undefined): { factor: number; converted: boolean; source: number } {
  const code = insunits ?? 0
  const factor = UNIT_MM_FACTOR[code]
  if (factor === undefined) {
    throw new ConfigValidationError(
      '$INSUNITS',
      `қолдау жоқ өлшем бірлігі коды: ${code}`,
      Object.keys(UNIT_MM_FACTOR).join('/'),
    )
  }
  return { factor, converted: factor !== 1, source: code }
}

// ── Геометрия ────────────────────────────────────────────────────────────────

export type DxfPoint = { x: number; z: number }

export type DxfWallSegment = {
  /** DXF қабатының аты (топтық код 8) */
  layer: string
  start: DxfPoint
  end: DxfPoint
  /** Ұзындығы, бүтін мм (CLAUDE.md §0.2) */
  length: number
}

export type DxfCircle = { layer: string; center: DxfPoint; radius: number }
export type DxfArc = { layer: string; center: DxfPoint; radius: number; startAngleDeg: number; endAngleDeg: number }

export type DxfSkippedEntity = { type: string; count: number }

export type DxfImportOptions = {
  /** Тек осы қабаттағы нысандар оқылады. Берілмесе — бәрі. */
  layer?: string
}

export type DxfImportResult = {
  walls: DxfWallSegment[]
  circles: DxfCircle[]
  arcs: DxfArc[]
  /** Файлдағы БАРЛЫҚ қабат аттары (сүзгіге қарамастан) — пайдаланушы таңдауы үшін. */
  layers: string[]
  /** Қабырғалардың АЖШ (bounding box), мм. Қабырға болмаса — `null`. */
  bounds: { width: number; depth: number } | null
  /** Қолдау жоқ нысандар: түрі бойынша саны (SPLINE, INSERT, TEXT, ...). */
  skipped: DxfSkippedEntity[]
  /** Бастапқы $INSUNITS коды. */
  sourceUnits: number
  /** Мм-ге қайта санау болды ма (яғни бастапқы бірлік мм емес еді). */
  unitsConverted: boolean
}

/** Бір ASCII DXF оқығышы бөлме жоспары мен өндірістік контурға ортақ. */
export function readDxfDocument(text: string): Parsed {
  assertNotBinary(text)
  return parseSections(tokenize(text))
}

const SUPPORTED_TYPES = new Set(['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC'])

const round = (n: number): number => Math.round(n)

function toMmPoint(x: number, z: number, factor: number): DxfPoint {
  return { x: round(x * factor), z: round(z * factor) }
}

function dist(a: DxfPoint, b: DxfPoint): number {
  return round(Math.hypot(b.x - a.x, b.z - a.z))
}

/** LWPOLYLINE: 10/20 жұптары — әр жұп бір төбе (bulge/доға ЕЛЕНБЕЙДІ — тік кесінді деп саналады). */
function lwpolylineVertices(groups: RawGroup[], factor: number): DxfPoint[] {
  const verts: DxfPoint[] = []
  let pendingX: number | undefined
  for (const g of groups) {
    if (g.code === 10) {
      pendingX = Number(g.value)
    } else if (g.code === 20 && pendingX !== undefined) {
      verts.push(toMmPoint(pendingX, Number(g.value), factor))
      pendingX = undefined
    }
  }
  return verts
}

function polylineVertices(vertexGroupsList: RawGroup[][], factor: number): DxfPoint[] {
  return vertexGroupsList.map((vg) => {
    const x = Number(findValue(vg, 10) ?? '0')
    const z = Number(findValue(vg, 20) ?? '0')
    return toMmPoint(x, z, factor)
  })
}

function segmentsFromVertices(verts: DxfPoint[], closed: boolean, layer: string): DxfWallSegment[] {
  const out: DxfWallSegment[] = []
  for (let i = 0; i < verts.length - 1; i += 1) {
    out.push({ layer, start: verts[i]!, end: verts[i + 1]!, length: dist(verts[i]!, verts[i + 1]!) })
  }
  if (closed && verts.length > 2) {
    const first = verts[0]!
    const last = verts[verts.length - 1]!
    out.push({ layer, start: last, end: first, length: dist(last, first) })
  }
  return out
}

/**
 * DXF мәтінінен бөлме жоспарын оқиды: қабырға кесінділері, шеңбер/доға
 * (танылады, бірақ қабырға ретінде шығарылмайды — тік сызық емес), қабаттар
 * тізімі, өлшем бірлігі.
 *
 * ⚠ Тек ЖОСПАР (2D): 3D модель импорты, блоктар (INSERT), сплайн, мәтін —
 * бөлек спек, кездессе `skipped`-те есептеледі.
 */
export function importDxfRoomPlan(text: string, options: DxfImportOptions = {}): DxfImportResult {
  const parsed = readDxfDocument(text)
  const { factor, converted, source } = unitFactor(parsed.insunits)

  const layerSet = new Set<string>()
  const skippedCounts = new Map<string, number>()
  const walls: DxfWallSegment[] = []
  const circles: DxfCircle[] = []
  const arcs: DxfArc[] = []

  for (const entity of parsed.entities) {
    const layer = findValue(entity.groups, 8) ?? '0'
    if (layer) layerSet.add(layer)

    if (!SUPPORTED_TYPES.has(entity.type)) {
      // ENDSEC/SEQEND/VERTEX құрылымдық — қате хабарламасына жатпайды.
      if (entity.type !== 'ENDSEC' && entity.type !== 'SEQEND' && entity.type !== 'VERTEX') {
        skippedCounts.set(entity.type, (skippedCounts.get(entity.type) ?? 0) + 1)
      }
      continue
    }

    const included = options.layer === undefined || options.layer === layer
    if (!included) continue

    if (entity.type === 'LINE') {
      const start = toMmPoint(Number(findValue(entity.groups, 10) ?? '0'), Number(findValue(entity.groups, 20) ?? '0'), factor)
      const end = toMmPoint(Number(findValue(entity.groups, 11) ?? '0'), Number(findValue(entity.groups, 21) ?? '0'), factor)
      walls.push({ layer, start, end, length: dist(start, end) })
    } else if (entity.type === 'LWPOLYLINE') {
      const closed = (Number(findValue(entity.groups, 70) ?? '0') & 1) === 1
      walls.push(...segmentsFromVertices(lwpolylineVertices(entity.groups, factor), closed, layer))
    } else if (entity.type === 'POLYLINE') {
      const closed = (Number(findValue(entity.groups, 70) ?? '0') & 1) === 1
      walls.push(...segmentsFromVertices(polylineVertices(entity.vertices ?? [], factor), closed, layer))
    } else if (entity.type === 'CIRCLE') {
      const center = toMmPoint(Number(findValue(entity.groups, 10) ?? '0'), Number(findValue(entity.groups, 20) ?? '0'), factor)
      circles.push({ layer, center, radius: round(Number(findValue(entity.groups, 40) ?? '0') * factor) })
    } else if (entity.type === 'ARC') {
      const center = toMmPoint(Number(findValue(entity.groups, 10) ?? '0'), Number(findValue(entity.groups, 20) ?? '0'), factor)
      arcs.push({
        layer,
        center,
        radius: round(Number(findValue(entity.groups, 40) ?? '0') * factor),
        startAngleDeg: Number(findValue(entity.groups, 50) ?? '0'),
        endAngleDeg: Number(findValue(entity.groups, 51) ?? '0'),
      })
    }
  }

  let bounds: { width: number; depth: number } | null = null
  if (walls.length > 0) {
    const xs = walls.flatMap((w) => [w.start.x, w.end.x])
    const zs = walls.flatMap((w) => [w.start.z, w.end.z])
    bounds = { width: round(Math.max(...xs) - Math.min(...xs)), depth: round(Math.max(...zs) - Math.min(...zs)) }
  }

  return {
    walls,
    circles,
    arcs,
    layers: [...layerSet].sort(),
    bounds,
    skipped: [...skippedCounts.entries()].map(([type, count]) => ({ type, count })),
    sourceUnits: source,
    unitsConverted: converted,
  }
}
