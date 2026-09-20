/**
 * PRO100 v7.08 кітапханасының номенклатурасы (docs/pro100/ui-design.md §2,
 * «Библиотека» панелі). Дерек — тек `.meb` файл аттары мен бума жолдары
 * (`scripts/importPro100.mjs` алған, `generated/pro100Library.json`).
 *
 * ⚠ ОЙДАН ЕШТЕҢЕ ШЫҒАРЫЛМАЙДЫ. Файл атынан ОҚЫЛМАЙТЫН кез келген өлшем
 * (биіктік, тереңдік) немесе қасиет (материал, баға) `undefined` болып
 * қалады — бұл `basisCatalog.ts`-те бекітілген ережемен бірдей (сонда
 * МДФ/Kronospan бағасы да осылай толтырылмаған). Ені (`widthMm`) де тек
 * атауда БІРЕУ ғана сан кандидаты болғанда ғана толтырылады: «Угловой 780
 * (400)» сияқты екі санды атауларда қайсысы ені екені белгісіз болғандықтан
 * `undefined` қалады — бұрыш модулінің екі қабырғасын шатастырып, цехқа
 * қате деталь беру ЖАМАНЫРАҚ, undefined-тен де.
 *
 * ⚠ ГОМОГЛИФ. Бүгін Kronospan декорларында латын «K» кирилл regex-ін
 * үнсіз алдап өткен еді (docs/basis/import.md). Сол себепті мұндағы
 * позиция/тип белгілері («Н», «В», «НВ») латын да, кирилл де нұсқасын
 * қатар қабылдайды: `[НH]`, `[ВB]`.
 */
import pro100LibraryRaw from './generated/pro100Library.json'

// ── Типтер ───────────────────────────────────────────────────────────────────

/** Архивтегі шикі жол: тек атау мен бума жолы, бағдарлама мазмұны жоқ. */
export type Pro100RawEntry = {
  /** «Мебель»-ден файлдың бумасына дейінгі тізбек — breadcrumb осыдан құрылады. */
  path: string[]
  /** Файл аты, `.meb` кеңейтімісіз. */
  name: string
  /**
   * 'cabinet' — шкаф нөмірленуі (Н/В/2дв/Мойка) қолданылатын бумалар
   * (кухни, гардеробтар). 'accessory' — тұтқа/сорғыш/тоңазытқыш/жарық:
   * мүлде басқа атау конвенциясы, шкаф өрістері талданбайды.
   */
  group: 'cabinet' | 'accessory'
}

/** Атаудан бір мәнді оқылған позиция. 'combined' — «НВ…» (төмен+үстіңгі бір блокта). */
export type ParsedPosition = 'lower' | 'upper' | 'combined'

/** Атаудан талданған шкаф өрістері. Барлығы ЕРІКТІ — оқылмаса, undefined. */
export type ParsedCabinetInfo = {
  position?: ParsedPosition | undefined
  /**
   * Атаудағы шикі тип коды («В3», «Н1», «НВ2»...). PRO100-дың өз
   * ішкі мағынасы құжатталмаған, сондықтан МАҒЫНА ОЙЛАП ТАБЫЛМАЙДЫ —
   * тек шикі жол ретінде сақталады (фильтрде/іздеуде пайдалы).
   */
  variant?: string | undefined
  doorCount?: number | undefined
  drawerCount?: number | undefined
  /** true — атауда «мойка» сөзі дербес жол ретінде тұр. false/undefined емес: белгісіз болса жоқ делінбейді, жай айтылмаған. */
  hasSink?: boolean | undefined
  widthMm?: number | undefined
}

export type Pro100LibraryItem = Pro100RawEntry & {
  /** Тұрақты идентификатор: жол+атау негізінде, генерация арасында тұрақты. */
  id: string
  /** `group === 'cabinet'` болғанда ғана толтырылады, әйтпесе бос объект. */
  parsed: ParsedCabinetInfo
}

// ── Атау талдағышы (таза функция — тестте нақты аттармен тексеріледі) ───────

function cleanToken(token: string): string {
  // Жетек/соңғы «(», «)», «+», «.», «-» — бөлгіш белгілер, санды/кодты
  // бүркемелеп тұр («В3(1000)», «900.», «В - 300»).
  return token.replace(/^[(),+.-]+|[(),+.-]+$/g, '')
}

const POSITION_COMBINED_RE = /^[НH][ВB][1-9]?$/i
const POSITION_LOWER_VARIANT_RE = /^[НH][1-9]$/i
const POSITION_UPPER_VARIANT_RE = /^[ВB][1-9]$/i
const POSITION_LOWER_RE = /^[НH]$/i
const POSITION_UPPER_RE = /^[ВB]$/i
const VARIANT_ANY_RE = /^[НВHB][1-9]$/i
// «2дв», «1д», «2Дв.» — есік саны. Соңғы «в» ерікті: корпуста «1д» деп те кездеседі.
const DOOR_COUNT_RE = /^(\d+)[дД][вВ]?\.?$/
// «2выдвиж», «2выдвижных» — бір сөзге жабысқан ящик саны.
const DRAWER_GLUED_RE = /^(\d+)вы[дД]виж/i
const PURE_NUMBER_RE = /^\d{1,4}$/
// Файлдағы шын ені осы аралықта (мм) — одан тыс сан басқа мағынадағы код
// (SKU, тесік диаметрі) болу ықтималдығы жоғары.
const WIDTH_MIN_MM = 100
const WIDTH_MAX_MM = 3000

/**
 * Бір шкаф атауын талдайды. ТАЗА функция — тек `name` жолымен жұмыс
 * істейді, дерекқорға да, JSON-ға да тәуелді емес. Тест осыны нақты
 * `.meb` аттарымен тексереді (`tests/pro100Catalog.test.ts`).
 */
export function parseCabinetName(name: string): ParsedCabinetInfo {
  // «+», «(», «)» бөлгіш ретінде бос орынға ауыстырылады («НВ2 +1 ящик 400»
  // → «НВ2  1 ящик 400»), сандар арасындағы «х»/«x» да («650х650» — екі
  // өлшем бірге жазылған, «Трапеция 650х650»).
  const preprocessed = name
    .replace(/[()+]/g, ' ')
    .replace(/(?<=\d)[xXхХ](?=\d)/g, ' ')

  const tokens = preprocessed
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t.length > 0)

  const result: ParsedCabinetInfo = {}

  // Позиция — ТЕК бірінші токеннен: PRO100 конвенциясында ол әрқашан
  // жетекші тұрады («Н...», «В...», «НВ...»). Кез келген орында іздесек,
  // еркін мәтіндегі бөлек «в» (предлог) жалған позиция болып шығар еді.
  const t0 = tokens[0]
  if (t0) {
    if (POSITION_COMBINED_RE.test(t0)) {
      result.position = 'combined'
      result.variant = t0
    } else if (POSITION_LOWER_VARIANT_RE.test(t0)) {
      result.position = 'lower'
      result.variant = t0
    } else if (POSITION_UPPER_VARIANT_RE.test(t0)) {
      result.position = 'upper'
      result.variant = t0
    } else if (POSITION_LOWER_RE.test(t0)) {
      result.position = 'lower'
    } else if (POSITION_UPPER_RE.test(t0)) {
      result.position = 'upper'
    }
  }

  // Тип коды бірінші токенде табылмаса — қалған токендерден іздейміз
  // («Н В3 700»: «Н» — позиция, «В3» — бөлек токендегі тип коды).
  if (result.variant === undefined) {
    for (const token of tokens) {
      if (VARIANT_ANY_RE.test(token)) {
        result.variant = token
        break
      }
    }
  }

  for (const token of tokens) {
    const m = DOOR_COUNT_RE.exec(token)
    if (m) {
      result.doorCount = Number(m[1])
      break
    }
  }

  for (const token of tokens) {
    const m = DRAWER_GLUED_RE.exec(token)
    if (m) {
      result.drawerCount = Number(m[1])
      break
    }
  }
  if (result.drawerCount === undefined) {
    // «1000 1 ящик» — сан мен «ящик» бөлек токен, іргелес тұрады.
    for (let i = 0; i < tokens.length - 1; i++) {
      if (PURE_NUMBER_RE.test(tokens[i]!) && /^ящик/i.test(tokens[i + 1]!)) {
        result.drawerCount = Number(tokens[i])
        break
      }
    }
  }

  // Дербес «мойка» токені ғана есептеледі — «Посудомойка» (ыдыс жуу
  // машинасы) сөздің ІШІНДЕ «мойка» бар, бірақ мойка тумбасы емес.
  if (tokens.some((t) => t.toLowerCase() === 'мойка')) {
    result.hasSink = true
  }

  // Ені — тек БІРЕУ ғана бірегей кандидат болғанда («Угловой 780 (400)»
  // сияқты екі түрлі санда — қайсысы ені белгісіз, undefined қалады).
  const widthCandidates = new Set<number>()
  for (const token of tokens) {
    if (PURE_NUMBER_RE.test(token)) {
      const value = Number(token)
      if (value >= WIDTH_MIN_MM && value <= WIDTH_MAX_MM) widthCandidates.add(value)
    }
  }
  if (widthCandidates.size === 1) {
    result.widthMm = [...widthCandidates][0]
  }

  return result
}

// ── Толық каталог ────────────────────────────────────────────────────────────

const RAW_ENTRIES = pro100LibraryRaw as Pro100RawEntry[]

export const PRO100_LIBRARY: Pro100LibraryItem[] = RAW_ENTRIES.map((entry, index) => ({
  ...entry,
  // Жол+атау+индекс негізінде: бірдей атау әр түрлі бумада қайталанады
  // («Без фасада 350» бірнеше бумада бар), сондықтан индекс те кіреді.
  id: `p100-${index}-${entry.path.join('/')}/${entry.name}`,
  parsed: entry.group === 'cabinet' ? parseCabinetName(entry.name) : {},
}))

export const PRO100_CABINET_ITEMS = PRO100_LIBRARY.filter((i) => i.group === 'cabinet')
export const PRO100_ACCESSORY_ITEMS = PRO100_LIBRARY.filter((i) => i.group === 'accessory')

/**
 * Талдау пайызы (есеп үшін, §«Тексеру»). Әр өріс бөлек саналады — бір
 * атауда бірнешеуі бірге табылуы мүмкін.
 */
export function pro100ParseStats() {
  const total = PRO100_CABINET_ITEMS.length
  const count = (pred: (p: ParsedCabinetInfo) => boolean) =>
    PRO100_CABINET_ITEMS.filter((i) => pred(i.parsed)).length
  const withAny = count((p) => Object.keys(p).length > 0)
  return {
    totalCabinetEntries: total,
    totalEntries: PRO100_LIBRARY.length,
    position: count((p) => p.position !== undefined),
    variant: count((p) => p.variant !== undefined),
    doorCount: count((p) => p.doorCount !== undefined),
    drawerCount: count((p) => p.drawerCount !== undefined),
    hasSink: count((p) => p.hasSink === true),
    widthMm: count((p) => p.widthMm !== undefined),
    anyField: withAny,
    anyFieldPct: total === 0 ? 0 : Math.round((withAny / total) * 1000) / 10,
    widthMmPct: total === 0 ? 0 : Math.round((count((p) => p.widthMm !== undefined) / total) * 1000) / 10,
  }
}
