/**
 * ӨЗ КАТАЛОГЫМЫЗ — өндірушілердің АШЫҚ каталогтарынан жиналған дерек (docs/catalog/sources.md).
 *
 * Бұл файл — таза функциялар: кіріс (өндіруші бойынша зерттеу JSON-ы) тексеріледі
 * (`validateOwnCatalogInput`) да, жобаның `Material`/`EdgeBand` типтеріне жайылады
 * (`buildOwnCatalog`). Генератор скрипті (`scripts/buildOwnCatalog.ts`) мен тесттер
 * осы бір логиканы қолданады — тексеріс екі жерде екі түрлі болмасын.
 *
 * Базис/PRO100/qdesign деректері мұнда ЕШҚАШАН кірмейді: олар тек цехтың өз
 * импорты арқылы (бөлек тапсырма).
 */
import type { EdgeBand, EdgePolicy, Material } from '../../types'

// ── Кіріс пішіні (зерттеу файлдары, `input/*.json`) ─────────────────────────

export type BoardKind = 'ldsp' | 'mdf' | 'hdf'
export type GrainClass = 'wood' | 'none' | 'unknown'
export type SizeBasis = 'per-decor' | 'range-wide'
export type ReuseTerms = 'facts-ok' | 'unclear'

/** Бір дереккөз: қай бет, одан не алынды, пайдалану шарты. */
export type CatalogSource = {
  id: string
  manufacturer: string
  url: string
  what: string
  termsUrl: string | null
  termsNote: string
  /** `forbidden` дереккөз каталогқа МҮЛДЕ кірмейді — ол `skipped`-те ғана тұрады. */
  reuse: ReuseTerms
  dateSeen: string
}

/** Өндірушінің бір декоры (бір беттік құрылымымен). */
export type DecorRecord = {
  manufacturer: string
  kind: BoardKind
  /** Өндірушінің өз декор коды — МІНДЕТТІ (H1145, U 9118, 0101). */
  decorCode: string
  /** Бет құрылымының коды (ST10, PE, SM), жарияланбаса null. */
  structureCode: string | null
  /**
   * Бір декордың бірнеше өнім желісі болса (Egger: E1 P2 / E1 MR ылғалға
   * төзімді; МДФ ST / MB) — қысқа ASCII коды, болмаса null.
   */
  productLine: string | null
  name: string
  collection: string | null
  /** Осы декорға жарияланған қалыңдықтар, мм (бүтін). */
  thicknessesMm: number[]
  /** Парақ форматтары [ұзындығы, ені], мм (бүтін). */
  sheetSizesMm: Array<[number, number]>
  sizeBasis: SizeBasis
  sizeSourceUrl: string
  grain: GrainClass
  grainBasis: string
  sourceId: string
  sourceUrl: string
  dateSeen: string
}

/** Декорға сәйкестендірілген кромка (өндіруші сәйкестікті ӨЗІ жариялаған жағдайда ғана). */
export type DecorRef = { manufacturer: string; decorCode: string; structureCode: string | null }

export type EdgeRecord = {
  manufacturer: string
  code: string
  name: string
  material: 'pvc' | 'abs' | 'pp' | 'unknown'
  thicknessesMm: number[]
  widthsMm: number[]
  matches: DecorRef[]
  sourceId: string
  sourceUrl: string
  dateSeen: string
}

export type OwnCatalogInput = {
  sources: CatalogSource[]
  decors: DecorRecord[]
  edges: EdgeRecord[]
}

// ── Физикалық шектер ────────────────────────────────────────────────────────

/**
 * Плита қалыңдығының рұқсат аралығы, мм. 3 — ең жұқа ХДФ арт қабырға,
 * 40 — 38 мм столешница плитасынан сәл жоғары (жиһаз плитасы одан қалың болмайды).
 * Аралықтан тыс сан — зерттеудегі қате (мысалы, см не дюйм).
 */
export const BOARD_THICKNESS_RANGE_MM = { min: 3, max: 40 } as const

/**
 * Парақ жағының рұқсат аралығы, мм. 1000 — ХДФ-тың ең кіші толық форматынан
 * (≈1220) төмен; 5700 — ең ұзын ЛДСП форматынан (5610) жоғары. Кіші «парақ»
 * (мыс. Базистегі 1000×1000 fallback) — нақты өлшем емес.
 */
export const SHEET_SIDE_RANGE_MM = { min: 1000, max: 5700 } as const

/** Кромка қалыңдығы — жоба конвенциясы (`types.ts` → `EdgeBand.thickness`). */
export const EDGE_THICKNESSES_MM = [0.4, 1, 2] as const

/**
 * Каталогқа жайылатын кромка ені, мм: 19/22 — 16/18 мм ЛДСП-ға, 28–43 —
 * қалың МДФ фасад пен 25–38 мм плитаға. Басқа ен (мыс. 54 мм столешница
 * жиегі) зерттеу файлында қалады, бірақ `EdgeBand`-қа жайылмайды.
 */
export const EDGE_WIDTH_RANGE_MM = { min: 19, max: 43 } as const

/**
 * Кромка ені ≥ плита қалыңдығы + осы қор, мм. Кромка плитадан екі жағынан
 * шығып тұрады, фрезер артығын кесіп тастайды: 16 → 19, 18 → 22 (цех стандарты,
 * docs/basis/import.md §1).
 */
export const EDGE_WIDTH_ALLOWANCE_MM = 3

/**
 * Парақтың әр жағынан кесілетін жарамсыз жолақ, мм — `seed.ts`-пен бірдей
 * әдепкі. Өндіруші мұны жарияламайды; цех өз санын қояды.
 */
export const DEFAULT_TRIM_EDGE_MM = 10

/**
 * Каталогқа Material ретінде ЖАЙЫЛАТЫН қалыңдықтар, мм. Өндіруші одан көп
 * жариялайды (Egger ЛДСП 8–38 мм), бірақ әр қалыңдық — таңдағышта бөлек жол;
 * корпус жиһазына керегі осы (CLAUDE.md §4.1): ЛДСП 10 (жәшік түбі), 16/18
 * (корпус), 22/25 (сөре/столешница астығы); МДФ фасад 16/18/19/22; ХДФ арт
 * қабырға 3/4. Қалғаны мета-дағы `publishedThicknessesMm`-де сақталады.
 */
export const CATALOG_THICKNESSES_MM: Record<BoardKind, readonly number[]> = {
  // Ашық зерттеу дерегінде жарияланған 8–32 мм қатары. 38 мм ЛДСП
  // анықтамалықта бар болса да, осы кезеңнің «8–32 мм» кеңейтуіне кірмейді.
  ldsp: [8, 10, 12, 16, 18, 22, 25, 26, 28, 32],
  // Egger/Ultradecor МДФ-тың өлшемі бар жарияланған фасад қатары; өлшемі
  // белгісіз Базис МДФ жолдары әдейі материалға жайылмайды.
  mdf: [8, 10, 12, 16, 18, 19, 22, 25, 28],
  hdf: [3, 4],
}

const KIND_RU: Record<BoardKind, string> = { ldsp: 'ЛДСП', mdf: 'МДФ', hdf: 'ХДФ' }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ── Тексеріс ────────────────────────────────────────────────────────────────

/** Тексеріс қатесі: ҚАЙ жазбаның ҚАЙ өрісі және рұқсат етілген мән (CLAUDE.md §10). */
export type CatalogIssue = { path: string; message: string }

const norm = (s: string) => s.replace(/[\s\-_.]/g, '').toUpperCase()

/** Декор кілті: өндіруші + декор коды + құрылым (бос орын/регистр ескерілмейді). */
export function decorKey(manufacturer: string, decorCode: string, structureCode: string | null): string {
  return `${manufacturer.toLowerCase()}|${norm(decorCode)}|${structureCode === null ? '' : norm(structureCode)}`
}

const isHttpUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\/\S+$/.test(s)
const isNonEmpty = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0

export function validateOwnCatalogInput(input: OwnCatalogInput): CatalogIssue[] {
  const issues: CatalogIssue[] = []
  const add = (path: string, message: string) => issues.push({ path, message })

  const sourceIds = new Set<string>()
  input.sources.forEach((s, i) => {
    const p = `sources[${i}]`
    if (!isNonEmpty(s.id)) add(`${p}.id`, 'бос болмауы керек')
    else if (sourceIds.has(s.id)) add(`${p}.id`, `қайталанған дереккөз id: ${s.id}`)
    else sourceIds.add(s.id)
    if (!isHttpUrl(s.url)) add(`${p}.url`, 'http(s) URL болуы керек')
    if (s.reuse !== 'facts-ok' && s.reuse !== 'unclear') add(`${p}.reuse`, "рұқсат: 'facts-ok' | 'unclear' (тыйым салынған дереккөз каталогқа кірмейді)")
    if (!DATE_RE.test(s.dateSeen)) add(`${p}.dateSeen`, 'пішімі YYYY-MM-DD')
  })

  const checkProvenance = (p: string, r: { sourceId: string; sourceUrl: string; dateSeen: string }) => {
    if (!sourceIds.has(r.sourceId)) add(`${p}.sourceId`, `белгісіз дереккөз: ${String(r.sourceId)}`)
    if (!isHttpUrl(r.sourceUrl)) add(`${p}.sourceUrl`, 'http(s) URL болуы керек')
    if (!DATE_RE.test(r.dateSeen)) add(`${p}.dateSeen`, 'пішімі YYYY-MM-DD')
  }

  const decorKeys = new Set<string>()
  input.decors.forEach((d, i) => {
    const p = `decors[${i}]`
    if (!isNonEmpty(d.manufacturer)) add(`${p}.manufacturer`, 'бос болмауы керек')
    if (!isNonEmpty(d.decorCode)) add(`${p}.decorCode`, 'декор коды міндетті')
    if (!isNonEmpty(d.name)) add(`${p}.name`, 'бос болмауы керек')
    if (d.productLine !== null && !/^[A-Za-z0-9-]{1,16}$/.test(d.productLine)) add(`${p}.productLine`, 'қысқа ASCII код (A-Z, 0-9, -) не null')
    if (d.kind !== 'ldsp' && d.kind !== 'mdf' && d.kind !== 'hdf') add(`${p}.kind`, "рұқсат: 'ldsp' | 'mdf' | 'hdf'")
    if (d.grain !== 'wood' && d.grain !== 'none' && d.grain !== 'unknown') add(`${p}.grain`, "рұқсат: 'wood' | 'none' | 'unknown'")
    if (d.sizeBasis !== 'per-decor' && d.sizeBasis !== 'range-wide') add(`${p}.sizeBasis`, "рұқсат: 'per-decor' | 'range-wide'")
    if (!isHttpUrl(d.sizeSourceUrl)) add(`${p}.sizeSourceUrl`, 'http(s) URL болуы керек')
    if (d.thicknessesMm.length === 0) add(`${p}.thicknessesMm`, 'кемінде бір қалыңдық керек')
    const thicknesses = new Set<number>()
    d.thicknessesMm.forEach((t, j) => {
      if (!Number.isInteger(t) || t < BOARD_THICKNESS_RANGE_MM.min || t > BOARD_THICKNESS_RANGE_MM.max) {
        add(`${p}.thicknessesMm[${j}]`, `бүтін сан ${BOARD_THICKNESS_RANGE_MM.min}–${BOARD_THICKNESS_RANGE_MM.max} мм болуы керек, берілгені ${t}`)
      }
      if (thicknesses.has(t)) add(`${p}.thicknessesMm[${j}]`, `қайталанған қалыңдық: ${t} мм`)
      else thicknesses.add(t)
    })
    if (d.sheetSizesMm.length === 0) add(`${p}.sheetSizesMm`, 'кемінде бір парақ форматы керек')
    d.sheetSizesMm.forEach((size, j) => {
      size.forEach((v, k) => {
        if (!Number.isInteger(v) || v < SHEET_SIDE_RANGE_MM.min || v > SHEET_SIDE_RANGE_MM.max) {
          add(`${p}.sheetSizesMm[${j}][${k}]`, `бүтін сан ${SHEET_SIDE_RANGE_MM.min}–${SHEET_SIDE_RANGE_MM.max} мм болуы керек, берілгені ${v}`)
        }
      })
    })
    checkProvenance(p, d)
    if (isNonEmpty(d.manufacturer) && isNonEmpty(d.decorCode)) {
      const key = `${d.kind}|${norm(d.productLine ?? '')}|${decorKey(d.manufacturer, d.decorCode, d.structureCode)}`
      if (decorKeys.has(key)) add(`${p}.decorCode`, `қайталанған декор: ${d.manufacturer} ${d.decorCode} ${d.structureCode ?? ''} ${d.productLine ?? ''}`.trim())
      else decorKeys.add(key)
    }
  })

  const byDecor = decorIndex(input.decors)
  const edgeKeys = new Set<string>()
  input.edges.forEach((e, i) => {
    const p = `edges[${i}]`
    if (!isNonEmpty(e.manufacturer)) add(`${p}.manufacturer`, 'бос болмауы керек')
    if (!isNonEmpty(e.code)) add(`${p}.code`, 'кромка коды міндетті')
    if (!isNonEmpty(e.name)) add(`${p}.name`, 'бос болмауы керек')
    // Бір код бір қалыңдықта бір-ақ рет: өндіруші әр қалыңдыққа бөлек ен
    // жариялайтындықтан, бір кодтың бірнеше жазбасы болуы заңды.
    const key = `${e.manufacturer.toLowerCase()}|${norm(e.code)}|${e.material}|${[...e.thicknessesMm].sort((a, b) => a - b).join(',')}`
    if (edgeKeys.has(key)) add(`${p}.code`, `қайталанған кромка: ${e.manufacturer} ${e.code} ${e.thicknessesMm.join('/')} мм`)
    else edgeKeys.add(key)
    if (e.thicknessesMm.length === 0) add(`${p}.thicknessesMm`, 'кемінде бір қалыңдық керек')
    e.thicknessesMm.forEach((t, j) => {
      if (!(t > 0 && t <= 3)) add(`${p}.thicknessesMm[${j}]`, `0 < қалыңдық ≤ 3 мм болуы керек, берілгені ${t}`)
    })
    if (e.widthsMm.length === 0) add(`${p}.widthsMm`, 'кемінде бір ен керек')
    e.widthsMm.forEach((w, j) => {
      // 1000 мм — кромка өндірушісі жариялайтын ең кең «кесілмеген» орам (660 мм) шегінен жоғары.
      if (!Number.isInteger(w) || w < 10 || w > 1000) add(`${p}.widthsMm[${j}]`, `бүтін сан 10–1000 мм болуы керек, берілгені ${w}`)
    })
    e.matches.forEach((m, j) => {
      if (resolveDecor(byDecor, m).length === 0) {
        add(`${p}.matches[${j}]`, `декор табылмады: ${m.manufacturer} ${m.decorCode} ${m.structureCode ?? ''}`.trim())
      }
    })
    checkProvenance(p, e)
  })
  return issues
}

type DecorIndex = Map<string, DecorRecord[]>

function decorIndex(decors: DecorRecord[]): DecorIndex {
  const idx: DecorIndex = new Map()
  for (const d of decors) {
    if (!isNonEmpty(d.decorCode) || !isNonEmpty(d.manufacturer)) continue
    for (const key of [decorKey(d.manufacturer, d.decorCode, d.structureCode), decorKey(d.manufacturer, d.decorCode, null)]) {
      const list = idx.get(key) ?? []
      list.push(d)
      idx.set(key, list)
    }
  }
  return idx
}

/**
 * Сілтемені декорға шешу. Құрылымы берілсе — дәл сол құрылым; берілмесе —
 * сол кодтың БАРЛЫҚ құрылымы (кромка түсі бет құрылымына тәуелді емес).
 */
function resolveDecor(idx: DecorIndex, ref: DecorRef): DecorRecord[] {
  const exact = idx.get(decorKey(ref.manufacturer, ref.decorCode, ref.structureCode)) ?? []
  if (ref.structureCode === null) return exact
  return exact.filter((d) => d.structureCode !== null && norm(d.structureCode) === norm(ref.structureCode ?? ''))
}

// ── Жаю: зерттеу жазбасы → Material / EdgeBand ──────────────────────────────

/** Материалдың шығу тегі: UI мен баға байланысы үшін (Material типіне кірмейді). */
export type OwnMaterialMeta = {
  manufacturer: string
  kind: BoardKind
  decorCode: string
  structureCode: string | null
  productLine: string | null
  decorName: string
  collection: string | null
  /** Өндіруші осы декорға жариялаған БАРЛЫҚ қалыңдық (каталогқа жайылмағандары да). */
  publishedThicknessesMm: number[]
  grain: GrainClass
  grainBasis: string
  sizeBasis: SizeBasis
  sizeSourceUrl: string
  sourceId: string
  sourceUrl: string
  dateSeen: string
}

export type OwnEdgeMeta = {
  manufacturer: string
  code: string
  material: EdgeRecord['material']
  widthMm: number
  /** Сәйкес декорлар: `decorKey(...)` мәндері. */
  decorKeys: string[]
  sourceId: string
  sourceUrl: string
  dateSeen: string
}

export type OwnCatalogBuild = {
  materials: Material[]
  edgeBands: EdgeBand[]
  materialMeta: Record<string, OwnMaterialMeta>
  edgeMeta: Record<string, OwnEdgeMeta>
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9а-яёәғқңөұүһі]+/g, '-').replace(/^-+|-+$/g, '')

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ә: 'a', ғ: 'g', қ: 'q', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
}
/** id тек ASCII: кириллица транслитерацияланады (URL мен файл атауында қауіпсіз). */
const idPart = (s: string) =>
  slug(s).split('').map((c) => translitMap[c] ?? c).join('')

const thicknessTag = (t: number) => String(t).replace('.', '')

export function materialId(d: DecorRecord, thickness: number, size: [number, number]): string {
  const parts = ['own', d.kind, idPart(d.manufacturer), idPart(d.decorCode)]
  if (d.structureCode !== null) parts.push(idPart(d.structureCode))
  if (d.productLine !== null) parts.push(idPart(d.productLine))
  parts.push(String(thickness), `${size[0]}x${size[1]}`)
  return parts.join('-')
}

export function edgeBandId(e: EdgeRecord, thickness: number, width: number): string {
  return ['own-edge', idPart(e.manufacturer), idPart(e.code), e.material, `${thicknessTag(thickness)}x${width}`].join('-')
}

const MATERIAL_RU: Record<EdgeRecord['material'], string> = { pvc: 'ПВХ', abs: 'АБС', pp: 'ПП', unknown: '' }

/**
 * `validate: false` — тек генератор тексеріп жазған кіріс үшін (`index.ts`
 * жүктеуі): тексеріс генераторда және `ownCatalogData.test.ts`-те жүреді.
 */
export function buildOwnCatalog(input: OwnCatalogInput, opts: { validate?: boolean } = {}): OwnCatalogBuild {
  const issues = opts.validate === false ? [] : validateOwnCatalogInput(input)
  if (issues.length > 0) {
    const head = issues.slice(0, 20).map((x) => `${x.path}: ${x.message}`).join('\n')
    throw new Error(`Өз каталогы жарамсыз (${issues.length} қате):\n${head}`)
  }

  const edgeBands: EdgeBand[] = []
  const edgeMeta: Record<string, OwnEdgeMeta> = {}
  const idx = decorIndex(input.decors)
  for (const e of input.edges) {
    const keys = [...new Set(e.matches.flatMap((m) => resolveDecor(idx, m))
      .map((d) => decorKey(d.manufacturer, d.decorCode, d.structureCode)))].sort()
    for (const t of e.thicknessesMm) {
      if (!(EDGE_THICKNESSES_MM as readonly number[]).includes(t)) continue
      for (const w of [...new Set(e.widthsMm)].sort((a, b) => a - b)) {
        if (w < EDGE_WIDTH_RANGE_MM.min || w > EDGE_WIDTH_RANGE_MM.max) continue
        const id = edgeBandId(e, t, w)
        const mat = MATERIAL_RU[e.material]
        edgeBands.push({
          id,
          name: `Кромка ${mat ? `${mat} ` : ''}${t}×${w} ${e.manufacturer} ${e.code}${e.name === e.code ? '' : ` ${e.name}`}`.replace(/\s+/g, ' ').trim(),
          thickness: t,
          widthMm: w,
          pricePerMeter: 0,
        })
        edgeMeta[id] = {
          manufacturer: e.manufacturer, code: e.code, material: e.material, widthMm: w,
          decorKeys: keys, sourceId: e.sourceId, sourceUrl: e.sourceUrl, dateSeen: e.dateSeen,
        }
      }
    }
  }

  const bandById = new Map(edgeBands.map((b) => [b.id, b]))
  const bandsByDecor = new Map<string, string[]>()
  for (const b of edgeBands) {
    for (const k of edgeMeta[b.id]?.decorKeys ?? []) {
      const list = bandsByDecor.get(k) ?? []
      list.push(b.id)
      bandsByDecor.set(k, list)
    }
  }

  const materials: Material[] = []
  const materialMeta: Record<string, OwnMaterialMeta> = {}
  // Үнсіз кромка тек декор мен қалыңдыққа тәуелді (парақ форматына емес) — бір рет есептейміз.
  const edgingCache = new Map<string, EdgePolicy | undefined>()
  for (const d of input.decors) {
    const key = decorKey(d.manufacturer, d.decorCode, d.structureCode)
    const struct = d.structureCode === null ? '' : ` ${d.structureCode}`
    const line = d.productLine === null ? '' : ` (${d.productLine})`
    const allowed = CATALOG_THICKNESSES_MM[d.kind]
    const published = [...new Set(d.thicknessesMm)].sort((a, b) => a - b)
    for (const t of published.filter((x) => allowed.includes(x))) {
      for (const size of d.sheetSizesMm) {
        const id = materialId(d, t, size)
        const cacheKey = `${key}|${t}`
        if (!edgingCache.has(cacheKey)) {
          edgingCache.set(cacheKey, pickEdging(bandsByDecor.get(key) ?? [], edgeMeta, bandById, t, d.manufacturer))
        }
        const edging = edgingCache.get(cacheKey)
        materials.push({
          id,
          // Lamarty сияқты код жарияламайтын өндірушіде код = атау — қайталамаймыз.
          name: `${KIND_RU[d.kind]} ${d.manufacturer} ${d.decorCode === d.name ? '' : d.decorCode}${struct} ${d.name}${line} ${t} мм`.replace(/\s+/g, ' ').trim(),
          thickness: t,
          sheetWidth: size[0],
          sheetHeight: size[1],
          // Белгісіз текстура → бұрмаймыз: артық қалдық — ақша, ал бұрылған
          // ағаш текстурасы — брак. Қауіпсіз жағы таңдалды.
          hasGrain: d.grain !== 'none',
          pricePerSheet: 0,
          trimEdge: DEFAULT_TRIM_EDGE_MM,
          ...(edging ? { defaultEdging: edging } : {}),
        })
        materialMeta[id] = {
          manufacturer: d.manufacturer, kind: d.kind, decorCode: d.decorCode, structureCode: d.structureCode,
          productLine: d.productLine, decorName: d.name, collection: d.collection,
          publishedThicknessesMm: published, grain: d.grain, grainBasis: d.grainBasis,
          sizeBasis: d.sizeBasis, sizeSourceUrl: d.sizeSourceUrl, sourceId: d.sourceId,
          sourceUrl: d.sourceUrl, dateSeen: d.dateSeen,
        }
      }
    }
  }

  const seen = new Set<string>()
  for (const x of [...materials, ...edgeBands]) {
    if (seen.has(x.id)) throw new Error(`Өз каталогы: қайталанған id ${x.id}`)
    seen.add(x.id)
  }
  return { materials, edgeBands, materialMeta, edgeMeta }
}

/**
 * Декорға сәйкес кромкадан үнсіз жиынтық (2 мм кромка болғанда ҒАНА): алдыңғы жиек — 2 мм, көрінетін
 * екінші — 0.4 мм (болмаса 1 мм), жасырын — кромкасыз. Ен — плита қалыңдығы +
 * `EDGE_WIDTH_ALLOWANCE_MM`-тен кем емес ең тар ен. Плитаның өз өндірушісінің
 * кромкасы бірінші таңдалады. Сәйкес кромка жоқ болса — undefined (ойдан
 * «ұқсас» кромка таңдалмайды: декоры сәйкес келмеген кромка — брак).
 */
function pickEdging(
  bandIds: string[],
  meta: Record<string, OwnEdgeMeta>,
  byId: Map<string, EdgeBand>,
  boardThickness: number,
  boardManufacturer: string,
): EdgePolicy | undefined {
  if (bandIds.length === 0) return undefined
  const minWidth = boardThickness + EDGE_WIDTH_ALLOWANCE_MM
  const pick = (thickness: number): string | null => {
    const candidates = bandIds
      .map((id) => ({ id, band: byId.get(id), m: meta[id] }))
      .filter((c) => c.band?.thickness === thickness && c.m !== undefined && c.m.widthMm >= minWidth)
      .sort((a, b) => {
        const own = Number(b.m?.manufacturer === boardManufacturer) - Number(a.m?.manufacturer === boardManufacturer)
        if (own !== 0) return own
        const w = (a.m?.widthMm ?? 0) - (b.m?.widthMm ?? 0)
        return w !== 0 ? w : a.id.localeCompare(b.id)
      })
    return candidates[0]?.id ?? null
  }
  const front = pick(2)
  const secondary = pick(0.4) ?? pick(1)
  // Алдыңғы (2 мм) кромкасыз үнсіз жиынтық берілмейді: әйтпесе фасад жиегі
  // үнсіз кромкасыз қалады, ал цех оны байқамай қалуы мүмкін.
  if (front === null) return undefined
  return { visibleFront: front, visibleSecondary: secondary, hidden: null }
}
