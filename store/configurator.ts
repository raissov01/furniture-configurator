'use client'

/**
 * Жобаның күйі. КОНФИГ қана сақталады — панельдер әрдайым қайта есептеледі
 * (CLAUDE.md §3, §7). Мұнда геометрия ЕСЕПТЕЛМЕЙДІ.
 *
 * C фазадан бастап жобада бірнеше шкаф болады: әрқайсысы бөлменің бір
 * қабырғасында тұрады. Редакторда бір мезгілде БІР шкаф өңделеді (`activeId`),
 * ал бөлме жоспары бәрін көрсетеді.
 */

import { create } from 'zustand'
import { defaultCabinet, defaultShop, defaultTemplateId } from '@/lib/defaults'
import {
  DEFAULT_ROOM,
  DEFAULT_SILHOUETTE_HEIGHT,
  ConfigValidationError,
  canMirror,
  catalogOf,
  cloneMaterial as cloneCatalogMaterial,
  createPriceList as createShopPriceList,
  deletePriceList as deleteShopPriceList,
  defaultOpenings,
  fitOpenings,
  findSet,
  generateKitchen,
  generateFurniture,
  findTemplate,
  mirrorCabinet as mirrorCabinetConfig,
  nextFreeOffset,
  parseProject,
  parseShopProfile,
  renamePriceList as renameShopPriceList,
  setToProject,
  switchPriceList as switchShopPriceList,
  syncActivePriceList,
  templateToCabinet,
} from '@/src/core/index'
import type { Quality } from '@/lib/appearance'
import type {
  CabinetConfig, Catalog, Material, Placement, PriceOverrides, ProjectFile, ProjectInfo, Room,
  Section, SectionContent, ShopProfile, WallId,
} from '@/src/core/index'

/** Цех профилі браузерде осы кілтпен жатады. Сервер қосылғанда осы жерден синхрондалады. */
const SHOP_KEY = 'furniture-configurator:shop'
/** Ағымдағы жоба — бетті жаңартқанда жұмыс жоғалмауы үшін. */
const PROJECT_KEY = 'furniture-configurator:project'
/** Локал сақтаулар тарихы: соңғы бірнеше нұсқа. */
const HISTORY_KEY = 'furniture-configurator:history'
/** Тарихта неше жазба тұрады. Көбейтсе, қойма толады (жоба ~6 КБ). */
const HISTORY_KEEP = 20

/** Осы уақыт ішіндегі бір өрістің өзгерісі бір undo қадамына біріктіріледі. */
const COALESCE_MS = 500
/** Тарих тереңдігі. */
const HISTORY_LIMIT = 100

/**
 * `wall-*` — PRO100-дың астыңғы қойынды қатары («Стена С/З/Ю/В»,
 * `docs/pro100/ui-design.md`): бөлменің сол қабырғасының СЫРТЫНАН қарайтын
 * элевация, `src/core/room.ts`-тегі `WallId`-мен бірдей атаумен
 * (north=С, west=З, south=Ю, east=В).
 */
export type CameraPreset =
  | 'front' | 'three-quarter' | 'inside' | 'plan' | 'room'
  | 'wall-north' | 'wall-east' | 'wall-south' | 'wall-west'

/** Undo/redo бүкіл жобаны қайтарады: шкафты жылжыту да қайтарылуы керек. */
type Snapshot = {
  room: Room
  cabinets: CabinetConfig[]
  placements: Placement[]
  activeId: string
}

type State = Snapshot & {
  /**
   * Цех профилі: материалдар, бағалар, зазорлар, фурнитура.
   * `catalog` — содан туындайтын мән; әр set()-те бірге жаңарады, әйтпесе
   * селектор әр рендерде жаңа объект қайтарып, шексіз рендер шақырады.
   */
  shop: ShopProfile
  catalog: Catalog
  /**
   * Тапсырыс реквизиттері (Заказ/Дата/Клиент/Дизайнер/Примечание). КП мен
   * цех құжаттарына шығады. Undo тарихына кірмейді — бұл геометрия емес,
   * метадерек (§7-дегі «конфиг қана сақталады» ережесіне қайшы емес: файлда
   * жатады, тек undo-стектің бөлігі емес — шкафты қайтарғанда реквизиттің
   * жоғалуы қате болар еді).
   */
  projectInfo: ProjectInfo
  /**
   * Баға түзетулері (qdesign паритеті): коэффициент/сату бағасын осы жобаға
   * ғана ауыстыру. `projectInfo`-дай Undo тарихына кірмейді — метадерек,
   * геометрия емес.
   */
  priceOverrides: PriceOverrides
  shopOpen: boolean
  quoteOpen: boolean
  sketchOpen: boolean
  accountOpen: boolean
  /** ИИ-рендер терезесі (`components/RenderPanel.tsx`). */
  renderOpen: boolean
  /** Присадка редакторы ашық па. */
  drillOpen: boolean
  /** Ерікті детальдар терезесі ашық па. */
  partsOpen: boolean
  /** Жоба туралы терезе (материалдар + жинау реті). */
  projectOpen: boolean
  /** Хоткейлер анықтамасы. */
  helpOpen: boolean
  /** Локал сақтаулар тарихы ашық па. */
  historyOpen: boolean

  /**
   * Сахнаның көрінісі: тұтас / жартылай мөлдір / тек контур.
   * Мөлдір режим шкафтың ІШІН көрсетеді — фасадты алып тастамай-ақ.
   */
  viewMode: 'solid' | 'ghost' | 'wire'
  /** Фасадтарды көрсету. Өшірсе, корпустың ішкі құрылымы ашылады. */
  showFronts: boolean
  /**
   * Присадка (тесік) белгілерін 3D-де көрсету — Ø бойынша нағыз масштабта,
   * мақсатына қарай түсті (`components/DrillMarkers.tsx`). Әдепкіде ӨШІРУЛІ:
   * клиентке көрсеткенде керек емес, тек цех/тексеру үшін.
   */
  showDrilling: boolean
  /**
   * Есік пен ящиктің АШЫЛУЫ: 0 — жабық, 1 — толық ашық.
   *
   * Бұл — клиентке көрсететін нәрсе: жабық шкаф суреттен айнымайды, ал
   * ашылған есік пен шығарылған ящик жиһаздың ішін де, өлшемін де бірден
   * түсіндіреді. Деталировкаға да, раскройға да әсері ЖОҚ.
   */
  openness: number
  /**
   * Ауыр әрекет жүріп жатыр (гарнитур құрастыру, жиынтық жүктеу) — экранда
   * «Жүктелуде…» тұрады. qdesign сияқты: онсыз бет бірнеше секунд қатып
   * тұрады да, адам «бет тоқтап қалды ма» деп ойлайды (пайдаланушы, 09-13).
   */
  busy: string | null
  /** Ауыр әрекетті оверлеймен орындау: алдымен оверлей салынады, сосын жұмыс. */
  runBusy(label: string, fn: () => void): void
  /** Клиентке КОД терезесі (qdesign «3D-көріністе ашу» сияқты). */
  shareCodeOpen: boolean
  setShareCodeOpen(v: boolean): void
  /** Жасалған код: жоба өзгерсе, клиенттің экраны осы арқылы жаңарады. */
  shareSession: { code: string; key: string; expiresAt: number } | null
  /** Код жасау (сервер). Бұлт сөндірулі не желі жоқ болса — қатенің мәтіні. */
  startShare(): Promise<{ ok: true; code: string; expiresAt: number } | { ok: false; error: string }>
  /** Жобаны кодқа қайта жіберу (автоматты жаңарту). Код жоқ болса — ештеңе. */
  syncShare(): void
  /** Камера проекциясы: перспектива (табиғи) не орто (өлшем алуға ыңғайлы). */
  projection: 'perspective' | 'ortho'
  /**
   * 3D сапасы. Жобаға ЖАЗЫЛМАЙДЫ — бұл адамның машинасының қасиеті
   * (`lib/appearance.ts`), сондықтан браузерде сақталады.
   */
  quality: Quality
  /**
   * Масштаб үшін тұратын адамның силуэті (`src/core/silhouette.ts`).
   * Жобаға ЖАЗЫЛМАЙДЫ: ол — көрініс, жиһаздың қасиеті емес.
   */
  silhouette: { on: boolean; height: number }
  /**
   * AR арнасы.
   *
   * ⚠ НЕГЕ СТОР АРҚЫЛЫ. Экспорт `<Canvas>`-тың ІШІНДЕ жүруі керек (сахнаға
   * тек сол жерден жетуге болады), ал батырма — сыртында. Модуль деңгейіндегі
   * сілтеме БОЛМАЙДЫ: Scene бөлек чанкқа жүктеледі де, ондағы модуль көшірмесі
   * басқа болып шығады (09-04-те тексерілді). Ал стор екеуіне де ортақ.
   *
   * `requestedAt` — түрткі: батырма уақытты жазады, сахна соны байқап
   * экспорттайды. Нәтижесі — тек ЖОЛ (сілтеме), нысан емес.
   */
  ar: { requestedAt: number; busy: boolean; link: string | null; error: string | null }
  /**
   * Тірі 3D сахна (three.js `Scene`).
   *
   * ⚠ СЕРИЯЛАНБАЙДЫ: жобаға да, тарихқа да (`snapshot`) КІРМЕЙДІ — ол
   * браузердегі нысан. Мұнда тұрғаны — AR батырмасына сахнаға жету үшін
   * басқа жол жоқ: экспорт `<Canvas>`-тың ішінен басталуы керек, ал модуль
   * деңгейіндегі сілтеме чанктар арасында жүрмейді (09-04-те тексерілді).
   */
  liveScene: unknown
  /**
   * «Кадрға сыйдыру» батырмасын басқан сайын өседі. Камера пресеті
   * өзгермесе де қайта бағыттау керек, ал ол үшін тәуелділік керек.
   */
  fitNonce: number
  /**
   * Бұл браузерде сақталған жоба ЖОҚ па. `hydrateProject()` шешеді.
   *
   * Керегі: конфигуратор алғаш ашылғанда бірден шкаф болып тұрмауы керек —
   * әйтпесе бүкіл құрал «шкаф жасайтын» болып көрінеді. Бос болса, алдымен
   * ЖИҺАЗДЫҢ ТҮРІН таңдау экраны ашылады.
   */
  firstRun: boolean
  /** Соңғы жүктелген шаблон. Габарит аралығын UI осыдан алады. */
  templateId: string
  /** Жоспарда таңдалған қабырға — жаңа шкаф соған қойылады. */
  selectedWall: WallId

  galleryOpen: boolean
  aiOpen: boolean
  roomOpen: boolean

  past: Snapshot[]
  future: Snapshot[]
  lastEditKey: string | null
  lastEditAt: number

  /** Ажыратылған көрініс: 0 — жиналған, 1 — толық ажыраған */
  exploded: number
  showDimensions: boolean
  cameraPreset: CameraPreset
  /** Тінтуір астындағы панельдің id-і */
  hovered: string | null
  /**
   * 3D-де БАСЫП таңдалған деталь (`panel.id`).
   *
   * Hover-ден айырмасы: таңдау тінтуір кеткенде жоғалмайды, сондықтан оның
   * өлшемін оқып, деталировкадан табуға болады. Цехтың сұрағы әрқашан
   * «мынау қандай деталь» деп басталады.
   */
  selected: string | null
  /**
   * ЖИНАУ ҚАДАМЫ: сахнада тек осы қадамға дейінгі детальдар көрінеді.
   * `null` — бәрі көрінеді (қалыпты күй).
   */
  assemblyStep: number | null

  edit(key: string, patch: Partial<CabinetConfig>): void
  editSection(index: number, patch: Partial<Section>, key: string): void
  addSection(): void
  removeSection(index: number): void

  loadTemplate(id: string): void
  loadSet(id: string): void
  loadKitchen(options: import('@/src/core/index').KitchenOptions): void
  loadFurniture(options: import('@/src/core/index').FurnitureOptions): void
  loadCabinet(cabinet: CabinetConfig): void

  exportProject(): ProjectFile
  loadProject(file: ProjectFile): void
  /** Тапсырыс реквизиттерін түзету. Бос жол сақталмайды (`exportProject`-те қиылады). */
  editProjectInfo(patch: Partial<ProjectInfo>): void
  /**
   * Баға түзетулерін түзету. `undefined` мәні өрісті ТАЗАЛАЙДЫ (мыс.
   * `editPriceOverrides({ salePrice: undefined })` — шебер override-ты алып
   * тастап, коэффициентке қайта оралады).
   */
  editPriceOverrides(patch: Partial<PriceOverrides>): void
  saveProjectLocally(): void
  hydrateProject(): void

  setShop(shop: ShopProfile): void
  editShop(patch: Partial<ShopProfile>): void
  createPriceList(name: string, mode: 'blank' | 'copy'): void
  selectPriceList(id: string): void
  renamePriceList(id: string, name: string): void
  deletePriceList(id: string): void
  addMaterial(material: Material): void
  cloneMaterial(id: string): void
  removeMaterial(id: string): void
  hydrateShop(): void
  setShopOpen(v: boolean): void
  setQuoteOpen(v: boolean): void
  setSketchOpen(v: boolean): void
  setDrillOpen(v: boolean): void
  setPartsOpen(v: boolean): void
  setProjectOpen(v: boolean): void
  setHelpOpen(v: boolean): void
  setHistoryOpen(v: boolean): void
  setViewMode(v: 'solid' | 'ghost' | 'wire'): void
  setQuality(q: Quality): void
  setSilhouette(patch: Partial<{ on: boolean; height: number }>): void
  setLiveScene(scene: unknown): void
  setAr(patch: Partial<{ busy: boolean; link: string | null; error: string | null }>): void
  setShowFronts(v: boolean): void
  setShowDrilling(v: boolean): void
  setOpenness(v: number): void
  /** Бірінші жақтан жүру режимі (Прогулка). */
  walk: boolean
  setWalk(v: boolean): void
  /** VR-сессия жүріп жатыр ма (гарнитурада). Сахна `lib/xr` сторынан қояды. */
  vr: boolean
  setVr(v: boolean): void
  /** Жеке ашылған корпустар (Прогулкада басып ашу). */
  openCabinets: Record<string, boolean>
  toggleCabinetOpen(id: string): void
  /**
   * ҚОЛМЕН, БІР-БІРЛЕП ашылған есік/ящик (пайдаланушы 09-13): жобадағы
   * детальдің кілті (`projectPanelId`) → ашық. Корпусты тұтас ашудан бөлек.
   */
  openPanels: Record<string, boolean>
  togglePanelOpen(pid: string): void
  setProjection(v: 'perspective' | 'ortho'): void
  fitCamera(): void
  /** Локал тарихқа қазіргі жобаны жазу. */
  pushHistory(): void
  /** Тарихтағы жазбаны қайтару. */
  restoreHistory(at: number): void
  setFirstRun(v: boolean): void
  setAccountOpen(v: boolean): void
  setRenderOpen(v: boolean): void

  editRoom(patch: Partial<Room>): void
  setSelectedWall(wall: WallId): void
  setSelected(id: string | null): void
  setAssemblyStep(step: number | null): void
  setActive(id: string): void
  addCabinet(): void
  duplicateCabinet(id: string): void
  mirrorCabinet(id: string): void
  removeCabinet(id: string): void
  /**
   * `continueGesture` — 3D-де сүйреудің екінші және кейінгі қадамдары: олар
   * уақытқа қарамай бір undo қадамына қосылады (сүйреу — бір қимыл).
   */
  movePlacement(
    cabinetId: string,
    patch: Partial<Omit<Placement, 'cabinetId'>>,
    opts?: { continueGesture?: boolean },
  ): void

  undo(): void
  redo(): void
  reset(): void
  setExploded(v: number): void
  setShowDimensions(v: boolean): void
  setCameraPreset(v: CameraPreset): void
  setHovered(v: string | null): void
  setGalleryOpen(v: boolean): void
  setAiOpen(v: boolean): void
  setRoomOpen(v: boolean): void
}

const snapshot = (s: State): Snapshot => ({
  room: s.room,
  cabinets: s.cabinets,
  placements: s.placements,
  activeId: s.activeId,
})

/**
 * Жаңа өлшемді бөлме. Терезе мен есік бар болса — жаңа қабырғаға қысылады,
 * жоқ болса — әдепкісі қойылады: прогулкада бөлме бос қорап болмасын.
 */
/**
 * Реквизиттегі бос/бос-орыннан тұратын өрістерді қияды: сақталған файлда
 * толтырылмаған өріс мүлде жатпауы керек, әйтпесе экспорттар «бос жол»
 * басып шығарады.
 */
const cleanProjectInfo = (info: ProjectInfo): ProjectInfo | undefined => {
  const cleaned: ProjectInfo = {}
  if (info.orderNo?.trim()) cleaned.orderNo = info.orderNo.trim()
  if (info.date?.trim()) cleaned.date = info.date.trim()
  if (info.client?.trim()) cleaned.client = info.client.trim()
  if (info.designer?.trim()) cleaned.designer = info.designer.trim()
  if (info.note?.trim()) cleaned.note = info.note.trim()
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

/**
 * Баға түзетулеріндегі бос/жарамсыз мәндерді қияды — `editPriceOverrides`
 * өрісті тазалау үшін `undefined` жазады, ал сақталған файлда мұндай кілт
 * мүлде жатпауы керек (`cleanProjectInfo` үлгісі).
 */
const cleanPriceOverrides = (overrides: PriceOverrides): PriceOverrides | undefined => {
  const cleaned: PriceOverrides = {}
  // Мәннің ӨЗІ жарамды ма (>0, бүтін тиын) — оны priceProject тексереді
  // (ConfigValidationError). Мұнда тек «толтырылмаған» кілт қиылады, әйтпесе
  // сақталған файлда `coefficient: undefined` секілді бос кілт қалады.
  if (overrides.coefficient !== undefined) cleaned.coefficient = overrides.coefficient
  if (overrides.salePrice !== undefined) cleaned.salePrice = overrides.salePrice
  if (overrides.lineDiscounts && Object.keys(overrides.lineDiscounts).length > 0) {
    cleaned.lineDiscounts = overrides.lineDiscounts
  }
  if (overrides.overallDiscount !== undefined) cleaned.overallDiscount = overrides.overallDiscount
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

const withOpenings = (room: Room): Room =>
  (room.openings && room.openings.length > 0
    ? { ...room, openings: fitOpenings(room) }
    : { ...room, openings: defaultOpenings(room) })

const initial: Snapshot = {
  room: withOpenings(DEFAULT_ROOM),
  cabinets: [defaultCabinet],
  placements: [{ cabinetId: defaultCabinet.id, wall: 'south', offset: 0 }],
  activeId: defaultCabinet.id,
}

/** Жобадағы қай шкаф өңделіп жатыр. Тізім ешқашан бос қалмайды. */
export const activeCabinet = (s: State): CabinetConfig =>
  s.cabinets.find((c) => c.id === s.activeId) ?? s.cabinets[0]!

export const useConfigurator = create<State>((set, get) => ({
  ...initial,
  shop: defaultShop,
  catalog: catalogOf(defaultShop),
  projectInfo: {},
  priceOverrides: {},
  shopOpen: false,
  quoteOpen: false,
  sketchOpen: false,
  drillOpen: false,
  partsOpen: false,
  projectOpen: false,
  helpOpen: false,
  historyOpen: false,
  viewMode: 'solid',
  showFronts: true,
  showDrilling: false,
  openness: 0,
  busy: null,
  shareCodeOpen: false,
  shareSession: null,
  walk: false,
  vr: false,
  openCabinets: {},
  openPanels: {},
  projection: 'perspective',
  quality: 'high',
  silhouette: { on: false, height: DEFAULT_SILHOUETTE_HEIGHT },
  ar: { requestedAt: 0, busy: false, link: null, error: null },
  liveScene: null,
  fitNonce: 0,
  firstRun: true,
  accountOpen: false,
  renderOpen: false,
  templateId: defaultTemplateId,
  selectedWall: 'south',

  galleryOpen: false,
  aiOpen: false,
  roomOpen: false,

  past: [],
  future: [],
  lastEditKey: null,
  lastEditAt: 0,

  exploded: 0,
  showDimensions: true,
  cameraPreset: 'three-quarter',
  hovered: null,
  selected: null,
  assemblyStep: null,

  edit(key, patch) {
    const s = get()
    const now = Date.now()
    // Слайдер сүйрегенде әр миллиметр бөлек undo қадамы болмауы керек.
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS
    set({
      cabinets: s.cabinets.map((c) => (c.id === s.activeId ? { ...c, ...patch } : c)),
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: key,
      lastEditAt: now,
    })
  },

  editSection(index, patch, key) {
    const s = get()
    const sections = activeCabinet(s).sections.map((sec, i) => (i === index ? { ...sec, ...patch } : sec))
    get().edit(`${key}:${index}`, { sections })
  },

  addSection() {
    const s = get()
    const cabinet = activeCabinet(s)
    const nextId = `s${cabinet.sections.length + 1}`
    const contents: SectionContent[] = [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }]
    get().edit('sections:add', {
      sections: [
        ...cabinet.sections,
        { id: nextId, widthMode: 'flex', contents, fronts: { count: 1, mount: 'overlay' } },
      ],
    })
  },

  removeSection(index) {
    const s = get()
    const cabinet = activeCabinet(s)
    if (cabinet.sections.length <= 1) return
    get().edit('sections:remove', { sections: cabinet.sections.filter((_, i) => i !== index) })
  },

  /**
   * Шаблонды жүктеу. Ағымдағы шкафты ТОЛЫҚ ауыстырады, бірақ бөлмедегі
   * ОРНЫ сақталады: пайдаланушы қабырғаны таңдап қойған, оны жоғалтпаймыз.
   */
  loadTemplate(id) {
    const template = findTemplate(id)
    if (!template) return
    const s = get()
    const next = { ...templateToCabinet(template, s.catalog), id: s.activeId }
    set({
      cabinets: s.cabinets.map((c) => (c.id === s.activeId ? next : c)),
      templateId: id,
      galleryOpen: false,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * Жиынтықты жүктеу: бірнеше корпус пен олардың орны бірден келеді.
   * Бөлме жиынтық сұраған өлшемге дейін ҰЛҒАЯДЫ, кішірейтілмейді —
   * пайдаланушының бөлмесі үлкенірек болса, ол сақталады.
   */
  loadSet(id) {
    // `set` — zustand-тың өз функциясы, сондықтан жиынтық `preset` деп аталады.
    const preset = findSet(id)
    if (!preset) return
    const s = get()
    const { cabinets, placements } = setToProject(preset, s.catalog)
    set({
      room: {
        width: Math.max(s.room.width, preset.room.width),
        depth: Math.max(s.room.depth, preset.room.depth),
        height: Math.max(s.room.height, preset.room.height),
      },
      cabinets,
      placements,
      activeId: cabinets[0]!.id,
      templateId: '',
      galleryOpen: false,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * Ас үй ГЕНЕРАТОРЫ: қабырға ұзындығынан толық гарнитур.
   *
   * `loadSet`-пен бір қалыпта — бүкіл жобаны АЛМАСТЫРАДЫ (Ctrl+Z қайтарады).
   * Бөлме генератор берген өлшемге көшеді: гарнитур сонда ғана дәл сыяды.
   */
  loadKitchen(options) {
    const s = get()
    const { cabinets, placements, room } = generateKitchen(options, s.catalog)
    if (cabinets.length === 0) return
    set({
      room: withOpenings({ ...s.room, width: room.width, depth: room.depth, height: Math.max(s.room.height, room.height) }),
      cabinets,
      placements,
      activeId: cabinets[0]!.id,
      templateId: '',
      galleryOpen: false,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * ЖИҺАЗ ГЕНЕРАТОРЫ (көп түр): шкаф/ТВ/комод те қабырғадан құрылады.
   * `loadKitchen`-мен бір қалыпта — жобаны алмастырады, Ctrl+Z қайтарады.
   */
  loadFurniture(options) {
    const s = get()
    const { cabinets, placements, room } = generateFurniture(options, s.catalog)
    if (cabinets.length === 0) return
    set({
      room: withOpenings({ ...s.room, width: room.width, depth: room.depth, height: Math.max(s.room.height, room.height) }),
      cabinets,
      placements,
      activeId: cabinets[0]!.id,
      templateId: '',
      galleryOpen: false,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /** Дайын конфигті жүктеу — чат-боттың варианты осы жолмен түседі. */
  loadCabinet(cabinet) {
    const s = get()
    const next = { ...cabinet, id: s.activeId }
    set({
      cabinets: s.cabinets.map((c) => (c.id === s.activeId ? next : c)),
      templateId: '',
      aiOpen: false,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /** Жоба ФАЙЛЫ: конфиг қана сақталады, панельдер әрқашан қайта есептеледі (§7). */
  exportProject() {
    const s = get()
    return {
      schemaVersion: 3 as const,
      name: s.cabinets.length === 1 ? s.cabinets[0]!.name : 'Проект',
      materials: s.shop.materials,
      edgeBands: s.shop.edgeBands,
      settings: s.shop.settings,
      cabinets: s.cabinets,
      room: s.room,
      placements: s.placements,
      info: cleanProjectInfo(s.projectInfo),
      priceOverrides: cleanPriceOverrides(s.priceOverrides),
    }
  },

  /**
   * Жобаны ашу. Файлдағы материал цехта жоқ болса — ол цех каталогына
   * БАҒАСЫЗ қосылады: әйтпесе бөтен цехтан келген жоба мүлде ашылмайды да,
   * пайдаланушы себебін түсінбей қалады.
   */
  loadProject(file) {
    const s = get()
    const known = new Set(s.shop.materials.map((m) => m.id))
    const missing = file.materials.filter((m) => !known.has(m.id)).map((m) => ({ ...m, pricePerSheet: 0 }))
    const knownBands = new Set(s.shop.edgeBands.map((b) => b.id))
    const missingBands = file.edgeBands.filter((b) => !knownBands.has(b.id)).map((b) => ({ ...b, pricePerMeter: 0 }))

    const shop: ShopProfile = missing.length > 0 || missingBands.length > 0
      ? {
          ...s.shop,
          materials: [...s.shop.materials, ...missing],
          edgeBands: [...s.shop.edgeBands, ...missingBands],
        }
      : s.shop

    set({
      shop,
      catalog: catalogOf(shop),
      room: file.room,
      cabinets: file.cabinets,
      placements: file.placements,
      activeId: file.cabinets[0]!.id,
      templateId: '',
      projectInfo: file.info ?? {},
      priceOverrides: file.priceOverrides ?? {},
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /** Тапсырыс реквизиттерін түзету. UI өрісте бос жолды бос қалдырады да, `exportProject` оны экспортта қиып тастайды. */
  editProjectInfo(patch) {
    set((s) => ({ projectInfo: { ...s.projectInfo, ...patch } }))
  },

  /**
   * Баға түзетулерін түзету. `patch`-та `undefined` берілген өріс өшеді —
   * мыс. `editPriceOverrides({ salePrice: undefined })` override-ты алып
   * тастайды да, баға қайта коэффициентпен есептеледі.
   */
  editPriceOverrides(patch) {
    set((s) => ({ priceOverrides: { ...s.priceOverrides, ...patch } }))
  },

  saveProjectLocally() {
    try {
      window.localStorage.setItem(PROJECT_KEY, JSON.stringify(get().exportProject()))
    } catch {
      // қоймаға жазылмады: жұмыс тоқтамауы керек
    }
  },

  /** Сақталған жобаны қайтару. Тек браузерде шақырылады. */
  hydrateProject() {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(PROJECT_KEY)
    } catch {
      return
    }
    if (!raw) return
    try {
      const file = parseProject(JSON.parse(raw))
      set({
        room: file.room,
        cabinets: file.cabinets,
        placements: file.placements,
        activeId: file.cabinets[0]!.id,
        projectInfo: file.info ?? {},
        priceOverrides: file.priceOverrides ?? {},
        // Жұмыс табылды — бастау экранын көрсетудің қажеті жоқ.
        firstRun: false,
      })
    } catch {
      // Ескі не бүлінген жазба: үнсіз ЖОЙМАЙМЫЗ, әдепкі жобамен ашылады.
    }
  },

  setShop(shop) {
    const synced = syncActivePriceList(shop)
    set({ shop: synced, catalog: catalogOf(synced) })
    // Сақтау сәтсіз болса (жабық режим, толған қойма) — жұмыс тоқтамауы керек.
    try {
      window.localStorage.setItem(SHOP_KEY, JSON.stringify(synced))
    } catch {
      // қоймаға жазылмады: профиль осы сеанста ғана тұрады
    }
  },

  editShop(patch) {
    get().setShop({ ...get().shop, ...patch })
  },

  createPriceList(name, mode) {
    get().setShop(createShopPriceList(get().shop, name, mode))
  },

  selectPriceList(id) {
    get().setShop(switchShopPriceList(get().shop, id))
  },

  renamePriceList(id, name) {
    get().setShop(renameShopPriceList(get().shop, id, name))
  },

  deletePriceList(id) {
    get().setShop(deleteShopPriceList(get().shop, id))
  },

  addMaterial(material) {
    const s = get()
    if (s.shop.materials.some((m) => m.id === material.id)) return
    get().setShop({ ...s.shop, materials: [...s.shop.materials, material] })
  },

  cloneMaterial(id) {
    const shop = get().shop
    const source = shop.materials.find((material) => material.id === id)
    if (!source) {
      throw new ConfigValidationError('materialId', `материал табылмады: "${id}"`,
        shop.materials.map((material) => material.id).join(' | '))
    }
    const existingIds = [
      ...shop.materials.map((material) => material.id),
      ...shop.edgeBands.map((band) => band.id),
    ]
    const copy = cloneCatalogMaterial(source, existingIds)
    get().setShop({ ...shop, materials: [...shop.materials, copy] })
  },

  /**
   * Материалды өшіру. ЖОБАДА ҚОЛДАНЫЛЫП ТҰРҒАНЫ өшірілмейді: әйтпесе
   * корпус «материал табылмады» деп құлайды да, пайдаланушы себебін
   * түсінбей қалады.
   */
  removeMaterial(id) {
    const s = get()
    const used = s.cabinets.some(
      (c) => c.carcassMaterialId === id || c.frontMaterialId === id || c.backMaterialId === id,
    )
    if (used || s.shop.materials.length <= 1) return
    get().setShop({ ...s.shop, materials: s.shop.materials.filter((m) => m.id !== id) })
  },

  /**
   * Сақталған профильді оқу. Тек браузерде шақырылады: серверде оқысақ,
   * гидратация сәйкессіздігі шығады.
   */
  hydrateShop() {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(SHOP_KEY)
    } catch {
      return
    }
    if (!raw) return
    try {
      const shop = parseShopProfile(JSON.parse(raw))
      set({ shop, catalog: catalogOf(shop) })
    } catch {
      // Ескі не бүлінген жазба: үнсіз ЖОЙМАЙМЫЗ, әдепкімен жұмыс істей береміз.
    }
  },

  setShopOpen: (shopOpen) => set({ shopOpen }),
  setQuoteOpen: (quoteOpen) => set({ quoteOpen }),
  setSketchOpen: (sketchOpen) => set({ sketchOpen }),
  setDrillOpen: (drillOpen) => set({ drillOpen }),
  setPartsOpen: (partsOpen) => set({ partsOpen }),
  setProjectOpen: (projectOpen) => set({ projectOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setHistoryOpen: (historyOpen) => set({ historyOpen }),
  setViewMode: (viewMode) => set({ viewMode }),
  setQuality: (quality) => set({ quality }),
  setSilhouette: (patch) => set((s) => ({ silhouette: { ...s.silhouette, ...patch } })),
  setWalk: (walk) => set({ walk }),
  setVr: (vr) => set({ vr }),
  toggleCabinetOpen: (id) => set((s) => ({ openCabinets: { ...s.openCabinets, [id]: !s.openCabinets[id] } })),
  togglePanelOpen: (pid) => set((s) => ({ openPanels: { ...s.openPanels, [pid]: !s.openPanels[pid] } })),
  setLiveScene: (liveScene) => set({ liveScene }),
  setAr: (patch) => set((s) => ({ ar: { ...s.ar, ...patch } })),
  setShowFronts: (showFronts) => set({ showFronts }),
  setShowDrilling: (showDrilling) => set({ showDrilling }),
  // «Закрыть створки» / E — БӘРІН жабады: қолмен бір-бірлеп ашылғандарын да.
  setOpenness: (openness) => set(openness <= 0
    ? { openness: 0, openPanels: {}, openCabinets: {} }
    : { openness: Math.min(1, openness) }),
  /*
   * ЕКІ КАДР КҮТУ: `set({ busy })` бірден ауыр жұмысқа өтсе, браузер оверлейді
   * салып үлгермейді (JS негізгі ағынды алып қояды) — адам бәрібір қатқан
   * бетті көреді. Сондықтан: оверлей → 2 кадр → жұмыс → жаңа сахна салынатын
   * 2 кадр → оверлей кетеді. Стор әрекеттері (loadKitchen т.б.) СИНХРОНДЫ
   * қалады: оларды тест те, ИИ-жол да тура шақырады.
   */
  setShareCodeOpen: (shareCodeOpen) => set({ shareCodeOpen }),
  startShare: async () => {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(get().exportProject()),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'Нет связи с сервером' }
    const data = (await res.json().catch(() => ({}))) as {
      code?: string; key?: string; expiresAt?: number; error?: string
    }
    if (!res.ok || !data.code || !data.key || !data.expiresAt) {
      return { ok: false, error: data.error ?? 'Не удалось создать код' }
    }
    set({ shareSession: { code: data.code, key: data.key, expiresAt: data.expiresAt } })
    return { ok: true, code: data.code, expiresAt: data.expiresAt }
  },
  syncShare: () => {
    const session = get().shareSession
    if (!session || session.expiresAt <= Date.now()) return
    void fetch(`/api/share/${session.code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-share-key': session.key },
      body: JSON.stringify(get().exportProject()),
    }).catch((error: unknown) => {
      // Желі үзілсе — келесі өзгерісте қайта жіберіледі; жұмысты тоқтатпаймыз.
      console.warn('Код клиента: обновление не отправлено', error)
    })
  },
  runBusy: (label, fn) => {
    if (get().busy) return
    set({ busy: label })
    const frames = (n: number, then: () => void) =>
      (n <= 0 ? then() : requestAnimationFrame(() => frames(n - 1, then)))
    frames(2, () => {
      try {
        fn()
      } finally {
        frames(2, () => set({ busy: null }))
      }
    })
  },
  setProjection: (projection) => set({ projection }),
  fitCamera: () => set({ fitNonce: get().fitNonce + 1 }),

  /**
   * Локал тарих. Автосақтау ағымдағы жобаны бір ғана кілтке жазады да,
   * кешегі күйді қайтару мүмкін болмай қалады. Тарих соңғы `HISTORY_KEEP`
   * жазбаны бөлек ұстайды: пайдаланушы «мына нұсқаға қайт» дей алады.
   *
   * Жазба тек ӨЗГЕРІС болғанда қосылады — әйтпесе бірдей 20 жазба жиналады.
   */
  pushHistory() {
    const file = get().exportProject()
    const json = JSON.stringify(file)
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY)
      const list: { at: number; name: string; json: string }[] = raw ? JSON.parse(raw) : []
      if (list[0]?.json === json) return
      const next = [{ at: Date.now(), name: file.name, json }, ...list].slice(0, HISTORY_KEEP)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch {
      // қоймаға жазылмады: тарих жоқ, бірақ жұмыс тоқтамайды
    }
  },

  restoreHistory(at) {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY)
      if (!raw) return
      const list: { at: number; json: string }[] = JSON.parse(raw)
      const found = list.find((x) => x.at === at)
      if (!found) return
      get().loadProject(parseProject(JSON.parse(found.json)))
    } catch {
      // бүлінген жазба: үнсіз қалдырамыз, ағымдағы жоба сақталады
    }
  },
  setFirstRun: (firstRun) => set({ firstRun }),
  setAccountOpen: (accountOpen) => set({ accountOpen }),
  setRenderOpen: (renderOpen) => set({ renderOpen }),

  editRoom(patch) {
    const s = get()
    set({
      room: { ...s.room, ...patch },
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  setSelectedWall: (selectedWall) => set({ selectedWall }),
  // Басқа корпусқа ауысқанда таңдау ЕСКІ корпустың детальінде қалып қоймауы
  // керек: тақтадағы өлшем сол сәтте жоқ детальдікі болып шығар еді.
  // Сол корпусты қайта белсендіру — ештеңе өзгертпейді: әйтпесе детальді басқан
  // сайын таңдау мен шаблонның аты өшіп қалатын (басу әрі таңдайды, әрі белсендіреді).
  setActive: (activeId) => {
    if (get().activeId === activeId) return
    set({ activeId, templateId: '', selected: null })
  },

  /** Жаңа шкаф таңдалған қабырғаның бос жеріне қойылады. */
  addCabinet() {
    const s = get()
    const entries = s.cabinets.map((c) => ({
      cabinet: c,
      placement: s.placements.find((p) => p.cabinetId === c.id)!,
    }))
    const id = `cabinet-${Date.now().toString(36)}`
    const cabinet = { ...activeCabinet(s), id }
    set({
      cabinets: [...s.cabinets, cabinet],
      placements: [
        ...s.placements,
        { cabinetId: id, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ],
      activeId: id,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * КӨШІРМЕ. `addCabinet` та белсенді модульді көшіреді, бірақ ол «жаңа
   * модуль» деген мағынада: көшірме АТЫМЕН ажыратылуы керек, әйтпесе
   * тізімде екі бірдей жол тұрады да, қайсысы қайсы екені білінбейді.
   */
  duplicateCabinet(id) {
    const s = get()
    const source = s.cabinets.find((c) => c.id === id)
    if (!source) return
    const entries = s.cabinets.map((c) => ({
      cabinet: c,
      placement: s.placements.find((p) => p.cabinetId === c.id)!,
    }))
    const newId = `cabinet-${Date.now().toString(36)}`
    set({
      cabinets: [...s.cabinets, { ...source, id: newId, name: `${source.name} (копия)` }],
      placements: [
        ...s.placements,
        { cabinetId: newId, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ],
      activeId: newId,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * АЙНА КӨШІРМЕСІ. Ережелері ядрода (`src/core/mirror.ts`): есіктің ашылу
   * жағы, тұтқа, планка, секциялардың реті — бәрі сол-оң бойынша шағылысады.
   * Бұрыштық корпус айналмайды, сондықтан батырма да сөндіріліп тұрады.
   */
  mirrorCabinet(id) {
    const s = get()
    const source = s.cabinets.find((c) => c.id === id)
    if (!source || !canMirror(source).ok) return
    const entries = s.cabinets.map((c) => ({
      cabinet: c,
      placement: s.placements.find((p) => p.cabinetId === c.id)!,
    }))
    const newId = `cabinet-${Date.now().toString(36)}`
    set({
      cabinets: [...s.cabinets, mirrorCabinetConfig(source, newId)],
      placements: [
        ...s.placements,
        { cabinetId: newId, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ],
      activeId: newId,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  removeCabinet(id) {
    const s = get()
    if (s.cabinets.length <= 1) return
    const cabinets = s.cabinets.filter((c) => c.id !== id)
    set({
      cabinets,
      placements: s.placements.filter((p) => p.cabinetId !== id),
      activeId: s.activeId === id ? cabinets[0]!.id : s.activeId,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  movePlacement(cabinetId, patch, opts) {
    const s = get()
    const now = Date.now()
    const key = `placement:${cabinetId}`
    const coalesce = opts?.continueGesture === true || (s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS)
    set({
      placements: s.placements.map((p) => (p.cabinetId === cabinetId ? { ...p, ...patch } : p)),
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: key,
      lastEditAt: now,
    })
  },

  undo() {
    const s = get()
    const previous = s.past[s.past.length - 1]
    if (!previous) return
    set({
      ...previous,
      past: s.past.slice(0, -1),
      future: [snapshot(s), ...s.future],
      lastEditKey: null,
    })
  },

  redo() {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({
      ...next,
      past: [...s.past, snapshot(s)],
      future: s.future.slice(1),
      lastEditKey: null,
    })
  },

  reset() {
    const s = get()
    set({
      ...initial,
      templateId: defaultTemplateId,
      past: [...s.past, snapshot(s)],
      future: [],
      lastEditKey: null,
    })
  },

  setExploded: (exploded) => set({ exploded }),
  setShowDimensions: (showDimensions) => set({ showDimensions }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  setAssemblyStep: (assemblyStep) => set({ assemblyStep }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setRoomOpen: (roomOpen) => set({ roomOpen }),
}))
