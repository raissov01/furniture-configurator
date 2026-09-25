#!/usr/bin/env node
/**
 * Базис-Мебельщик 2023All -> біздің Material/EdgeBand пішіні.
 *
 * Кіріс: `docs/basis/basis-filtered-raw.json` (scripts/basisExtract.py
 * жазған, сүзілген шикі жолдар — тек ЛДСП 16/18, ХДФ 3/4, кромка 19/22мм).
 *
 * Шығыс (JSON, `src/core/data/generated/`):
 *   - basisMaterials.json  — Material[] пішінімен
 *   - basisEdgeBands.json  — EdgeBand[] пішінімен (`widthMm` атаудан алынады)
 *   - basisPriceMeta.json  — id -> { priceSource, note } (баға сенімділігі,
 *     Material/EdgeBand типінде жоқ өріс, сондықтан бөлек файл)
 *
 * Бұл файлдар `src/core/data/basisCatalog.ts` арқылы типтеліп экспортталады.
 * `npm run import:basis` арқылы қайта жүргізуге болады (2023All.xlsx қажет).
 *
 * ⚠ ТЕК ДЕРЕК: атау/өлшем/баға. Текстура/3D копияланбайды (legal boundary,
 * docs/basis/materials-db.md).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RAW_PATH = `${ROOT}docs/basis/basis-filtered-raw.json`
const OUT_DIR = `${ROOT}src/core/data/generated`

// ── qdesign-нан оқылған нақты ҚАЗАҚСТАН бағасы (docs/audit/qdesign-drilling-reference.md
//    аяғында ЖОҚ — бөлек аудит, пайдаланушы 2026-09-20 берген) ─────────────
// Формат 2800×2070 (Egger стандарты). Бұл БІР жалпы баға, декорға қарай
// БӨЛІНБЕЙДІ (qdesign-да да солай оқылды) — сондықтан «kz-quoted-generic»,
// «kz-quoted-exact» емес: әр декордың нақты бағасы басқаша болуы мүмкін,
// цех тексеруі керек.
const KZ_REFERENCE_PRICES = {
  egger2800x2070: { tenge: 34000, format: [2800, 2070] },
  // Kronospan базада МҮЛДЕ ЖОҚ (docs/basis/materials-db.md §2) — сондықтан
  // осында тіркелгенімен, ешбір материалға ЖАЛҒАНБАЙДЫ. Тек анықтама үшін.
  kronospan2800x2070: { tenge: 16500, format: [2800, 2070] },
}
const TIYN_PER_TENGE = 100

// ── Ағаш декор түйінсөздері (кириллица, hasGrain эвристикасы) ──────────────
// docs/basis/import.md-де 97.8% дәлдікпен Egger H/U/W кодтарына қарсы
// тексерілген (тек Egger үшін, себебі кросс-валидация тек сол жерде мүмкін).
const WOOD_WORDS = [
  'дуб', 'дуба', 'ясень', 'сосна', 'сосны', 'орех', 'ореха', 'вяз', 'бук', 'клён', 'клен',
  'берёза', 'береза', 'каштан', 'тик', 'ироко', 'палисандр', 'венге', 'табак', 'дерево',
  'древесина', 'рустик', 'вуд', 'эбони', 'махагон', 'кедр', 'лиственница', 'бамбук', 'акация',
  'мербау', 'сандал', 'самба', 'кокоболо', 'пихта', 'вишня', 'гикори', 'робиния', 'файнлайн',
  'сапели', 'зебрано', 'мербао', 'олива', 'груша', 'вавона', 'нарочь',
]
/**
 * ⚠ ГОЧА: JS-тің `\b`/`\w` тек ASCII үшін жұмыс істейді, кирилл әріптерін
 * «сөз таңбасы» деп танымайды — сондықтан `\bдуб\w*` кирилл мәтінінде
 * ЕШҚАШАН сәйкес келмейді (тексерілді, алғашқы нұсқада БӘРІ false шыққан
 * еді). Соның орнына Unicode look-behind/ahead-пен қолмен шекара қоямыз.
 */
const CYR_WORD_CHAR = 'a-zA-Zа-яёА-ЯЁ'
const WOOD_WORD_RE = new RegExp(
  `(?<![${CYR_WORD_CHAR}])(${WOOD_WORDS.join('|')})[${CYR_WORD_CHAR}]*`,
  'iu',
)

/** Egger декор коды: `H1145`, `U156`, `W980` — атаудың соңында тұрады. */
const EGGER_CODE_RE = /\b([A-Z])(\d{3,5})\b/

/**
 * Жалған позитивтер: түйінсөз ішінара сәйкес келеді, бірақ мағынасы ағашқа
 * қатысы жоқ («Дублин» қаласының атауы «дуб»-тан басталады). Тексерілген
 * толық тізім, docs/basis/import.md §3.
 */
const FALSE_POSITIVE_NAMES = [/дублин/iu]

function hasWoodKeyword(name) {
  if (FALSE_POSITIVE_NAMES.some((re) => re.test(name))) return false
  return WOOD_WORD_RE.test(name)
}

/**
 * hasGrain эвристикасы.
 *
 * Egger-де декор коды бар: H-префикс = Holzdekor (ағаш), U/W = Uni/White
 * (біртүсті) — бұл ӨНДІРУШІНІҢ ӨЗ конвенциясы, эвристика емес, сондықтан
 * ЖОҒАРЫ сенімді (кросс-валидация 97.8%, docs/basis/import.md §3).
 *
 * Басқа өндірушіде (Lamarty/Увадрев/Стандарт) код жоқ — тек орысша
 * түйінсөз іздеу, ТӨМЕН сенімді (тексерілмеген, себебі салыстыратын
 * «дұрысы» жоқ).
 */
function hasGrainOf(name, manufacturer) {
  if (manufacturer === 'Egger') {
    const m = EGGER_CODE_RE.exec(name)
    if (m) return m[1] === 'H'
  }
  return hasWoodKeyword(name)
}

/**
 * Регистр САҚТАЛАДЫ ӘДЕЙІ: «Стандарт» брендінде `S/BL` (Бодега светлый) мен
 * `S/Bl` (Голубой) сияқты тек әріп регистрімен ажыратылатын артикулдар бар —
 * lowercase жасаса, екеуі бір id-ге түсіп қақтығысады (тексерілді).
 */
function slug(s) {
  return String(s)
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Парақ өлшемі: `Длина`/`Ширина` нөл болмаса — солар нақты өлшем (тексерілді,
 * docs/basis/import.md §2: Lamarty/Увадрев/Egger-де толтырылған). Нөл болса —
 * «Шаг по Х/Y» (текстура қадамы) fallback ретінде, үлкені sheetWidth-ке.
 *
 * ТҮЗЕТУ 2026-09-20: fallback-та де екеуі де жарамсыз болса (шегерімде 1000×1000),
 * жазбаны ТАСТАУ. Бұл МДФ-ті тастау шешімімен бірдей логика (§«Не алынбады»).
 */
function sheetDims(row) {
  const length = Number(row.length) || 0
  const width = Number(row.width) || 0
  if (length > 0 && width > 0) {
    return { sheetWidth: length, sheetHeight: width }
  }
  const stepX = Number(row.stepX) || 0
  const stepY = Number(row.stepY) || 0
  if (stepX > 0 && stepY > 0) {
    const sheetWidth = Math.max(stepX, stepY)
    const sheetHeight = Math.min(stepX, stepY)
    // Fallback-та кіші өлшемі < 1500 болса (мыс., 1000×1000), жазбаны
    // өткез. Нарықтағы ең кіші парақ 2440×1220-дан басталады.
    if (sheetWidth < 1500 || sheetHeight < 1500) {
      return { sheetWidth: 0, sheetHeight: 0 }
    }
    return { sheetWidth, sheetHeight }
  }
  return { sheetWidth: 0, sheetHeight: 0 }
}

/** Материал парағының жарамсыз жиегі — базада жоқ, цех константасы (seed.ts-пен бірдей). */
const TRIM_EDGE = 10

function buildLdsp(raw) {
  const materials = []
  const priceMeta = {}
  for (const row of raw.ldsp) {
    // 8 жол — декорсыз «топ атауы» жазбасы (мыс. «ЛДСП Lamarty 16мм»,
    // үтірсіз), нақты сатылатын дана емес, өткізіп жіберу керек.
    if (!row.name.includes(',')) continue

    const manufacturer = row.group.split('/')[2] ?? 'Стандарт'
    const { sheetWidth, sheetHeight } = sheetDims(row)
    if (sheetWidth <= 0 || sheetHeight <= 0) continue // қауіпсіздік үшін, кездеспеуі керек

    const id = `basis-ldsp-${slug(row.articul)}`
    const hasGrain = hasGrainOf(row.name, manufacturer)

    let pricePerSheet = 0
    let priceSource = 'unknown'
    let note = `Базис 2023, «Стоимость» = ${row.price} (валюта расталмаған, сондықтан пайдаланылмайды)`
    if (
      manufacturer === 'Egger' &&
      sheetWidth === KZ_REFERENCE_PRICES.egger2800x2070.format[0] &&
      sheetHeight === KZ_REFERENCE_PRICES.egger2800x2070.format[1]
    ) {
      pricePerSheet = KZ_REFERENCE_PRICES.egger2800x2070.tenge * TIYN_PER_TENGE
      priceSource = 'kz-quoted-generic'
      note =
        'qdesign.kz-тен оқылған жалпы Egger 2800×2070 бағасы (34 000 ₸/парақ), ' +
        'декорға бөлінбеген — цех өз декорына қарай нақтылауы керек ' +
        '(docs/audit/qdesign-drilling-reference.md-тегі сеанс, 2026-09-20)'
    }

    materials.push({
      id,
      name: row.name,
      thickness: Math.round(row.thickness),
      sheetWidth,
      sheetHeight,
      hasGrain,
      pricePerSheet,
      trimEdge: TRIM_EDGE,
    })
    priceMeta[id] = { priceSource, note }
  }
  return { materials, priceMeta }
}

function buildHdf(raw) {
  const materials = []
  const priceMeta = {}
  for (const row of raw.hdf) {
    const { sheetWidth, sheetHeight } = sheetDims(row)
    if (sheetWidth <= 0 || sheetHeight <= 0) continue
    const id = `basis-hdf-${slug(row.articul)}`
    materials.push({
      id,
      name: row.name,
      thickness: Math.round(row.thickness),
      sheetWidth,
      sheetHeight,
      // ХДФ арт қабырғаға арналған, ешбір жеткізуші оны ағаш текстурамен
      // шығармайды (біртекті талшық тақтасы) — эвристика емес, физикалық факт.
      hasGrain: false,
      pricePerSheet: 0,
      trimEdge: TRIM_EDGE,
      // Арт қабырғаға кромка жабыспайды (seed.ts-тегі hdf3-* үлгісімен бірдей).
      defaultEdging: { visibleFront: null, visibleSecondary: null, hidden: null },
    })
    priceMeta[id] = {
      priceSource: 'unknown',
      note: `Базис 2023, «Стоимость» = ${row.price} (валюта расталмаған)`,
    }
  }
  return { materials, priceMeta }
}

function buildEdgeBands(raw) {
  const edgeBands = []
  const priceMeta = {}
  for (const row of raw.edgeBands) {
    const id = `basis-edge-${slug(row.articul)}`
    const widthMatch = /\d+(?:[,.]\d+)?\s*[xх×]\s*(\d{2,3})\b/u.exec(row.name)
    if (!widthMatch) throw new Error(`Кромка енін оқу мүмкін емес: ${row.name}`)
    edgeBands.push({
      id,
      name: row.name,
      thickness: row.thickness,
      widthMm: Number(widthMatch[1]),
      pricePerMeter: 0,
    })
    priceMeta[id] = {
      priceSource: 'unknown',
      note: `Базис 2023, «Стоимость» = ${row.price} (валюта расталмаған)`,
    }
  }
  return { edgeBands, priceMeta }
}

function main() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'))

  const ldsp = buildLdsp(raw)
  const hdf = buildHdf(raw)
  const edges = buildEdgeBands(raw)

  const materials = [...ldsp.materials, ...hdf.materials]
  const edgeBands = edges.edgeBands
  const priceMeta = { ...ldsp.priceMeta, ...hdf.priceMeta, ...edges.priceMeta }

  // Бірегейлік тексеруі — импорттан кейін бірден, тыныш сынбау үшін.
  const ids = new Set()
  for (const m of [...materials, ...edgeBands]) {
    if (ids.has(m.id)) throw new Error(`Қайталанған id: ${m.id}`)
    ids.add(m.id)
  }

  writeFileSync(`${OUT_DIR}/basisMaterials.json`, `${JSON.stringify(materials, null, 1)}\n`)
  writeFileSync(`${OUT_DIR}/basisEdgeBands.json`, `${JSON.stringify(edgeBands, null, 1)}\n`)
  writeFileSync(`${OUT_DIR}/basisPriceMeta.json`, `${JSON.stringify(priceMeta, null, 1)}\n`)

  const grainCount = materials.filter((m) => m.hasGrain).length
  const eggerPriced = materials.filter((m) => priceMeta[m.id]?.priceSource === 'kz-quoted-generic').length
  console.log(`ЛДСП: ${ldsp.materials.length} (${raw.ldsp.length - ldsp.materials.length} өткізілді — декорсыз топ жазбасы)`)
  console.log(`ХДФ: ${hdf.materials.length}`)
  console.log(`Материалдар барлығы: ${materials.length}, hasGrain=true: ${grainCount}`)
  console.log(`Кромка: ${edgeBands.length}`)
  console.log(`Нақты ҚР бағасы бекітілген материал: ${eggerPriced} (Egger 2800×2070)`)
}

main()
