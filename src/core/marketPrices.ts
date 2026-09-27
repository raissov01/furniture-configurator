/**
 * НАРЫҚ БАҒАСЫ — жаңа цехтың әдепкі бағасы (пайдаланушы шешімі, 2026-09-26).
 *
 * Бұрын жаңа цехта бәрі 0 болатын: смета бос, тақтада «Цены не заданы».
 * Енді бастапқы баға — ҚР жеткізушілерінің АШЫҚ ұсыныстарының медианасы
 * (`.codex-runs/pricing-research/SUMMARY.md`, 2026-09-24). Цех оны өз
 * бағасымен ауыстырады; ауыстырылған баға «өз бағасы» болады да, нарық
 * деректері жаңарғанда ЕШҚАШАН қайта жазылмайды.
 *
 * ОЙДАН ЕШТЕҢЕ ЖОҚ (§10). Позицияның нарық бағасы тек бірлігі, қалыңдығы,
 * форматы (фурнитурада — бренді, түрі, накладкасы) дәл сәйкес ұсыныс болса
 * ғана беріледі. Сәйкесі жоқ позиция (ЛДСП 18 мм, минификс жиынтығы,
 * полкодержатель, упаковка, монтаж…) БОС қалады — цех өзі толтырады.
 * Қаптама бағасы данаға БӨЛІНБЕЙДІ, толық столешница метрге ҚАЙТА ЕСЕПТЕЛМЕЙДІ.
 *
 * АҚША — бүтін тиын. Ұсыныстар бүтін теңге; медиана тиынмен есептеледі
 * (жұп санда ортаңғы екеуінің ортасы — 50 тиынға дейін дәл).
 */
import type { ServiceBasis, ServiceId, ShopProfile } from './shop'

/** Жеткізушілер беттері тексерілген күн (бірінші зерттеу). */
export const MARKET_PRICE_DATE = '2026-09-24'
/**
 * Екінші зерттеу: `.codex-runs/lite/hardware-prices/` пен `lite/shop-rates/`
 * (бос қалған фурнитура мен цех қызметтері). Топтың күні — оның ұсыныстары
 * қаралған күн.
 */
export const MARKET_PRICE_DATE_0927 = '2026-09-27'

export type MarketOffer = {
  supplier: string
  city: string
  url: string
  /** Жеткізушінің атауы (дереккөздегідей). */
  name: string
  /** Бүтін теңге, жеткізуші жариялағандай. */
  priceKzt: number
}

export type MarketGroup = {
  id: string
  /** Салыстыру тобы — прайс панелінде көрінеді. */
  label: string
  unit: 'sheet' | 'lm' | 'pcs' | 'hole'
  dateSeen: string
  offers: MarketOffer[]
}

const offer = (supplier: string, city: string, url: string, name: string, priceKzt: number): MarketOffer =>
  ({ supplier, city, url, name, priceKzt })

const PROFI = 'PROFI KZ'
const PROFI_EGGER = 'https://profikz.kz/catalog/egger/listovye_materialy/ldsp_lmdf_egger/'
const EM = 'ЕвроМаркет'
const TASTAK = 'Тастак'
const MEB = 'Мебельщик'
const BLUM_AKTAU = 'Мебельная фурнитура Blum (furnitura7292.kz)'
const DAMEN = 'DAMEN-Mebel'
const CONFIRMAT = 'Конфирмат'
const CONFIRMAT_PRICE = 'https://www.confirmat.kz/pricelist'
const ORION = 'F.A.ORION'
const ZHANTIS = 'Zhantis'
const ZHANTIS_BOXES = 'https://zhantis.kz/product-groups/space-twin'
const D27 = MARKET_PRICE_DATE_0927

/**
 * Салыстыру топтары: тек «exact» ұсыныстар, қорда бар, ағымдағы тариф
 * (SUMMARY.md «Есептеу әдісі»). Әр топтың N-і мен медианасы SUMMARY-мен бірдей.
 */
export const MARKET_GROUPS: MarketGroup[] = [
  {
    id: 'ldsp-egger-16-2800x2070', label: 'ЛДСП Egger 16 мм, 2800×2070', unit: 'sheet', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(PROFI, 'Астана', `${PROFI_EGGER}45075/`, 'ЛДСП Акапулько', 29620),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45001/`, 'ЛДСП Акация лэйклэнд светлая', 26090),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45055/`, 'ЛДСП Акация шеффилд натуральный', 29620),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45023/`, 'ЛДСП Алебастр белый', 25290),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45043/`, 'ЛДСП Ангора серая', 26870),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45019/`, 'ЛДСП Дуб каселла натуральный', 42190),
      offer(PROFI, 'Астана', `${PROFI_EGGER}45040/`, 'ЛДСП Белый классический', 22760),
    ],
  },
  {
    id: 'hdf-laminated-3-2800x2070', label: 'ХДФ облицованный 3 мм, 2800×2070', unit: 'sheet', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/khdf_belyy_2_8.html', 'ХДФ ақ 0101 PE, ламинатталған', 7000),
      offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/khdf_buk_bavariya_2_8.html', 'ХДФ бук бавария 0381 PE, ламинатталған', 7500),
      offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/khdf_venge_2_8.html', 'ХДФ венге цаво 9182 PE, ламинатталған', 7500),
      offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/khdf_dub_kraft_zolotoy_2_8.html', 'ХДФ дуб крафт алтын K003 PE, ламинатталған', 7500),
      offer(PROFI, 'Астана', 'https://profikz.kz/catalog/listovye_materialy_1/khdf_/', 'ХДФ лакированная белая экспо', 7000),
      offer(PROFI, 'Астана', 'https://profikz.kz/catalog/listovye_materialy_1/khdf_/', 'ХДФ лакированная кашемир', 7500),
    ],
  },
  {
    id: 'mdf-raw-16-2800x2070', label: 'МДФ шлифованный 16 мм, 2800×2070', unit: 'sheet', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer('Квант-Торг Сервис', 'Алматы', 'https://kvant-torg.kz/price/', 'МДФ 16 мм, Ресей/Калуга, өңделмеген', 20900),
      offer('ALPI CENTR', 'Алматы', 'https://alpi-centr.kz/g484947-mdf', 'Kronostar МДФ 16 мм, шлифованный', 21000),
    ],
  },
  {
    id: 'edge-pvc-04-19', label: 'Кромка ПВХ 0.4 мм, ширина 19 мм', unit: 'lm', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(TASTAK, 'Астана', 'https://tastakshop.kz/catalog/mebelnaya_furnitura/32503/', 'UP ПВХ Дуб галиано 19/0,4', 33),
      offer(TASTAK, 'Астана', 'https://tastakshop.kz/catalog/mebelnaya_furnitura/32504/', 'UP ПВХ Дуб сантана 19/0,4', 33),
    ],
  },
  {
    id: 'edge-pvc-1-19-retail', label: 'Кромка ПВХ 1 мм, ширина 19 мм, розница', unit: 'lm', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(TASTAK, 'Астана', 'https://tastakshop.kz/catalog/mebelnaya_furnitura/32508/', 'UP ПВХ Выбеленное дерево 19/1', 95),
      offer(TASTAK, 'Астана', 'https://tastakshop.kz/catalog/mebelnaya_furnitura/kromka_ldsp/', 'UP ПВХ Ясень шимо светлый 19/1', 91),
      offer('KROMKA.KZ', 'Алматы', 'https://kromka.kz/g4400470-odnotonnaya-matovaya-kromka', 'ПВХ күңгірт көк 19/1', 45),
    ],
  },
  {
    id: 'edge-pvc-2-19-retail', label: 'Кромка ПВХ 2 мм, ширина 19 мм, розница', unit: 'lm', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(TASTAK, 'Астана', 'https://tastakshop.kz/catalog/mebelnaya_furnitura/32515/', 'UP ПВХ Белоснежный 19/2', 141),
    ],
  },
  {
    id: 'confirmat-7x50-single', label: 'Конфирмат 7×50, за штуку', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer('12 Месяцев', 'Астана', 'https://12.kz/products/0443777', 'Soller винт-конфирмат 7×50 мм, ішкі алтықырлы', 20),
    ],
  },
  {
    id: 'hinge-blum-soft-overlay', label: 'Петля Blum накладная с доводчиком', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(BLUM_AKTAU, 'Ақтау',
        'https://furnitura7292.kz/product/clip-top-blumotion-standartnaja-petlja-110-nakladnaja-chashka-petli-na-shurupy-cvet-nikelirov/',
        'CLIP top BLUMOTION 110° накладная петля', 2136),
    ],
  },
  {
    id: 'hinge-hettich-soft-overlay', label: 'Петля Hettich накладная с доводчиком', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/petlya_sensys/23882/', 'Sensys 110° накладная петля, демпфермен', 1581),
    ],
  },
  {
    id: 'hinge-boyard-soft-overlay', label: 'Петля Boyard накладная с доводчиком', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/boyard_1/63240/', 'Boyard CLIP-ON 105° накладная петля, доводчик', 432),
    ],
  },
  {
    id: 'hinge-gtv-soft-overlay', label: 'Петля GTV накладная с доводчиком', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/gtv_innovo/43655/', 'GTV сыртқы ілмек, доводчик және clip табан', 557),
    ],
  },
  {
    id: 'runner-roller-pair', label: 'Направляющие роликовые, комплект', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/boyard/43527/', 'Boyard роликті бағыттауыш 250 мм, ақ, 01', 720),
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/boyard/43531/', 'Boyard роликті бағыттауыш 300 мм, ақ, 03', 976),
    ],
  },
  {
    id: 'runner-ball-pair', label: 'Направляющие шариковые, комплект (доводчик не указан)', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(MEB, 'Астана', 'https://mebelschik.kz/catalog/teleskopicheskie/24245/', 'Шарикті телескопиялық бағыттауыш 300 мм', 1015),
      offer('F.A.ORION', 'Шымкент', 'https://fa-orion.kz/p76722567-mebelnaya-napravlyayuschaya-teleskop.html',
        'Шарикті телескопиялық бағыттауыш 450 мм', 1229),
    ],
  },
  {
    id: 'runner-blum-tandem-partial', label: 'Blum TANDEM, частичное выдвижение, комплект', unit: 'pcs', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer(BLUM_AKTAU, 'Ақтау', 'https://furnitura7292.kz/product/tandem-chast-l300-s-zamkami/',
        'TANDEM BLUMOTION 300 мм, ішінара шығу, бекіткіштерімен', 9564),
      offer(BLUM_AKTAU, 'Ақтау', 'https://furnitura7292.kz/product/tandem-chast-l450-s-zamkami-2/',
        'TANDEM BLUMOTION 450 мм, ішінара шығу, бекіткіштерімен', 9805),
    ],
  },
  {
    id: 'service-cutting-ldsp-sheet', label: 'Распил ЛДСП, за лист', unit: 'sheet', dateSeen: MARKET_PRICE_DATE,
    offers: [
      offer('RoomSet', 'Астана', 'https://roomset.kz/tseny/', 'ЛДСП стандарт парағын кесу', 2000),
      offer(DAMEN, 'Астана', 'https://damen-mebel.kz/raspil/', 'Өздерінен ЛДСП алғанда және кромкалау тапсырысымен кесу', 1500),
      offer(DAMEN, 'Астана', 'https://damen-mebel.kz/raspil/', 'Басқа дүкен ЛДСП-сын кромкалаумен кесу', 2000),
      offer(DAMEN, 'Астана', 'https://damen-mebel.kz/raspil/', 'Egger ЛДСП-сын кромкалаумен кесу', 2000),
      offer(DAMEN, 'Астана', 'https://damen-mebel.kz/raspil/', 'ЛДСП-ны кромкасыз кесу', 2500),
    ],
  },
  {
    id: 'service-drilling-hole', label: 'Присадка, за отверстие', unit: 'hole', dateSeen: MARKET_PRICE_DATE,
    offers: [offer('RoomSet', 'Астана', 'https://roomset.kz/tseny/', 'Стандарт тесікті бұрғылау', 35)],
  },
  {
    // Тек «listed», түзу жиек, лента ені 19 мм-ді қамтиды. RoomSet 200 — «от»,
    // Mebex — лента ені 16/32 мм, Евромаркет — 2024 прайсы: кірмеді.
    id: 'service-edging-metre', label: 'Облицовка кромкой ПВХ, прямая, за метр', unit: 'lm', dateSeen: D27,
    offers: [
      offer(DAMEN, 'Астана', 'https://damen-mebel.kz/raspil/', 'ПВХ кромка жапсыру', 150),
      offer('ДСП Центр', 'Алматы', 'https://dspc.kz/services', 'ПВХ түзу кромкалау, лента ені 23 мм-ге дейін', 195),
    ],
  },

  // ── 2026-09-27: `.codex-runs/lite/hardware-prices/prices.json` ──
  // Тек дана/жиынтық бағасы жарияланған ұсыныстар; қаптама (10 дана)
  // данаға бөлінбеді, ҚҚС белгісіз жолдарға салық қосылмады.
  {
    id: 'confirmat-cap-single', label: 'Заглушка конфирмата, за штуку', unit: 'pcs', dateSeen: D27,
    offers: [offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/zaglushki_nakonechniki/', 'Конфирмат заглушкасы, қара', 3)],
  },
  {
    id: 'hinge-mounting-plate', label: 'Планка ответная под петлю', unit: 'pcs', dateSeen: D27,
    offers: [
      offer(CONFIRMAT, 'Астана', CONFIRMAT_PRICE, 'Boyard H5010, петляға қарсы планка NEO H0', 110),
      offer('Häfele Kazakhstan', 'Алматы', 'https://hafeleshop.kz/mebelnye-petli', 'Häfele 311.70.752, монтаж планкасы Metalla 540 SM', 176),
    ],
  },
  {
    // Каталогтағы «Ручка-скоба» межцентровоесіз — ұзындықтары араласады
    // (роликті бағыттағыштағыдай); атауында көрінеді.
    id: 'handle-bar-96-160', label: 'Ручка-скоба, 96 и 160 мм', unit: 'pcs', dateSeen: D27,
    offers: [
      offer(EM, 'Қарағанды', 'https://www.em-c.kz/catalog/rossiya/', 'Скоба тұтқа RS-105-96, 96 мм, қара', 560),
      offer(PROFI, 'Астана', 'https://www.profikz.kz/catalog/litsevaya_furnitura/ruchki/skoby/58354/', 'Скоба тұтқа 608-160, 160 мм, қара', 1360),
    ],
  },
  {
    id: 'handle-rail-96-160', label: 'Ручка-рейлинг, 96–160 мм', unit: 'pcs', dateSeen: D27,
    offers: [
      offer(EM, 'Қарағанды', 'https://www.em-c.kz/catalog/rossiya/', 'Рейлинг тұтқа R-3010-96, 96 мм, хром', 540),
      offer(PROFI, 'Астана', 'https://www.profikz.kz/catalog/litsevaya_furnitura/ruchki/reylingi/57692/', 'Рейлинг тұтқа RIFF 096-10-096, 96 мм, хром', 365),
      offer(EM, 'Қарағанды', 'https://em-c.kz/catalog/r_3031_128_ruchka_reyling_128_mm_khrom.html', 'Рейлинг тұтқа R-3031-128, 128 мм, хром', 940),
      offer(PROFI, 'Астана', 'https://profikz.kz/catalog/litsevaya_furnitura/ruchki/reylingi/57653/', 'Рейлинг тұтқа RIFF 096-12-128, 128 мм', 737),
      offer(EM, 'Қарағанды', 'https://www.em-c.kz/catalog/rossiya/', 'Рейлинг тұтқа R-3031-160, 160 мм, хром', 1250),
    ],
  },
  {
    id: 'shelf-pin-metal-5-single', label: 'Полкодержатель металлический Ø5, за штуку', unit: 'pcs', dateSeen: D27,
    offers: [offer(CONFIRMAT, 'Астана', 'https://confirmat.kz/category/21', 'Металл полкодержатель Ø5 мм, 26.01.144', 6)],
  },
  {
    id: 'dowel-8x30-single', label: 'Шкант 8×30, за штуку', unit: 'pcs', dateSeen: D27,
    offers: [
      offer(CONFIRMAT, 'Астана', 'https://confirmat.kz/category/22', 'Шкант ағаш 8×30 мм, насечка', 5),
      offer(ORION, 'Шымкент', 'https://fa-orion.kz/p93988447-shkant-mebelnyj-830.html', 'Шкант жиһаздық 8×30 мм', 3),
    ],
  },
  {
    // Жиынтық: эксцентрик + дюбель + футорка; эксцентрик Ø15 — өндіруші
    // карточкасы (boyard.biz, ST01/47/6/Zn/01, 2026-09-27 қаралды).
    id: 'minifix-15-set', label: 'Минификс 15 мм, комплект (эксцентрик + дюбель + футорка)', unit: 'pcs', dateSeen: D27,
    offers: [offer(CONFIRMAT, 'Астана', CONFIRMAT_PRICE, 'Boyard ST01/47/6/Zn/01, толық жиынтық', 58)],
  },
  {
    id: 'runner-ball-400-basic', label: 'Направляющие шариковые 400 мм без доводчика, комплект', unit: 'pcs', dateSeen: D27,
    offers: [offer(CONFIRMAT, 'Астана', CONFIRMAT_PRICE, 'Boyard DB3501Zn/400, толық шығу, доводчиксіз', 1004)],
  },
  {
    id: 'box-blum-tandembox-450', label: 'Blum TANDEMBOX antaro M, 450 мм, комплект', unit: 'pcs', dateSeen: D27,
    offers: [offer(ZHANTIS, 'Алматы', ZHANTIS_BOXES, 'TANDEMBOX antaro M+D, 450 мм, ені 250 мм дейін (BS001490)', 32122)],
  },
  {
    id: 'box-blum-legrabox-450', label: 'Blum LEGRABOX pure M, 450 мм, комплект', unit: 'pcs', dateSeen: D27,
    offers: [offer(ZHANTIS, 'Алматы', ZHANTIS_BOXES, 'LEGRABOX pure M+C, 450 мм, ені 250 мм дейін (BS001214)', 55797)],
  },
]

const GROUP_BY_ID = new Map(MARKET_GROUPS.map((g) => [g.id, g]))

export function marketGroup(id: string): MarketGroup | undefined {
  return GROUP_BY_ID.get(id)
}

/** Медиана, бүтін тиын. Ұсыныс теңгесі бүтін болғандықтан, жұп санда да бүтін. */
export function marketMedianTiyn(group: MarketGroup): number {
  const sorted = group.offers.map((o) => o.priceKzt * 100).sort((a, b) => a - b)
  if (sorted.length === 0) throw new Error(`нарық тобы бос: ${group.id}`)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  if (!Number.isInteger(median)) throw new Error(`медиана бүтін тиын емес: ${group.id}`)
  return median
}

/**
 * Позицияның кілті: `material:<id>`, `edgeBand:<id>`, `hardware:<id>`,
 * `service:<ServiceId>`. Тақта (постформинг) кілті жоқ — оның нарық бағасы
 * метрге келтірілмеген.
 */
export type PriceKey = string

type MarketDefault = { group: string; basis?: ServiceBasis }

const SEED_DECORS = ['w980', 'u104', 'h1145', 'h3303'] as const

/**
 * Каталог позициясы → нарық тобы. Тек дәл сәйкестер:
 * - `ldsp16-*` — Egger декорлары (W980, U104, H1145, H3303), 16 мм, 2800×2070;
 * - `ldsp18-*`, `ldsp16-kr-w980` (2750×1830, Kronospan) — дерек ЖОҚ, бос;
 * - кромкаларда ені жазылмаған: 16 мм ЛДСП-ның корпус кромкасы — 19 мм,
 *   сондықтан 19 мм бөлшек топ алынды (топ атауында ені көрінеді);
 * - ілгектер: бренді, накладкасы, доводчигі сәйкес ұсыныс; «без пружины» — дерек жоқ;
 * - қызметтер: тек әдепкі негізбен (лист / отверстие / метр кромки).
 *
 * 2026-09-27 деректерінен ӘДЕЙІ БОС қалғандар (себебі — есепте):
 * - Häfele ілгектері — накладкасы карточкада жоқ; Boyard серіппесізі —
 *   полунакладная/вкладная 90°; брендсіз ілгек, DTC — баға жоқ;
 * - `lift-flap` — тек Blum AVENTOS HK-S, жалпы көтергіштің орнына жүрмейді;
 * - `leg-100` — «регулируемая» расталмаған; `rod-25`/`rod-bracket` — ұсыныс
 *   сопақ штангаға, 3 м бұйымды метрге бөлмейміз; купе — тек тік профиль
 *   мен ролик, біздің «рельс» пен «профиль + ролик» жиынтығы емес;
 * - постформинг — толық бұйым бағасы метрге бөлінген (баламасы), алынбайды;
 * - `assembly`/`installation` — ұсыныс «за модуль», бізде м²/ені метрі;
 *   `packing` — дерек жоқ.
 */
export const MARKET_DEFAULTS: Record<PriceKey, MarketDefault> = {
  ...Object.fromEntries(SEED_DECORS.flatMap((d) => [
    [`material:ldsp16-${d}`, { group: 'ldsp-egger-16-2800x2070' }],
    [`edgeBand:pvc04-${d}`, { group: 'edge-pvc-04-19' }],
    [`edgeBand:pvc1-${d}`, { group: 'edge-pvc-1-19-retail' }],
    [`edgeBand:pvc2-${d}`, { group: 'edge-pvc-2-19-retail' }],
  ])),
  'material:hdf3-white': { group: 'hdf-laminated-3-2800x2070' },
  'material:hdf3-brown': { group: 'hdf-laminated-3-2800x2070' },
  'material:mdf16-paint': { group: 'mdf-raw-16-2800x2070' },
  'hardware:confirmat-7x50': { group: 'confirmat-7x50-single' },
  'hardware:hinge-blum-soft': { group: 'hinge-blum-soft-overlay' },
  'hardware:hinge-hettich-soft': { group: 'hinge-hettich-soft-overlay' },
  'hardware:hinge-boyard-soft': { group: 'hinge-boyard-soft-overlay' },
  'hardware:hinge-gtv-soft': { group: 'hinge-gtv-soft-overlay' },
  'hardware:runner-roller': { group: 'runner-roller-pair' },
  'hardware:runner-ball': { group: 'runner-ball-pair' },
  'hardware:runner-tandem': { group: 'runner-blum-tandem-partial' },
  'hardware:confirmat-cap': { group: 'confirmat-cap-single' },
  'hardware:hinge-plate': { group: 'hinge-mounting-plate' },
  'hardware:handle-bar': { group: 'handle-bar-96-160' },
  'hardware:handle-rail': { group: 'handle-rail-96-160' },
  'hardware:shelf-pin-5': { group: 'shelf-pin-metal-5-single' },
  'hardware:dowel-8x30': { group: 'dowel-8x30-single' },
  'hardware:minifix-15': { group: 'minifix-15-set' },
  'hardware:runner-ball-400': { group: 'runner-ball-400-basic' },
  'hardware:box-tandembox': { group: 'box-blum-tandembox-450' },
  'hardware:box-legrabox': { group: 'box-blum-legrabox-450' },
  'service:cutting': { group: 'service-cutting-ldsp-sheet', basis: 'sheet' },
  'service:drilling': { group: 'service-drilling-hole', basis: 'hole' },
  'service:edging': { group: 'service-edging-metre', basis: 'edgeMetre' },
}

/** Позицияның бағасы нарықтан алынғанының белгісі (профильде сақталады). */
export type MarketPriceMark = {
  group: string
  /** Қойылған нарық бағасы, тиын. Қазіргі баға одан өзгерсе — «өз бағасы». */
  priceTiyn: number
  dateSeen: string
  /** Медиана неше ұсыныстан. */
  offers: number
}

export type MarketQuote = MarketPriceMark & { label: string; suppliers: number; basis?: ServiceBasis }

/** Позицияның ағымдағы нарық бағасы; дерек жоқ болса null. */
export function marketQuote(key: PriceKey): MarketQuote | null {
  const entry = MARKET_DEFAULTS[key]
  const group = entry ? GROUP_BY_ID.get(entry.group) : undefined
  if (!entry || !group) return null
  return {
    group: group.id,
    priceTiyn: marketMedianTiyn(group),
    dateSeen: group.dateSeen,
    offers: group.offers.length,
    label: group.label,
    suppliers: new Set(group.offers.map((o) => o.supplier)).size,
    ...(entry.basis ? { basis: entry.basis } : {}),
  }
}

const markOf = (q: MarketQuote): MarketPriceMark =>
  ({ group: q.group, priceTiyn: q.priceTiyn, dateSeen: q.dateSeen, offers: q.offers })

type Position = { value: number; basis?: ServiceBasis }

/** Позицияның ағымдағы бағасы; профильде ондай позиция жоқ болса null. */
function positionOf(shop: ShopProfile, key: PriceKey): Position | null {
  const sep = key.indexOf(':')
  const kind = key.slice(0, sep)
  const id = key.slice(sep + 1)
  if (kind === 'material') {
    const m = shop.materials.find((x) => x.id === id)
    return m && !m.slab ? { value: m.pricePerSheet } : null
  }
  if (kind === 'edgeBand') {
    const b = shop.edgeBands.find((x) => x.id === id)
    return b ? { value: b.pricePerMeter } : null
  }
  if (kind === 'hardware') {
    const h = shop.hardware.find((x) => x.id === id)
    return h ? { value: h.pricePerUnit } : null
  }
  if (kind === 'service' && Object.hasOwn(shop.services, id)) {
    const s = shop.services[id as ServiceId]
    return { value: s.rate, basis: s.basis }
  }
  return null
}

/** Бағаны (және қызметте — негізін) жазу. Басқа ештеңе өзгермейді. */
function withPosition(shop: ShopProfile, key: PriceKey, value: number, basis?: ServiceBasis): ShopProfile {
  const sep = key.indexOf(':')
  const kind = key.slice(0, sep)
  const id = key.slice(sep + 1)
  if (kind === 'material') {
    return { ...shop, materials: shop.materials.map((m) => m.id === id ? { ...m, pricePerSheet: value } : m) }
  }
  if (kind === 'edgeBand') {
    return { ...shop, edgeBands: shop.edgeBands.map((b) => b.id === id ? { ...b, pricePerMeter: value } : b) }
  }
  if (kind === 'hardware') {
    return { ...shop, hardware: shop.hardware.map((h) => h.id === id ? { ...h, pricePerUnit: value } : h) }
  }
  const sid = id as ServiceId
  return {
    ...shop,
    services: { ...shop.services, [sid]: { basis: basis ?? shop.services[sid].basis, rate: value } },
  }
}

/** Белгі әлі жарамды ма: баға да, қызметтің негізі де нарықтағыдай. */
function markHolds(shop: ShopProfile, key: PriceKey, mark: MarketPriceMark): boolean {
  const pos = positionOf(shop, key)
  if (!pos || pos.value !== mark.priceTiyn) return false
  const basis = MARKET_DEFAULTS[key]?.basis
  return basis === undefined || pos.basis === basis
}

/**
 * Цех өзгерткен позициялардың белгісін алып тастау. Белгісіз баға — «өз
 * бағасы»: кейін нарық жаңарса да оған ешкім тимейді.
 */
export function pruneMarketMarks(shop: ShopProfile): ShopProfile {
  const marks = shop.marketPrices ?? {}
  const kept = Object.fromEntries(Object.entries(marks).filter(([key, mark]) => markHolds(shop, key, mark)))
  return Object.keys(kept).length === Object.keys(marks).length && shop.marketPrices
    ? shop
    : { ...shop, marketPrices: kept }
}

export type PriceOrigin = 'market' | 'own' | 'empty'

export function priceOrigin(shop: ShopProfile, key: PriceKey): PriceOrigin {
  const mark = shop.marketPrices?.[key]
  if (mark && markHolds(shop, key, mark)) return 'market'
  const pos = positionOf(shop, key)
  return pos && pos.value > 0 ? 'own' : 'empty'
}

function setMarket(shop: ShopProfile, key: PriceKey, quote: MarketQuote): ShopProfile {
  const next = withPosition(shop, key, quote.priceTiyn, quote.basis)
  return { ...next, marketPrices: { ...(shop.marketPrices ?? {}), [key]: markOf(quote) } }
}

/**
 * Бос (0) позицияларды нарық бағасымен толтыру. Бағасы бар позицияға ТИМЕЙДІ,
 * негізі басқа қызметке де тимейді. Прайс-парақты синхрондау — шақырушыда.
 */
export function applyMarketDefaults(shop: ShopProfile): ShopProfile {
  let out = shop
  for (const key of Object.keys(MARKET_DEFAULTS)) {
    const quote = marketQuote(key)
    const pos = positionOf(out, key)
    if (!quote || !pos || pos.value !== 0) continue
    if (quote.basis !== undefined && pos.basis !== quote.basis) continue
    out = setMarket(out, key, quote)
  }
  return out
}

/**
 * Нарық деректері жаңарғанда: белгісі жарамды позициялар жаңа медианаға
 * көшеді. Өз бағасы (белгісіз) мен бос позициялар ӨЗГЕРМЕЙДІ.
 */
export function refreshMarketPrices(shop: ShopProfile): ShopProfile {
  let out = pruneMarketMarks(shop)
  for (const key of Object.keys(out.marketPrices)) {
    const quote = marketQuote(key)
    if (!quote) continue
    const mark = out.marketPrices[key]!
    if (mark.priceTiyn === quote.priceTiyn && mark.dateSeen === quote.dateSeen && mark.offers === quote.offers) continue
    out = setMarket(out, key, quote)
  }
  return out
}

/** Бір позицияны нарық бағасына қайтару. Дерегі жоқ позицияда — өзгеріссіз. */
export function resetPositionToMarket(shop: ShopProfile, key: PriceKey): ShopProfile {
  const quote = marketQuote(key)
  if (!quote || !positionOf(shop, key)) return shop
  return setMarket(shop, key, quote)
}

/** Нарық дерегі бар барлық позицияны нарыққа қайтару (өз бағасы да). */
export function resetAllPositionsToMarket(shop: ShopProfile): ShopProfile {
  let out = shop
  for (const key of Object.keys(MARKET_DEFAULTS)) out = resetPositionToMarket(out, key)
  return out
}

/** Нарық белгісі бар позициялар саны — ескертпе көрсету үшін. */
export function marketPricedCount(shop: ShopProfile): number {
  return Object.keys(pruneMarketMarks(shop).marketPrices).length
}
