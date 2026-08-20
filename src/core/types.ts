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

/**
 * Кабинет координаталары: X — солдан оңға (ені), Y — төменнен жоғары (биіктігі),
 * Z — алдыңғы беттен артқа қарай (тереңдігі). Нөл нүкте — корпустың
 * алды-төмен-сол бұрышы. Накладной фасад корпустың АЛДЫНДА тұрады, сондықтан
 * оның z-і теріс (−frontThickness .. 0).
 */
export type Axis = 'x' | 'y' | 'z'

/** Панельдің локал өстері (ұзындық/ені/қалыңдығы) әлем өстеріне қалай түседі */
export type Orientation = { length: Axis; width: Axis; thickness: Axis }

export type Vec3 = { x: number; y: number; z: number }

export type DrillPurpose = 'confirmat' | 'dowel' | 'minifix' | 'shelfPin' | 'hinge' | 'runner'

export type Drill = {
  face: 'inner' | 'outer' | 'edgeL1' | 'edgeL2' | 'edgeW1' | 'edgeW2'
  /** Сол беттің сол-төменгі бұрышынан, мм */
  x: number
  y: number
  diameter: number
  depth: number
  purpose: DrillPurpose
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

  /** M1-де әрқашан бос — присадка кейінгі кезеңде (§4.9) */
  drilling: Drill[]
}

// ── Конфигурация ─────────────────────────────────────────────────────────────

export type ConstructionMethod = 'sidesOverlay' | 'topBottomOverlay'
export type BackMode = 'overlay' | 'groove'
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
}

/**
 * Константаларды ішінара қайта анықтау. `Partial<>` емес, себебі
 * exactOptionalPropertyTypes қосулы: zod .partial() өрістерді
 * `T | undefined` етіп қайтарады.
 */
export type SettingsOverride = {
  [K in keyof ConstructionSettings]?: ConstructionSettings[K] | undefined
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
  shelves: { count: number; kind: ShelfKind }
  fronts: { count: number; mount: FrontMount } | null
  edging: EdgePolicy
  /** Цех константаларын осы кабинет үшін ғана өзгерту */
  settings?: SettingsOverride | undefined
}

/** generateCabinet-ке керек анықтамалықтар */
export type Catalog = {
  materials: Material[]
  edgeBands: EdgeBand[]
}

export type ProjectFile = {
  schemaVersion: number
  name: string
  materials: Material[]
  edgeBands: EdgeBand[]
  settings?: SettingsOverride | undefined
  cabinets: CabinetConfig[]
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
