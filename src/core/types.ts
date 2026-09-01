/**
 * Домендік типтер. Тек таза TypeScript — React, three.js, Next.js импорты ЖОҚ.
 *
 * Өлшем бірлігі: миллиметр, БҮТІН сан (жалғыз ерекшелік — кромка қалыңдығы
 * 0.4 мм және бұрғылау тереңдігі 12.5 мм, олар физикалық константа).
 * Ақша: минор бірлік (тиын), ешқашан float емес.
 */

// ── Материалдар ──────────────────────────────────────────────────────────────

export type Material = {
  id: string
  /** "ЛДСП Egger H1145 Дуб Бардолино" */
  name: string
  /** 16 | 18 | 10 | 3 (ХДФ) */
  thickness: number
  /** Парақ ұзындығы, мм (2800) */
  sheetWidth: number
  /** Парақ ені, мм (2070) */
  sheetHeight: number
  /** true → раскройда деталь 90°-қа БҰРЫЛМАЙДЫ (текстура бағыты) */
  hasGrain: boolean
  /** Бір парақтың бағасы, тиын */
  pricePerSheet: number
  /** Парақтың әр жағынан кесіліп тасталатын жарамсыз жолақ, мм */
  trimEdge: number
  /**
   * Осы декордың үнсіз кромка жиынтығы (A4). Декоры сәйкес келмейтін кромка
   * жабысса — брак, сондықтан материал өз лентасын өзі көрсетеді.
   */
  defaultEdging?: EdgePolicy | undefined
  /**
   * Декордың КӨРІНІСІ: түсі мен түрі. Бұл өндіріске әсер етпейді — тек 3D мен
   * материал таңдағышта плитаның шын түсін көрсету үшін. Болмаса, көрініс
   * бейтарап сұр түспен салынады.
   */
  decor?: Decor | undefined
}

/** Плитаның сырт көрінісі. `wood` — текстуралы, `solid` — біртүсті. */
export type Decor = {
  /** Негізгі түсі, CSS hex */
  color: string
  kind: 'solid' | 'wood'
}

export type EdgeBand = {
  id: string
  /** Дисплей үшін ("Кромка ПВХ 2 мм H1145") — спецке қосымша, экспортта керек */
  name: string
  /** 0.4 | 1 | 2 мм */
  thickness: number
  /** Бір метрдің бағасы, тиын */
  pricePerMeter: number
}

/** Панель жиегіне жабысатын кромка, немесе null — кромкасыз */
export type EdgeSpec = { bandId: string } | null

/**
 * L1/L2 — панельдің ұзын екі жиегі (finishedLength бойымен),
 * W1/W2 — қысқа екі жиегі (finishedLength-тің екі ұшы).
 * Келісім: L1 = алдыңғы/көрінетін жиек, W1 = үстіңгі (тік панельде) немесе
 * сол жақ (жатық панельде).
 */
export type PanelEdges = { L1: EdgeSpec; L2: EdgeSpec; W1: EdgeSpec; W2: EdgeSpec }

// ── Панель ───────────────────────────────────────────────────────────────────

export type PanelRole =
  | 'side' | 'top' | 'bottom' | 'shelf' | 'divider' | 'back'
  | 'front' | 'drawerSide' | 'drawerBack' | 'drawerBottom' | 'plinth' | 'rail'
  /** Пайдаланушы қосқан ЕРІКТІ деталь (`CustomPart`). */
  | 'custom'

/**
 * Кабинет координаталары: X — солдан оңға (ені), Y — төменнен жоғары (биіктігі),
 * Z — алдыңғы беттен артқа қарай (тереңдігі). Нөл нүкте — корпустың
 * алды-төмен-сол бұрышы. Накладной фасад корпустың АЛДЫНДА тұрады, сондықтан
 * оның z-і теріс (−frontThickness .. 0).
 */
export type Axis = 'x' | 'y' | 'z'

/** Панельдің локал өстері (ұзындық/ені/қалыңдығы) әлем өстеріне қалай түседі */
export type Orientation = { length: Axis; width: Axis; thickness: Axis }

import type { HandleModel, HandleSpec, HingeSystem } from './fittings'
import type { ApplianceKind, FillingKind } from './filling'
import type { DrillEdits } from './drillEdits'
import type { MillingPath, MillingSpec } from './milling'

export type Vec3 = { x: number; y: number; z: number }

export type DrillPurpose =
  | 'confirmat' | 'dowel' | 'minifix' | 'shelfPin' | 'hinge' | 'runner' | 'handle'

/**
 * Панельдің локал координаталары (присадка мен DXF үшін):
 *
 *   local x — finishedLength бойымен, W1 жиегінен W2 жиегіне қарай
 *   local y — finishedWidth  бойымен, L1 жиегінен L2 жиегіне қарай
 *
 * Әлем өстерімен байланысы: local x = orientation.length өсі,
 * local y = orientation.width өсі, екеуі де оң бағытта. Сондықтан:
 *   тік панельде (боковина, перегородка) x төменнен жоғары, y алдан артқа
 *   жатық панельде (крышка, дно, полка)  x солдан оңға,  y алдан артқа
 *   алға қараған панельде (фасад, арт)   x төменнен жоғары, y солдан оңға
 *
 * Бұрғылау координаталары ӘРҚАШАН РЕЗ панелінде беріледі (станок соны көреді),
 * яғни готовый координатадан W1/L1 кромкасының қалыңдығы шегерілген.
 */
export type Drill = {
  /**
   * inner/outer — панельдің кең беттері (inner корпустың ішіне қарайды).
   * edgeXX — панельдің торц беті; ондағы x сол жиек бойымен, y қалыңдық
   * бойымен (әдетте t/2 — торцтың дәл ортасы).
   */
  face: 'inner' | 'outer' | 'edgeL1' | 'edgeL2' | 'edgeW1' | 'edgeW2'
  /** Сол беттің сол-төменгі бұрышынан, мм */
  x: number
  y: number
  diameter: number
  depth: number
  purpose: DrillPurpose
  /**
   * Осы тесік қай фурнитураға арналған (`ShopProfile.hardware[].id`).
   *
   * Смета тесіктен фурнитураны САНАЙДЫ, ал бренд фасадқа қарай әртүрлі
   * болуы мүмкін. Диаметр бойынша қайта болжаудың орнына тесіктің өзі
   * қай позицияға тиесілі екенін алып жүреді.
   */
  hardwareId?: string | undefined
}

/**
 * Фрезермен ойылатын паз (арт қабырғаға). Орта сызығы РЕЗ координатасында,
 * панельдің локал өстерімен беріледі.
 */
export type Groove = {
  face: 'inner' | 'outer'
  x1: number
  y1: number
  x2: number
  y2: number
  /** Фреза ені — ішіне отыратын материалдың қалыңдығы */
  width: number
  /** Панельге қаншаға кіреді */
  depth: number
}

/**
 * Қиғаш кесік (мансарда шкафы).
 *
 * Панельдің ӨЛШЕМІ бұрынғыдай ЗАГОТОВКАНЫҢ габариті: станок алдымен
 * тікбұрышты кеседі, содан кейін қиғашты кеседі. Раскрой да сол габаритпен
 * жүреді — бұл әдейі: гильотин трапецияны кеспейді, ал цех солай істейді.
 *
 * Сандар — панельдің ЛОКАЛ ұзындығы (x осі) екі жиегінде:
 * `lengthAtStart` — локал y = 0 жиегінде, `lengthAtEnd` — y = ені жиегінде.
 * Екеуі тең болмаса, деталь трапеция.
 */
/**
 * Трапеция болып кесілетін деталь. Заготовка ТІКБҰРЫШ болып қалады
 * (finishedLength × finishedWidth) — станок алдымен оны кеседі, сосын қиғашты.
 *
 * ЕКІ ТҮРІ БАР, әрқайсысы ӨЗ ОСІ бойынша өзгереді. Оларды шатастыруға
 * болмайды: біреуін екіншісінің орнына қойсаң, деталь 90°-қа бұрылып кетеді
 * де, оны тек цехта байқайсың.
 */
export type PanelBevel =
  /**
   * ҰЗЫНДЫҚ ен бойымен өзгереді. Мансарданың бүйірі: биіктігі алдынан артына
   * қарай төмендейді. Материал ұзындық осінің БАСЫНА тураланады.
   */
  | { lengthAtStart: number; lengthAtEnd: number }
  /**
   * ЕН ұзындық бойымен өзгереді. Бұрыштық (переходной) корпустың крышкасы:
   * тереңдігі солдан оңға қарай өзгереді.
   *
   * `alignWidth` — материал ен осінің қай ұшына тураланатыны. Бұрыштық
   * корпуста ол `'end'`: арты ҚАБЫРҒАҒА тіреледі, ал қиғаш алдыңғы жиекте
   * болады. Тураланымды жасырын келісім қылуға болмайды — сол себепті ол
   * өрісте айқын тұр.
   */
  | { widthAtStart: number; widthAtEnd: number; alignWidth: 'start' | 'end' }

/** Қиғаш ЕН бойынша ма (бұрыштық корпус) әлде ҰЗЫНДЫҚ бойынша ма (мансарда)? */
export function isWidthBevel(
  b: PanelBevel,
): b is { widthAtStart: number; widthAtEnd: number; alignWidth: 'start' | 'end' } {
  return 'widthAtStart' in b
}

export type Panel = {
  id: string
  role: PanelRole
  /** Цехқа арналған атау: "Боковина левая" */
  label: string
  materialId: string

  /** ГОТОВЫЙ өлшем — жиналған деталь, кромкасымен бірге (КЛИЕНТ көреді) */
  finishedLength: number
  finishedWidth: number

  /** РЕЗ өлшемі — станок нақты кесетін сан (ЦЕХ көреді). §4.3 қара. */
  cutLength: number
  cutWidth: number

  edges: PanelEdges
  /** Материалда текстура бар болса, ол finishedLength бойымен жүре ме */
  grainAlongLength: boolean

  /**
   * Әрқашан 1: generateCabinet әр физикалық детальді жеке Panel етіп қайтарады,
   * себебі әрқайсысының 3D-дегі орны бөлек. Бірдей детальдар formatCutList()
   * ішінде бір жолға топталады. qty өрісі қолмен жазылған панельдер үшін қалды.
   */
  qty: number

  /** AABB-тың мин бұрышы, мм */
  position: Vec3
  /** three.js Euler 'XYZ', ГРАДУС. orientation-нан шығады, geometry.ts қара. */
  rotation: Vec3
  /** Рендерге де, тестке де керек: локал өстердің әлем өстеріне картасы */
  orientation: Orientation

  /** Деталировкадағы «Примечание» бағаны. Контекстті ядро біледі, кесте емес. */
  note: string

  drilling: Drill[]
  /** Арт қабырға «в паз» болғанда ғана толады */
  grooves: Groove[]
  /**
   * Беттегі фрезеровка (фасадтың өрнегі). ӘРҚАШАН СЫРТҚЫ бетте — оны клиент
   * көреді, ал ішкі бетті фрезерлеудің мағынасы жоқ.
   *
   * Панельдің ӨЛШЕМІНЕ әсер етпейді:
   * деталировка да, раскрой да мұны көрмейді — тек 3D, DXF және цехтың
   * фрезері көреді. Координаталар `drilling` сияқты РЕЗ кеңістігінде,
   * панельдің локал өстерімен.
   */
  milling: MillingPath[]
  /** Қиғаш кесік — тек мансарда корпустарында толады */
  bevel?: PanelBevel | undefined
}

// ── Конфигурация ─────────────────────────────────────────────────────────────

export type ConstructionMethod = 'sidesOverlay' | 'topBottomOverlay'
export type BackMode = 'overlay' | 'groove' | 'none'
export type FrontMount = 'overlay' | 'inset'
export type ShelfKind = 'adjustable' | 'fixed'

/**
 * Қай көріну класына қандай кромка жабысады. Панель рөлі мен құрастыру әдісі
 * жиекті осы үш класстың біріне жатқызады (edges.ts).
 */
export type EdgePolicy = {
  /** Алдыңғы, клиентке қарап тұрған жиек */
  visibleFront: string | null
  /** Көрінеді, бірақ алдыңғы емес (тік панельдің үсті, жатықтың бүйірі) */
  visibleSecondary: string | null
  /** Мүлде көрінбейді (арт жиек, буын ішіндегі жиек) */
  hidden: string | null
}

/** §4-тегі цех константалары. Жобаға да, кабинетке де override жасалады. */
export type ConstructionSettings = {
  shelfGap: number
  shelfSetback: number
  frontGap: number
  backThickness: number
  grooveDepth: number
  grooveInset: number
  minBandSubtract: number
  confirmatSpanForThird: number
  shelfPinDatum: number

  // ── Купе (әр профиль жүйесінде басқаша). ЦЕХТЫҢ ТАҢДАУЫ. ────────────────
  /** Көрші есіктердің бір-бірін жабуы (профильдің қабаттасуы) */
  slidingDoorOverlap: number
  /** Жоғарғы рельс пен есіктің үстіндегі алатын орны */
  slidingTrackTopSpace: number
  /** Төменгі рельс пен есіктің астындағы алатын орны */
  slidingTrackBottomSpace: number
  /** Тік профиль есіктің әр жағынан алатын ені */
  slidingProfileSide: number
  /** Көлденең профиль есіктің үсті мен астынан алатын биіктігі */
  slidingProfileTopBottom: number

  // ── Ящик (§4.8). ҮШЕУІ ДЕ ЦЕХТЫҢ ТАҢДАУЫ, әмбебап стандарт емес. ──────────
  /** Направляющая әр жақтан алатын орын. Роликтіде әдетте 12.5–13 мм. */
  drawerRunnerGap: number
  /** Ящик қорабының арт жағында қалатын саңылау (направляющая ұзындығына) */
  drawerBackGap: number
  /** Қораптың бүйірі фасадтан осынша ТӨМЕН болады */
  drawerBoxDrop: number
}

/**
 * Константаларды ішінара қайта анықтау. `Partial<>` емес, себебі
 * exactOptionalPropertyTypes қосулы: zod .partial() өрістерді
 * `T | undefined` етіп қайтарады.
 */
export type SettingsOverride = {
  [K in keyof ConstructionSettings]?: ConstructionSettings[K] | undefined
}

/**
 * Секцияның ішкі толтырылуы.
 *
 * Массив — ТІК ҚАБАТТАУ: [0] АСТЫҢҒЫ жолақ, соңғысы — ең үстіңгі.
 * Жолақтар арасына бекітілген сөре (разделитель) қойылады — нақты жиһазда
 * ящиктің үстіндегі сөре сол.
 *
 * `height` берілсе — жолақ дәл сонша мм алады; берілмесе, қалған биіктікті
 * басқа еркін жолақтармен тең бөліседі.
 */
export type RailPosition = 'top' | 'bottom' | 'left' | 'right'
export type RailKind = 'carcass' | 'facade' | 'filler'

export type Rail = {
  id: string
  kind: RailKind
  position: RailPosition
  /** Берілмесе: `facade`/`filler` — фасад материалы, `carcass` — корпустікі. */
  materialId?: string | undefined
  /** Планканың ТАР өлшемі, мм. */
  width: number
  /** Тұрған жиегінен БОЙЛЫҚ бағытта ішке шегініс, мм. */
  inset: number
  /** Тереңдік бойынша алдыңғы жиектен шегініс, мм. Тек `carcass` үшін. */
  depthOffset: number
}

/**
 * Секцияның фасады.
 *
 * `hingeSystemId` мен `handle` — ЕРІКТІ. Болмаса цехтың әдепкі жүйесі мен
 * әдепкі тұтқасы алынады: ескі жобалар осы өріссіз сақталған, ал оларды
 * ашқанда фасад ілгексіз қалып қоймауы керек.
 */
/**
 * Фасадтың зазорлары, мм. Берілмеген жағы цехтың `frontGap`-ынан алынады.
 *
 * НЕГЕ ӘР ЖАҚ БӨЛЕК. Бір саны бүкіл жиһазға жетпейді: ас үйдің қатарында
 * фасадтардың АРАСЫ 3 мм болса да, шеткі фасад пен қабырғаның арасы 2 мм
 * болуы мүмкін, ал үстіңгі жағында столешницаға тірелмеу үшін 5 мм керек.
 */
export type FrontGaps = {
  /** Көрші фасадтардың арасы. */
  between?: number | undefined
  left?: number | undefined
  right?: number | undefined
  top?: number | undefined
  bottom?: number | undefined
}

/**
 * Фасад қай жағынан ашылады — ілгектің чашкасы сол жаққа бұрғыланады.
 *
 * `auto` — бұрынғы мінез: бірінші фасад солдан, соңғысы оңнан ашылады
 * (екі есікті шкафтың әдеттегі жағдайы).
 *
 * Жоғары/төмен ашылатын (откидной, подъёмный) фасад ӘЛІ ЖОҚ: оның
 * фурнитурасы екіұшты — Aventos сияқты механизм БҮЙІРГЕ бекітіледі, ал
 * қарапайым ілгек көлденең панельге. Дұрысын білмей присадка қоюдан гөрі,
 * мүлде ұсынбаған дұрыс (CLAUDE.md §10).
 */
export type FrontOpening = 'auto' | 'left' | 'right'

export type SectionFronts = {
  count: number
  mount: FrontMount
  /** Қай жағынан ашылады. Берілмесе — `auto`. */
  opening?: FrontOpening | undefined
  /** Зазорлар. Берілмегені цехтың әдепкісінен алынады. */
  gaps?: FrontGaps | undefined
  /** `ShopProfile.hingeSystems[].id`. Болмаса — цехтың әдепкісі. */
  hingeSystemId?: string | undefined
  /** `null` — тұтқа әдейі жоқ. `undefined` — цехтың әдепкісі. */
  handle?: HandleSpec | null | undefined
  /** Фасадтың өрнегі. Болмаса — гладкий. */
  milling?: MillingSpec | null | undefined
}

export type SectionContent =
  | { kind: 'shelves'; count: number; shelfKind: ShelfKind; height?: number | undefined }
  | { kind: 'drawers'; count: number; height?: number | undefined }
  | { kind: 'rod'; height?: number | undefined }
  /**
   * Механизм (брючница, пантограф, …). Панель шықпайды — жолақ бос қалады,
   * ал механизмнің өзі фурнитура болып сметаға түседі.
   */
  | { kind: 'filling'; filling: FillingKind; height?: number | undefined }
  /**
   * Техниканың ҰЯСЫ. Мұнда да панель жоқ: цехтың міндеті — дұрыс өлшемді
   * орын қалдыру. Техниканың ӨЗІ сметаға КІРМЕЙДІ (клиент өзі алады).
   */
  | { kind: 'appliance'; appliance: ApplianceKind; height?: number | undefined }
  | { kind: 'empty'; height?: number | undefined }

/**
 * Кабинет тік перегородкалармен секцияларға бөлінеді.
 *
 * Перегородка ҚОЛМЕН ЖАЗЫЛМАЙДЫ — ол секциялардан шығады:
 * `dividerCount = sections.length − 1`. Перегородка құрылымдық: толық ішкі
 * биіктікте жүреді және оның қалыңдығы екі жағындағы секциядан шегеріледі.
 */
export type Section = {
  id: string
  /** 'flex' секциялар қалған енді тең бөліседі */
  widthMode: 'fixed' | 'flex'
  /** widthMode === 'fixed' болса МІНДЕТТІ. Секцияның ТАЗА ішкі ені. */
  width?: number | undefined
  contents: SectionContent[]
  /** Осы секцияның фасады. null — ашық секция. */
  fronts?: SectionFronts | null | undefined
}

export type CabinetConfig = {
  id: string
  name: string
  construction: ConstructionMethod
  /** Сыртқы габарит, мм. Рет ӘРҚАШАН H × W × D. */
  height: number // H
  width: number // W
  /** D — артқы қабырғаның қалыңдығын ҚОСА (§4.5). Накладной фасад бұған кірмейді. */
  depth: number
  carcassMaterialId: string
  frontMaterialId: string
  backMaterialId: string
  back: { mode: BackMode }
  /** Кемінде бір секция. Перегородкасыз кабинет = бір flex секция. */
  sections: Section[]
  /**
   * Купе есіктері. Олар БҮКІЛ корпустың алдын жабады, секцияға тиесілі емес —
   * сондықтан мұнда, кабинет деңгейінде тұр. Ілмелі фасадпен БІРГЕ болмайды.
   */
  sliding?: { count: number } | undefined

  /**
   * Корпустың астындағы тірек. Корпус осының ҮСТІНДЕ тұрады, сондықтан
   * жиһаздың толық биіктігі = `height + base.height` (+ столешница).
   * `height` бұрынғыдай КОРПУСТЫҢ биіктігі.
   */
  base?: { kind: 'plinth' | 'legs'; height: number } | undefined

  /**
   * Планкалар мен фальш-панельдер.
   *
   * Планка (царга) — толық крышканың ОРНЫНА қойылатын тар деталь: төменгі
   * ас үй шкафында столешница үстінен жабатындықтан, толық крышка керек
   * емес, екі царга жетеді. Фальш-панель — шкаф пен қабырғаның арасындағы
   * саңылауды жабатын панель.
   *
   * ГЕОМЕТРИЯСЫ ТҮРІНЕ БАЙЛАНЫСТЫ, сондықтан ол айқын жазылған:
   *   `carcass` — корпустың ІШІНДЕ, `depthOffset` тереңдігінде тұрады
   *   `facade`  — корпустың АЛДЫНДА (z < 0), материалы әдепкіде фасадтікі
   *   `filler`  — корпустың ЖАНЫНДА тік тұрады, тек left/right
   */
  rails?: Rail[] | undefined

  /**
   * Фартук — столешницаның үстіндегі, қабырғадағы панель.
   * Корпустың ішіне кірмейді: ол қабырғаны жабады.
   */
  backsplash?: { materialId?: string | undefined; height: number } | undefined

  /**
   * Қиғаш төбе (мансарда). `height` — БИІК жағының биіктігі.
   *
   * Қиғаш «алдыға» да, «артқа» да қарай түсе алады: шкаф қабырғаға тіреліп
   * тұрса, төбе артқа қарай төмендейді.
   */
  slope?: { towards: 'back' | 'front'; lowHeight: number } | undefined

  /**
   * Бұрыштық (переходной) корпус: тереңдігі СОЛДАН ОҢҒА қарай өзгереді.
   * `depth` — сол жақтың тереңдігі, `corner.depthAtRight` — оң жақтікі.
   * Арты ҚАБЫРҒАҒА тіреледі, ал алдыңғы жиек қиғаш болып шығады.
   *
   * ҚАЗІРГІ ШЕКТЕУЛЕР (әдейі, әрқайсысы қате болып шығады):
   * фасад, ящик, перегородка және арт қабырға. Олардың әрқайсысы қиғаш
   * жазықтықта бөлек геометрияны талап етеді (ілгектің чашкасы, направляющая,
   * паз) — оны жартылай істегеннен гөрі, мүлде істемеген дұрыс: жартылай
   * дұрыс присадка цехта ғана байқалады.
   */
  corner?: { depthAtRight: number } | undefined

  /**
   * Крышканы БОЛДЫРМАУ. Кереует каркасы мен банкеткада үсті ашық: оның
   * орнына матрас не жұмсақ отырғыш тұрады, ал ол парақтан кесілмейді.
   */
  openTop?: boolean | undefined

  /** Столешница — корпустың үстіне жататын бөлек деталь. */
  worktop?: {
    /** Берілмесе — корпус материалы */
    materialId?: string | undefined
    /** Алдыға шығып тұратын мөлшері, мм */
    overhangFront: number
    /** Әр бүйірден шығып тұратын мөлшері, мм */
    overhangSides: number
  } | undefined
  edging: EdgePolicy
  /** Цех константаларын осы кабинет үшін ғана өзгерту */
  settings?: SettingsOverride | undefined

  /**
   * Присадканы ҚОЛМЕН түзету, панельдің id-і бойынша (`drillEdits.ts`).
   * Панель емес, КОНФИГ сақталады (§7) — сондықтан түзету де осында тұрады.
   */
  drillEdits?: DrillEdits | undefined

  /**
   * ЕРІКТІ детальдар. Параметрлі модель жетпей қалғанда — осы.
   *
   * Конфигуратор корпустық жиһазды параметрмен сипаттайды: секция, сөре,
   * ящик, фасад. Бірақ нақты тапсырыста параметрге сыймайтын деталь әрқашан
   * табылады: столешницаның астындағы қатырғыш, теледидардың артындағы
   * панель, үстелдің аяғының арасындағы царга. Соларды жоқ деп айтқанша,
   * цехқа өз детальін ӨЗІ қоюға мүмкіндік берген дұрыс — ол деталь
   * деталировкаға да, раскройға да, сметаға да қалғанымен БІРДЕЙ түседі.
   */
  customParts?: CustomPart[] | undefined
}

/**
 * Ерікті деталь.
 *
 * Өлшемі — ГОТОВЫЙ (§4.2), орны — корпустың сол-төмен-алдыңғы бұрышынан.
 * Қай өстің «ұзындық», қайсысының «ен» екені ЖАЗЫҚТЫҒЫНАН шығады:
 *
 *   horizontal — жатық деталь (сөре, столешница): ұзындығы X, ені Z, қалыңдығы Y
 *   vertical   — тік деталь (бүйірше, қатырғыш):   ұзындығы Y, ені Z, қалыңдығы X
 *   front      — алдыға қараған деталь (фасад, арт): ұзындығы Y, ені X, қалыңдығы Z
 *
 * Бұл — корпустың өз панельдерінде қолданылатын дәл сол үш бағдар, сондықтан
 * ерікті деталь 3D-де де, присадкада да, DXF-те де басқаша жүрмейді.
 */
export type CustomPart = {
  id: string
  /** Деталировкадағы аты: «Столешница», «Царга», «Задняя панель ТВ». */
  label: string
  /** Материал. Берілмесе — корпустың материалы. */
  materialId?: string | undefined
  /** Готовый ұзындығы, мм. */
  length: number
  /** Готовый ені, мм. */
  width: number
  /** Корпустағы орны (AABB-тың мин бұрышы), мм. */
  position: Vec3
  plane: 'horizontal' | 'vertical' | 'front'
  /**
   * Кромка: `none` — жоқ, `front` — бір алдыңғы жиек (сөре сияқты),
   * `all` — төрт жиегі де (фасад сияқты). Қай жиегі көрінетінін ЦЕХ біледі,
   * сондықтан бұл — таңдау, есептелетін нәрсе емес.
   */
  edging: 'none' | 'front' | 'all'
  note?: string | undefined
}

/** generateCabinet-ке керек анықтамалықтар */
export type Catalog = {
  materials: Material[]
  edgeBands: EdgeBand[]
  /**
   * Ілгек жүйелері мен тұтқа модельдері — ЕРІКТІ.
   *
   * Присадка брендке тәуелді болғандықтан бұлар генерацияға керек, бірақ
   * ескі шақырулар (тест, CLI) оларсыз жүреді: сол кезде §4.9 константалары
   * қолданылады да, нәтиже бұрынғыдай қалады.
   */
  hingeSystems?: HingeSystem[] | undefined
  handles?: HandleModel[] | undefined
}

// ── Бөлме (C фаза) ───────────────────────────────────────────────────────────

export type WallId = 'north' | 'east' | 'south' | 'west'

/** Тікбұрышты еден: X ∈ [0, width], Z ∈ [0, depth], биіктік Y бойымен. */
export type Room = {
  /** X бойымен, мм */
  width: number
  /** Z бойымен, мм */
  depth: number
  /** Y бойымен, мм — тек 3D көрініс үшін */
  height: number
}

/** Шкафтың бөлмедегі орны. Бір шкаф — бір орын. */
export type Placement = {
  cabinetId: string
  wall: WallId
  /** Қабырға басынан, мм */
  offset: number
}

export type ProjectFile = {
  /** Ағымдағы нұсқа = 3. Ескі файлдар parseProject() арқылы көтеріледі. */
  schemaVersion: 3
  name: string
  materials: Material[]
  edgeBands: EdgeBand[]
  settings?: SettingsOverride | undefined
  cabinets: CabinetConfig[]
  /**
   * Бөлме мен шкафтардың орны (C фаза). Ескі файлда болмайды — миграция
   * бөлмені әдепкі етіп қояды да, шкафтарды бір қабырғаға тізеді.
   */
  room: Room
  placements: Placement[]
}

// ── Деталировка ──────────────────────────────────────────────────────────────

/** Бағанның кімге арналғаны — экспортта клиент пен цех шатаспауы үшін */
export type Audience = 'client' | 'shop' | 'both'

export type CutListRow = {
  /** Наименование */
  name: string
  /** Кол-во */
  qty: number
  /** ГОТОВЫЙ (клиент): жиналған детальдің өлшемі */
  finishedLength: number
  finishedWidth: number
  /** РЕЗ (цех): станок кесетін өлшем */
  cutLength: number
  cutWidth: number
  /** Толщина */
  thickness: number
  /** Материал */
  material: string
  /** Кромка L1/L2/W1/W2 — "2.0" | "0.4" | "—" */
  edgeL1: string
  edgeL2: string
  edgeW1: string
  edgeW2: string
  /** Текстура */
  grain: 'вдоль длины' | 'поперёк длины' | 'нет'
  /** Примечание */
  note: string
}
