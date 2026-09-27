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
import { t as tr } from '@/lib/i18n'
import { changesCabinet } from '@/lib/cabinetEdit'
import { planSectionAddition } from '@/lib/sectionUi'
import { appendFreeMirror } from '@/lib/freeMirrorAction'
import { roomDimensionIssue } from '@/lib/roomDimensions'
import { createSolidNode, editSolidTree } from '@/lib/solidAction'
import { defaultCabinet, defaultShop, defaultTemplateId } from '@/lib/defaults'
import { templateProjectTitles } from '@/lib/templateProjectTitles'
import {
  DEFAULT_ROOM,
  IDENTITY_TRANSFORM,
  ORIENT_FACING,
  DEFAULT_SILHOUETTE_HEIGHT,
  ConfigValidationError,
  applyAutoJointChange,
  canMirror,
  catalogOf,
  cloneMaterial as cloneCatalogMaterial,
  createPriceList as createShopPriceList,
  deletePriceList as deleteShopPriceList,
  defaultOpenings,
  fitOpenings,
  findSet,
  findNode,
  flattenTree,
  generateKitchen,
  generateFurniture,
  findTemplate,
  mirrorCabinet as mirrorCabinetConfig,
  insertLibraryItem,
  mergeLibraryCatalog,
  MaterialSchema,
  replaceTreeBoardMaterial,
  replaceTreeMaterial,
  nextFreeOffset,
  parseProjectV4,
  SceneLightsSchema,
  parseShopProfile,
  renamePriceList as renameShopPriceList,
  setToProject,
  switchPriceList as switchShopPriceList,
  syncActivePriceList,
  templateToCabinet,
} from '@/src/core/index'
import type { Quality } from '@/lib/appearance'
import type { PanoramaContext } from '@/lib/panorama'
import type {
  BoardSpec, CabinetConfig, Catalog, EdgeBand, GroupNode, Layer, LibraryItem, Material, MaterialPbr, SolidSpec,
  Placement, PriceOverrides, ProjectFileV4, ProjectInfo, Room, SceneLight, Section,
  SettingsOverride, ShopProfile, Vec3, WallId,
} from '@/src/core/index'
import { createDefaultLayer, deleteLayer as deleteTreeLayer, createLayer as createTreeLayer,
  renameLayer as renameTreeLayer, setLayerVisible, setLayerLocked, setLayerColor,
  setNodeLayer, treeFromProject } from '@/src/core/index'
import { LEGACY_MATERIAL_ALIASES } from '@/src/core/data/catalog/materials'
import { appendNodeArray, assertTreeNodeEditable, groupNodes, renameTreeNode, reparentNode, setTreeNodeFlag, translateTreeNodes, ungroupNode } from '@/src/core/treeEditing'
import type { ArrayOptions } from '@/src/core/array'
import type { AutoJointKind } from '@/src/core/autoJoint'
import type { AutoJointRecord } from '@/src/core/autoJointRebuild'
import type { SnapOptions } from '@/src/core/snap'
import type { Axis } from '@/src/core/types'
import type { BoxAlignment } from '@/src/core/align'
import { arrangeTreeSelection } from '@/src/core/treeArrange'
import { cabinetsFromTree, reconcileCabinetsInTree, wallAttachedPlacements } from './treeAdapters'

/** Цех профилі браузерде осы кілтпен жатады. Сервер қосылғанда осы жерден синхрондалады. */
const SHOP_KEY = 'furniture-configurator:shop'
/** Ағымдағы жоба — бетті жаңартқанда жұмыс жоғалмауы үшін. */
const PROJECT_KEY = 'furniture-configurator:project'
/** Parsing failed: preserve the exact raw bytes before a deliberate replacement. */
const CORRUPT_PROJECT_BACKUP_KEY = 'furniture-configurator:project-corrupt-backup'
/** Локал сақтаулар тарихы: соңғы бірнеше нұсқа. */
const HISTORY_KEY = 'furniture-configurator:history'
/** Тарихта неше жазба тұрады. Көбейтсе, қойма толады (жоба ~6 КБ). */
const HISTORY_KEEP = 20

/** Осы уақыт ішіндегі бір өрістің өзгерісі бір undo қадамына біріктіріледі. */
const COALESCE_MS = 500
/** Тарих тереңдігі. */
const HISTORY_LIMIT = 100

/** Бір share кодының PUT сұраныстары серверге жіберілген ретімен жетуі тиіс. */
let shareSyncTail: Promise<void> = Promise.resolve()

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
  projectName: string
  root: GroupNode
  layers: Layer[]
  projectSettings: SettingsOverride | undefined
  projectMaterials: Material[] | undefined
  projectEdgeBands: EdgeBand[] | undefined
  autoJoints: AutoJointRecord[]
  lights: SceneLight[]
  activeId: string
  projectInfo: ProjectInfo
  priceOverrides: PriceOverrides
}

type State = Snapshot & {
  setProjectLights(lights: SceneLight[]): void
  setMaterialPbr(materialId: string, pbr: MaterialPbr | undefined): void
  /** Invalid local backup stays untouched until explicit recovery/load/reset. */
  projectLoadError: string | null
  /**
   * Бүлінген жобаның сақтық көшірмеге ЖАЗЫЛМАҒАН түпнұсқасы. Көшірме жазылмайынша
   * PROJECT_KEY-ді басқа жобамен басуға болмайды (reset, тарих, файл ашу).
   */
  unbackedCorruptProject: string | null
  /** A failed history entry does not invalidate the currently loaded project. */
  historyRestoreError: string | null
  dismissHistoryRestoreError(): void
  /** Тек root-тан туатын ескі кабинет UI адаптері; жобаға сақталмайды. */
  cabinets: CabinetConfig[]
  placements: Placement[]
  /**
   * Цех профилі: материалдар, бағалар, зазорлар, фурнитура.
   * `catalog` — содан туындайтын мән; әр set()-те бірге жаңарады, әйтпесе
   * селектор әр рендерде жаңа объект қайтарып, шексіз рендер шақырады.
   */
  shop: ShopProfile
  catalog: Catalog
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
  /** Бекіткіштің процедуралық пішіндері; тесік режимімен өзара бөлек. */
  showFittings: boolean
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
  /** Жобаны кодқа ретімен қайта жіберу; келісім алдында нәтижесін күтуге болады. */
  syncShare(): Promise<{ ok: true } | { ok: false; error: string }>
  /** Камера проекциясы: перспектива (табиғи) не орто (өлшем алуға ыңғайлы). */
  projection: 'perspective' | 'ortho'
  /**
   * 3D сапасы. Жобаға ЖАЗЫЛМАЙДЫ — бұл адамның машинасының қасиеті
   * (`lib/appearance.ts`), сондықтан браузерде сақталады.
   */
  quality: Quality
  /** Жеке редактор баптауы; өндіріс конфигіне және undo тарихына кірмейді. */
  snapOptions: SnapOptions
  setSnapOptions(options: SnapOptions): void
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
  liveRenderContext: PanoramaContext | null
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
  addBoard(): string
  addSolid(): string
  editSolid(id: string, patch: Partial<SolidSpec>): void
  setSolidPosition(id: string, position: Vec3): void
  mirrorFreeNode(id: string): string
  removeBoard(id: string): void
  editBoard(id: string, patch: Partial<BoardSpec>): void
  autoJointBoards(ids: [string, string], kind: AutoJointKind, tolerance: number): void
  setAutoJointKind(id: string, kind: AutoJointKind): void
  removeAutoJoint(id: string): void
  setBoardPosition(id: string, position: Vec3): void
  editSection(index: number, patch: Partial<Section>, key: string): void
  addSection(): string | null
  removeSection(index: number): void

  loadTemplate(id: string): void
  loadSet(id: string): void
  loadKitchen(options: import('@/src/core/index').KitchenOptions, measuredRoom?: Room): void
  loadFurniture(options: import('@/src/core/index').FurnitureOptions): void
  loadCabinet(cabinet: CabinetConfig): void

  exportProject(): ProjectFileV4
  loadProject(file: unknown): void
  renameNode(id: string, name: string): void
  setNodeHidden(id: string, hidden: boolean): void
  setNodeLocked(id: string, locked: boolean): void
  groupSelected(ids: string[], groupId: string, name: string): void
  ungroup(id: string): void
  reparent(id: string, parentId: string): void
  arrayNode(id: string, opts: ArrayOptions): void
  translateNodes(moves: readonly { id: string; delta: Vec3 }[], opts?: { continueGesture?: boolean }): void
  arrangeNodes(ids: readonly string[], axis: Axis, mode: BoxAlignment | 'distribute'): void
  placeLibraryItem(item: LibraryItem, parentId?: string): void
  replaceFreeBoardMaterial(oldId: string, newId: string): void
  replaceProjectMaterial(oldId: string, newId: string): void
  createLayer(name: string): void
  renameLayer(id: string, name: string): void
  setLayerVisible(id: string, visible: boolean): void
  setLayerLocked(id: string, locked: boolean): void
  setLayerColor(id: string, color: string): void
  deleteLayer(id: string): void
  assignNodeLayer(id: string, layerId: string): void
  /** Тапсырыс реквизиттерін түзету. Бос жол сақталмайды (`exportProject`-те қиылады). */
  editProjectInfo(patch: Partial<ProjectInfo>): void
  /**
   * Баға түзетулерін түзету. `undefined` мәні өрісті ТАЗАЛАЙДЫ (мыс.
   * `editPriceOverrides({ salePrice: undefined })` — шебер override-ты алып
   * тастап, коэффициентке қайта оралады).
   */
  editPriceOverrides(patch: Partial<PriceOverrides>): void
  /** `null` on success, otherwise a visible storage error for recovery actions. */
  saveProjectLocally(): string | null
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
  setLiveRenderContext(context: PanoramaContext | null): void
  setAr(patch: Partial<{ busy: boolean; link: string | null; error: string | null }>): void
  setShowFronts(v: boolean): void
  setShowDrilling(v: boolean): void
  setShowFittings(v: boolean): void
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
  appendCabinet(cabinet: CabinetConfig): void
  replaceCabinets(cabinets: CabinetConfig[]): void
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
  projectName: s.projectName,
  root: s.root,
  layers: s.layers,
  projectSettings: s.projectSettings,
  projectMaterials: s.projectMaterials,
  projectEdgeBands: s.projectEdgeBands,
  autoJoints: s.autoJoints,
  lights: s.lights,
  activeId: s.activeId,
  projectInfo: s.projectInfo,
  priceOverrides: s.priceOverrides,
})

function legacyEdit(s: State, cabinets: CabinetConfig[], placements = s.placements, room = s.room,
  movedIds: ReadonlySet<string> = new Set()) {
  const previous = new Map(s.cabinets.map((cabinet) => [cabinet.id, cabinet]))
  const next = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet]))
  for (const [id, cabinet] of previous) {
    if (!next.has(id) || next.get(id) !== cabinet || movedIds.has(id)) {
      assertTreeNodeEditable(s.root, id, s.layers)
    }
  }
  const root = reconcileCabinetsInTree(s.root, room, cabinets, placements, movedIds)
  return { root, ...cabinetsFromTree(root, room, s.layers) }
}

/** A preset replaces scene content, while order metadata and material choices remain. */
function replaceProjectScene(s: State, cabinets: CabinetConfig[], placements: Placement[], room: Room, name = s.root.name) {
  const root = treeFromProject({ schemaVersion: 3, name, room, cabinets, placements,
    materials: s.catalog.materials, edgeBands: s.catalog.edgeBands })
  const layers = [createDefaultLayer()]
  // A preset replaces the complete scene. Its undo snapshot keeps old joints,
  // but the new root must not serialize references to removed free boards.
  return { root, layers, autoJoints: [], ...cabinetsFromTree(root, room, layers) }
}

/** Қабырғамен бірге нақты жылжитын корпустардың ID тізімі. */
const placedIds = (placements: Placement[]): ReadonlySet<string> =>
  new Set(placements.map((placement) => placement.cabinetId))

/** Project's physical geometry wins; current shop provides prices for matching IDs. */
function projectCatalog(shop: ShopProfile, materials?: Material[], edgeBands?: EdgeBand[]): Catalog {
  const base = catalogOf(shop)
  if (!materials && !edgeBands) return base
  const materialMap = new Map(base.materials.map((material) => [material.id, material]))
  const bandMap = new Map(base.edgeBands.map((band) => [band.id, band]))
  for (const material of materials ?? []) {
    const local = materialMap.get(material.id)
    materialMap.set(material.id, { ...material,
      // Legacy files omit template preferences; their physical dimensions
      // still win, but new templates can use the local material's edge defaults.
      defaultEdging: material.defaultEdging ?? local?.defaultEdging,
      pricePerSheet: local?.pricePerSheet ?? 0 })
  }
  for (const band of edgeBands ?? []) {
    bandMap.set(band.id, { ...band,
      pricePerMeter: bandMap.get(band.id)?.pricePerMeter ?? 0 })
  }
  return { ...base, materials: [...materialMap.values()], edgeBands: [...bandMap.values()] }
}

function projectMaterialsAfterShopEdit(saved: Material[] | undefined, before: Material[], after: Material[]): Material[] | undefined {
  if (!saved) return undefined
  const old = new Map(before.map((material) => [material.id, material]))
  const next = new Map(after.map((material) => [material.id, material]))
  return saved.map((material) => {
    const previous = old.get(material.id)
    const edited = next.get(material.id)
    if (!previous || !edited) return material
    return {
      ...material,
      ...(previous.name !== edited.name ? { name: edited.name } : {}),
      ...(previous.thickness !== edited.thickness ? { thickness: edited.thickness } : {}),
      ...(previous.sheetWidth !== edited.sheetWidth ? { sheetWidth: edited.sheetWidth } : {}),
      ...(previous.sheetHeight !== edited.sheetHeight ? { sheetHeight: edited.sheetHeight } : {}),
      ...(previous.hasGrain !== edited.hasGrain ? { hasGrain: edited.hasGrain } : {}),
      ...(previous.trimEdge !== edited.trimEdge ? { trimEdge: edited.trimEdge } : {}),
      ...(JSON.stringify(previous.decor) !== JSON.stringify(edited.decor) ? { decor: edited.decor } : {}),
      ...(JSON.stringify(previous.pbr) !== JSON.stringify(edited.pbr) ? { pbr: edited.pbr } : {}),
      ...(JSON.stringify(previous.defaultEdging) !== JSON.stringify(edited.defaultEdging)
        ? { defaultEdging: edited.defaultEdging } : {}),
      ...(JSON.stringify(previous.slab?.stockLengths) !== JSON.stringify(edited.slab?.stockLengths)
        ? { slab: edited.slab } : {}),
    }
  })
}

function projectBandsAfterShopEdit(saved: EdgeBand[] | undefined, before: EdgeBand[], after: EdgeBand[]): EdgeBand[] | undefined {
  if (!saved) return undefined
  const old = new Map(before.map((band) => [band.id, band]))
  const next = new Map(after.map((band) => [band.id, band]))
  return saved.map((band) => {
    const previous = old.get(band.id)
    const edited = next.get(band.id)
    if (!previous || !edited) return band
    return { ...band,
      ...(previous.name !== edited.name ? { name: edited.name } : {}),
      ...(previous.thickness !== edited.thickness ? { thickness: edited.thickness } : {}) }
  })
}

function projectSettingsAfterShopEdit(
  saved: SettingsOverride | undefined,
  before: SettingsOverride,
  after: SettingsOverride,
): SettingsOverride {
  const merged: SettingsOverride = { ...(saved ?? before) }
  const apply = <K extends keyof SettingsOverride>(key: K): void => {
    const previous = before[key]
    const edited = after[key]
    const unchanged = Array.isArray(previous) && Array.isArray(edited)
      ? previous.length === edited.length && previous.every((value, index) => value === edited[index])
      : previous === edited
    if (unchanged) return
    if (edited === undefined) delete merged[key]
    else merged[key] = edited
  }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)] as (keyof SettingsOverride)[])) apply(key)
  return merged
}

function treeEdit(s: State, root: GroupNode, layers = s.layers) {
  if (root === s.root && layers === s.layers) return {}
  const orphan = s.autoJoints.find((joint) => joint.boardIds.some((id) => findNode(root, id)?.kind !== 'board'))
  if (orphan) throw new ConfigValidationError('joint.boardIds',
    `${orphan.id}: буын тақтасын өшірмес бұрын буынды өшіріңіз`, 'екі бар board id')
  const autoJoints = s.autoJoints.length > 0
    ? applyAutoJointChange(s.exportProject(), { root, layers }).autoJoints ?? []
    : s.autoJoints
  return { root, layers, autoJoints, ...cabinetsFromTree(root, s.room, layers),
    past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], lastEditKey: null }
}

function mapBoard(root: GroupNode, id: string, update: (board: BoardSpec) => BoardSpec): GroupNode {
  return { ...root, children: root.children.map((child) => {
    if (child.kind === 'board' && child.id === id) return { ...child, board: update(child.board) }
    return child.kind === 'group' ? mapBoard(child, id, update) : child
  }) }
}

function withoutBoard(root: GroupNode, id: string): GroupNode {
  return { ...root, children: root.children
    .filter((child) => child.id !== id)
    .map((child) => child.kind === 'group' ? withoutBoard(child, id) : child) }
}

function firstBoardId(root: GroupNode): string | undefined {
  for (const child of root.children) {
    if (child.hidden) continue
    if (child.kind === 'board') return child.id
    if (child.kind === 'group') {
      const nested = firstBoardId(child)
      if (nested) return nested
    }
  }
  return undefined
}

function mapBoardPosition(root: GroupNode, id: string, position: Vec3): GroupNode {
  return { ...root, children: root.children.map((child) => {
    if (child.kind === 'board' && child.id === id) return { ...child,
      transform: { ...child.transform, pos: position } }
    return child.kind === 'group' ? mapBoardPosition(child, id, position) : child
  }) }
}

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
  projectName: defaultCabinet.name,
  root: treeFromProject({ schemaVersion: 3, name: defaultCabinet.name,
    room: withOpenings(DEFAULT_ROOM), materials: defaultShop.materials,
    edgeBands: defaultShop.edgeBands, cabinets: [defaultCabinet],
    placements: [{ cabinetId: defaultCabinet.id, wall: 'south', offset: 0 }] }),
  layers: [createDefaultLayer()],
  projectSettings: undefined,
  projectMaterials: undefined,
  projectEdgeBands: undefined,
  autoJoints: [],
  lights: [],
  activeId: defaultCabinet.id,
  projectInfo: {},
  priceOverrides: {},
}

/** Жобадағы қай шкаф өңделіп жатыр. Тізім ешқашан бос қалмайды. */
export const activeCabinet = (s: State): CabinetConfig =>
  s.cabinets.find((c) => c.id === s.activeId) ?? s.cabinets[0]!

export const useConfigurator = create<State>((set, get) => ({
  ...initial,
  setProjectLights(lights) {
    const parsed = SceneLightsSchema.parse(lights)
    const state = get()
    if (JSON.stringify(parsed) === JSON.stringify(state.lights)) return
    set({ lights: parsed, past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: null })
    get().saveProjectLocally()
  },
  setMaterialPbr(materialId, pbr) {
    const state = get()
    const material = state.catalog.materials.find((entry) => entry.id === materialId)
    if (!material) throw new ConfigValidationError('materialId', `материал табылмады: ${materialId}`)
    if (JSON.stringify(material.pbr) === JSON.stringify(pbr)) return
    const changed = MaterialSchema.parse({ ...material, pbr })
    const projectMaterials = state.catalog.materials.map((entry) => entry.id === materialId ? changed : entry)
    set({ projectMaterials, catalog: { ...state.catalog, materials: projectMaterials },
      past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT), future: [], lastEditKey: null })
    get().saveProjectLocally()
  },
  ...cabinetsFromTree(initial.root, initial.room, initial.layers),
  projectLoadError: null,
  unbackedCorruptProject: null,
  historyRestoreError: null,
  dismissHistoryRestoreError: () => set({ historyRestoreError: null }),
  shop: defaultShop,
  catalog: catalogOf(defaultShop),
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
  showFittings: false,
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
  snapOptions: { grid: 10, tolerance: 8 },
  setSnapOptions(options) {
    for (const [field, value] of Object.entries(options)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new ConfigValidationError(field, 'привязка мәні теріс емес бүтін мм болуы керек', '≥ 0 бүтін мм')
      }
    }
    set({ snapOptions: options })
  },
  silhouette: { on: false, height: DEFAULT_SILHOUETTE_HEIGHT },
  ar: { requestedAt: 0, busy: false, link: null, error: null },
  liveScene: null,
  liveRenderContext: null,
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
    if (!changesCabinet(s.cabinets.find((cabinet) => cabinet.id === s.activeId), patch)) return
    const now = Date.now()
    // Слайдер сүйрегенде әр миллиметр бөлек undo қадамы болмауы керек.
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS
    set({
      ...legacyEdit(s, s.cabinets.map((c) => (c.id === s.activeId ? { ...c, ...patch } : c))),
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: key,
      lastEditAt: now,
    })
  },

  addBoard() {
    const s = get()
    const material = s.catalog.materials.find((item) => item.thickness >= 10) ?? s.catalog.materials[0]
    if (!material) throw new ConfigValidationError('materialId', 'материал жоқ', 'каталогтағы материал')
    const id = `board-${crypto.randomUUID()}`
    const board: BoardSpec = { materialId: material.id, length: 100, width: 100,
      orientation: ORIENT_FACING, role: 'custom', grainAlongLength: material.hasGrain,
      edges: { L1: null, L2: null, W1: null, W2: null } }
    const root: GroupNode = { ...s.root, children: [...s.root.children, {
      kind: 'board', id, name: tr('Свободная доска'), transform: structuredClone(IDENTITY_TRANSFORM), board,
    }] }
    set({ ...treeEdit(s, root), activeId: id, selected: id, firstRun: false })
    return id
  },

  addSolid() {
    const s = get()
    const id = `solid-${crypto.randomUUID()}`
    const root: GroupNode = { ...s.root, children: [...s.root.children, createSolidNode(id, tr('Декоративный блок'))] }
    set({ ...treeEdit(s, root), activeId: id, selected: id, firstRun: false })
    return id
  },

  editSolid(id, patch) {
    const s = get()
    const root = editSolidTree(s.root, id, s.layers, { solid: patch })
    if (root !== s.root) set(treeEdit(s, root))
  },

  setSolidPosition(id, position) {
    const s = get()
    const root = editSolidTree(s.root, id, s.layers, { position })
    if (root !== s.root) set(treeEdit(s, root))
  },

  mirrorFreeNode(id) {
    const s = get()
    const result = appendFreeMirror(s.root, id, s.catalog, s.layers, s.projectSettings ?? s.shop.settings)
    flattenTree(result.root, s.catalog, s.projectSettings ?? s.shop.settings, s.layers)
    set({ ...treeEdit(s, result.root), activeId: result.id, selected: result.id })
    return result.id
  },

  removeBoard(id) {
    const s = get()
    const node = assertTreeNodeEditable(s.root, id, s.layers)
    if (node.kind !== 'board') throw new ConfigValidationError('nodeId', `тақта емес: ${id}`, 'board id')
    set({ ...treeEdit(s, withoutBoard(s.root, id)),
      activeId: s.activeId === id ? s.cabinets[0]?.id ?? firstBoardId(withoutBoard(s.root, id)) ?? '' : s.activeId,
      selected: s.selected === id ? null : s.selected })
  },

  editBoard(id, patch) {
    const s = get()
    const node = assertTreeNodeEditable(s.root, id, s.layers)
    if (node.kind !== 'board') throw new ConfigValidationError('nodeId', `тақта емес: ${id}`, 'board id')
    const board = { ...node.board, ...patch }
    if (JSON.stringify(board) === JSON.stringify(node.board)) return
    const root = mapBoard(s.root, id, () => board)
    flattenTree(root, s.catalog, s.projectSettings ?? s.shop.settings, s.layers)
    applyAutoJointChange(s.exportProject(), { root })
    set(treeEdit(s, root))
  },

  autoJointBoards(ids, kind, tolerance) {
    const s = get()
    for (const id of ids) {
      const node = assertTreeNodeEditable(s.root, id, s.layers)
      if (node.kind !== 'board') throw new ConfigValidationError('boardIds', `${id}: тақта емес`, 'екі board түйіні')
    }
    const existing = s.autoJoints.find((joint) => ids.every((id) => joint.boardIds.includes(id)))
    if (existing?.kind === kind && existing.tolerance === tolerance) return
    if (existing && existing.tolerance !== tolerance) throw new ConfigValidationError('joint.tolerance',
      'бар буынның жанасу шегін бұл әрекет өзгерте алмайды', `${existing.tolerance} мм`)
    const change = existing
      ? { joint: { id: existing.id, kind } }
      : { create: { id: `joint-${crypto.randomUUID()}`, boardIds: ids, kind, tolerance } }
    const next = applyAutoJointChange(s.exportProject(), change)
    set({ autoJoints: next.autoJoints ?? [], past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: null })
  },

  setAutoJointKind(id, kind) {
    const s = get()
    const existing = s.autoJoints.find((joint) => joint.id === id)
    if (existing?.kind === kind) return
    const next = applyAutoJointChange(s.exportProject(), { joint: { id, kind } })
    set({ autoJoints: next.autoJoints ?? [], past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: null })
  },

  removeAutoJoint(id) {
    const s = get()
    if (!s.autoJoints.some((joint) => joint.id === id)) {
      throw new ConfigValidationError('joint.id', `буын табылмады: ${id}`, 'бар id')
    }
    set({ autoJoints: s.autoJoints.filter((joint) => joint.id !== id),
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], lastEditKey: null })
  },

  setBoardPosition(id, position) {
    const s = get()
    const node = assertTreeNodeEditable(s.root, id, s.layers)
    if (node.kind !== 'board') throw new ConfigValidationError('nodeId', `тақта емес: ${id}`, 'board id')
    for (const [axis, value] of Object.entries(position)) {
      if (!Number.isSafeInteger(value)) throw new ConfigValidationError(`transform.pos.${axis}`, 'орын бүтін мм болуы керек', 'бүтін мм')
    }
    if (Object.keys(position).every((axis) => position[axis as keyof Vec3] === node.transform.pos[axis as keyof Vec3])) return
    set(treeEdit(s, mapBoardPosition(s.root, id, position)))
  },

  editSection(index, patch, key) {
    const s = get()
    const sections = activeCabinet(s).sections.map((sec, i) => (i === index ? { ...sec, ...patch } : sec))
    get().edit(`${key}:${index}`, { sections })
  },

  addSection() {
    const s = get()
    const cabinet = activeCabinet(s)
    const result = planSectionAddition(cabinet, s.catalog, s.projectSettings ?? s.shop.settings)
    if (!result.ok) return result.message
    get().edit('sections:add', { sections: result.sections })
    return null
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
    if (!s.cabinets.some((cabinet) => cabinet.id === s.activeId)) {
      get().appendCabinet({ ...templateToCabinet(template, s.catalog), id: `cabinet-${crypto.randomUUID()}` })
      set({ templateId: id, galleryOpen: false })
      return
    }
    const next = { ...templateToCabinet(template, s.catalog), id: s.activeId }
    const titles = templateProjectTitles(s.projectName, s.root.name, defaultCabinet.name, next.name)
    const edited = legacyEdit(s, s.cabinets.map((c) => (c.id === s.activeId ? next : c)))
    set({
      ...edited,
      projectName: titles.projectName,
      root: { ...edited.root, name: titles.rootName },
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
    const room = {
      width: Math.max(s.room.width, preset.room.width),
      depth: Math.max(s.room.depth, preset.room.depth),
      height: Math.max(s.room.height, preset.room.height),
    }
    set({
      room,
      ...replaceProjectScene(s, cabinets, placements, room),
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
   * Әдетте бөлме генератор берген өлшемге көшеді; өлшеуден келгенде нақты бөлме сақталады.
   */
  loadKitchen(options, measuredRoom) {
    const s = get()
    const { cabinets, placements, room } = generateKitchen(options, s.catalog)
    if (cabinets.length === 0) {
      throw new Error(measuredRoom ? 'Өлшенген қабырғаға ас үй модулі сыймады' : 'lengthA: ас үй модулі сыймады; 600–20 000 мм')
    }
    const nextRoom = measuredRoom
      ? withOpenings(measuredRoom)
      : withOpenings({ ...s.room, width: room.width, depth: room.depth, height: Math.max(s.room.height, room.height) })
    const name = tr('Кухня')
    set({
      room: nextRoom,
      ...replaceProjectScene(s, cabinets, placements, nextRoom, name),
      projectName: name,
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
    const nextRoom = withOpenings({ ...s.room, width: room.width, depth: room.depth, height: Math.max(s.room.height, room.height) })
    set({
      room: nextRoom,
      ...replaceProjectScene(s, cabinets, placements, nextRoom),
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
    if (!s.cabinets.some((item) => item.id === s.activeId)) {
      get().appendCabinet({ ...cabinet, id: `cabinet-${crypto.randomUUID()}` })
      set({ aiOpen: false })
      return
    }
    const next = { ...cabinet, id: s.activeId }
    set({
      ...legacyEdit(s, s.cabinets.map((c) => (c.id === s.activeId ? next : c))),
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
      schemaVersion: 4 as const,
      name: s.projectName,
      materials: s.catalog.materials,
      edgeBands: s.catalog.edgeBands,
      settings: s.projectSettings ?? s.shop.settings,
      root: s.root,
      layers: s.layers,
      room: s.room,
      info: cleanProjectInfo(s.projectInfo),
      priceOverrides: cleanPriceOverrides(s.priceOverrides),
      lights: s.lights,
      autoJoints: s.autoJoints,
    }
  },

  /**
   * Жобаны ашу. Файлдағы материал цехта жоқ болса — ол цех каталогына
   * БАҒАСЫЗ қосылады: әйтпесе бөтен цехтан келген жоба мүлде ашылмайды да,
   * пайдаланушы себебін түсінбей қалады.
   */
  loadProject(file) {
    const s = get()
    const project = parseProjectV4(file, { migrateMaterials: false })
    const known = new Set(s.shop.materials.map((m) => m.id))
    const shopMaterials = new Map(s.shop.materials.map((m) => [m.id, m]))
    const missing = project.materials.filter((m) => !known.has(m.id)).map((m) => ({ ...m,
      pricePerSheet: shopMaterials.get(LEGACY_MATERIAL_ALIASES[m.id] ?? '')?.pricePerSheet ?? 0 }))
    const aliases = missing.map((m) => [m.id, LEGACY_MATERIAL_ALIASES[m.id]] as const)
      .filter((pair): pair is readonly [string, string] => pair[1] !== undefined && shopMaterials.has(pair[1]))
    const withAliases = <T>(values: Record<string, T>, prefix = ''): Record<string, T> => {
      const next = { ...values }
      for (const [oldId, targetId] of aliases) {
        const source = values[`${prefix}${targetId}`]
        if (source !== undefined && next[`${prefix}${oldId}`] === undefined) next[`${prefix}${oldId}`] = source
      }
      return next
    }
    const knownBands = new Set(s.shop.edgeBands.map((b) => b.id))
    const missingBands = project.edgeBands.filter((b) => !knownBands.has(b.id)).map((b) => ({ ...b, pricePerMeter: 0 }))

    const shop: ShopProfile = missing.length > 0 || missingBands.length > 0
      ? {
          ...s.shop,
          materials: [...s.shop.materials, ...missing],
          edgeBands: [...s.shop.edgeBands, ...missingBands],
          marketPrices: withAliases(s.shop.marketPrices, 'material:'),
          priceLists: s.shop.priceLists.map((list) => ({ ...list,
            materialPrices: withAliases(list.materialPrices),
            marketPrices: withAliases(list.marketPrices, 'material:'),
          })),
        }
      : s.shop

    set({
      shop,
      catalog: projectCatalog(shop, project.materials, project.edgeBands),
      room: project.room,
      projectName: project.name,
      root: project.root,
      layers: project.layers ?? [createDefaultLayer()],
      projectSettings: project.settings,
      projectMaterials: project.materials,
      projectEdgeBands: project.edgeBands,
      lights: project.lights,
      autoJoints: project.autoJoints ?? [],
      ...cabinetsFromTree(project.root, project.room, project.layers),
      activeId: cabinetsFromTree(project.root, project.room, project.layers).cabinets[0]?.id ?? firstBoardId(project.root) ?? '',
      templateId: '',
      projectInfo: project.info ?? {},
      priceOverrides: project.priceOverrides ?? {},
      projectLoadError: null,
      historyRestoreError: null,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /** Тапсырыс реквизиттерін түзету. UI бос жолды бос қалдырады; экспорт оны қиып тастайды. */
  editProjectInfo(patch) {
    const s = get()
    const next = { ...s.projectInfo, ...patch }
    if (JSON.stringify(next) === JSON.stringify(s.projectInfo)) return
    const now = Date.now()
    const key = `projectInfo:${Object.keys(patch).sort().join(',')}`
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS
    set({ projectInfo: next,
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: key, lastEditAt: now })
    get().saveProjectLocally()
  },

  /**
   * Баға түзетулерін түзету. `patch`-та `undefined` берілген өріс өшеді —
   * мыс. `editPriceOverrides({ salePrice: undefined })` override-ты алып
   * тастайды да, баға қайта коэффициентпен есептеледі.
   */
  editPriceOverrides(patch) {
    const s = get()
    const next = { ...s.priceOverrides, ...patch }
    if (JSON.stringify(next) === JSON.stringify(s.priceOverrides)) return
    const now = Date.now()
    const key = `priceOverrides:${Object.keys(patch).sort().join(',')}`
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS
    set({ priceOverrides: next,
      past: coalesce ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: key, lastEditAt: now })
    get().saveProjectLocally()
    // Workspace автосақтауы бағаға қарамайды: клиент коды мен келісім мөрі
    // ескі бағада қалмауы үшін share осында жаңарады.
    get().syncShare()
  },

  saveProjectLocally() {
    if (get().projectLoadError) return get().projectLoadError
    const unbacked = get().unbackedCorruptProject
    if (unbacked !== null) {
      try {
        window.localStorage.setItem(CORRUPT_PROJECT_BACKUP_KEY, unbacked)
        set({ unbackedCorruptProject: null })
      } catch (error) {
        return `Бүлінген жобаның сақтық көшірме жазылмады: ${error instanceof Error ? error.message : String(error)}`
      }
    }
    try {
      window.localStorage.setItem(PROJECT_KEY, JSON.stringify(get().exportProject()))
      return null
    } catch (error) {
      return `Жоба браузер қоймасына жазылмады: ${error instanceof Error ? error.message : String(error)}`
    }
  },

  /** Сақталған жобаны қайтару. Тек браузерде шақырылады. */
  hydrateProject() {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(PROJECT_KEY)
    } catch (error) {
      set({ firstRun: false,
        projectLoadError: `Сақталған жоба оқылмады: ${error instanceof Error ? error.message : String(error)}; сақтық көшірме жазылмады: бастапқы файл оқылмады` })
      return
    }
    if (!raw) return
    try {
      const file = parseProjectV4(JSON.parse(raw))
      set({
        room: file.room,
        projectName: file.name,
        root: file.root,
        layers: file.layers ?? [createDefaultLayer()],
        projectSettings: file.settings,
        projectMaterials: file.materials,
        projectEdgeBands: file.edgeBands,
        lights: file.lights,
        autoJoints: file.autoJoints ?? [],
        catalog: projectCatalog(get().shop, file.materials, file.edgeBands),
        ...cabinetsFromTree(file.root, file.room, file.layers),
        activeId: cabinetsFromTree(file.root, file.room, file.layers).cabinets[0]?.id ?? firstBoardId(file.root) ?? '',
        projectInfo: file.info ?? {},
        priceOverrides: file.priceOverrides ?? {},
        // Жұмыс табылды — бастау экранын көрсетудің қажеті жоқ.
        firstRun: false,
        projectLoadError: null,
        historyRestoreError: null,
      })
    } catch (error) {
      // Қате файлды автосақтау басып кетпеуі керек: пайдаланушы басқа жобаны
      // анық ашқанша немесе Reset басқанша түпнұсқа localStorage-та қалады.
      let backupError = ''
      let unbackedCorruptProject: string | null = null
      try {
        window.localStorage.setItem(CORRUPT_PROJECT_BACKUP_KEY, raw)
      } catch (cause) {
        backupError = `; сақтық көшірме жазылмады: ${cause instanceof Error ? cause.message : String(cause)}`
        unbackedCorruptProject = raw
      }
      set({ firstRun: false, unbackedCorruptProject,
        projectLoadError: `Сақталған жоба оқылмады: ${error instanceof Error ? error.message : String(error)}${backupError}` })
    }
  },

  setShop(shop) {
    const synced = syncActivePriceList(shop)
    set((s) => {
      const catalog = projectCatalog(synced, s.projectMaterials, s.projectEdgeBands)
      const autoJoints = s.autoJoints.length > 0
        ? applyAutoJointChange(s.exportProject(), {
            materials: catalog.materials, edgeBands: catalog.edgeBands,
            settings: s.projectSettings ?? synced.settings,
          }).autoJoints ?? []
        : s.autoJoints
      return { shop: synced, catalog, autoJoints }
    })
    // Сақтау сәтсіз болса (жабық режим, толған қойма) — жұмыс тоқтамауы керек.
    try {
      window.localStorage.setItem(SHOP_KEY, JSON.stringify(synced))
    } catch {
      // қоймаға жазылмады: профиль осы сеанста ғана тұрады
    }
  },

  editShop(patch) {
    const s = get()
    const changesJointInputs = Boolean(patch.settings || patch.materials || patch.edgeBands)
    const nextShop = syncActivePriceList({ ...s.shop, ...patch })
    const projectSettings = patch.settings
      ? projectSettingsAfterShopEdit(s.projectSettings, s.shop.settings, patch.settings) : s.projectSettings
    const projectMaterials = patch.materials
      ? projectMaterialsAfterShopEdit(s.projectMaterials, s.shop.materials, patch.materials) : s.projectMaterials
    const projectEdgeBands = patch.edgeBands
      ? projectBandsAfterShopEdit(s.projectEdgeBands, s.shop.edgeBands, patch.edgeBands) : s.projectEdgeBands
    const nextCatalog = projectCatalog(nextShop, projectMaterials, projectEdgeBands)
    // Check the whole geometry before mutating either project overrides or undo.
    const autoJoints = s.autoJoints.length > 0 && changesJointInputs
      ? applyAutoJointChange(s.exportProject(), {
          materials: nextCatalog.materials, edgeBands: nextCatalog.edgeBands,
          settings: projectSettings ?? nextShop.settings,
        }).autoJoints ?? []
      : s.autoJoints
    // A shop catalogue is global, but this project's manufacturing state needs
    // one undo step. Keep the previous effective values as project overrides.
    const previous = changesJointInputs && s.autoJoints.length > 0
      ? { ...snapshot(s),
          projectMaterials: s.projectMaterials ?? s.catalog.materials,
          projectEdgeBands: s.projectEdgeBands ?? s.catalog.edgeBands,
          projectSettings: s.projectSettings ?? s.shop.settings }
      : null
    set({
      projectSettings, projectMaterials, projectEdgeBands, autoJoints,
      ...(previous ? { past: [...s.past, previous].slice(-HISTORY_LIMIT), future: [], lastEditKey: null } : {}),
    })
    get().setShop(nextShop)
    if (patch.settings || patch.materials || patch.edgeBands) get().saveProjectLocally()
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
      set((s) => ({ shop, catalog: projectCatalog(shop, s.projectMaterials, s.projectEdgeBands) }))
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
  setLiveRenderContext: (liveRenderContext) => set({ liveRenderContext }),
  setAr: (patch) => set((s) => ({ ar: { ...s.ar, ...patch } })),
  setShowFronts: (showFronts) => set({ showFronts }),
  setShowDrilling: (showDrilling) => set({ showDrilling, ...(showDrilling ? { showFittings: false } : {}) }),
  setShowFittings: (showFittings) => set({ showFittings, ...(showFittings ? { showDrilling: false } : {}) }),
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
    if (!session || session.expiresAt <= Date.now()) {
      return Promise.resolve({ ok: false, error: tr('Код клиента истёк') })
    }
    const send = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (get().shareSession?.code !== session.code) {
        return { ok: false, error: tr('Код клиента изменился') }
      }
      try {
        const response = await fetch(`/api/share/${session.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-share-key': session.key },
          body: JSON.stringify(get().exportProject()),
        })
        if (!response.ok) return { ok: false, error: `${tr('Не удалось обновить проект для клиента')} (${response.status})` }
        return { ok: true }
      } catch (cause) {
        console.warn('Код клиента: обновление не отправлено', cause)
        return { ok: false, error: tr('Нет связи с сервером') }
      }
    }
    const result = shareSyncTail.then(send)
    shareSyncTail = result.then(() => undefined, (cause: unknown) => {
      console.warn('Код клиента: очередь обновления прервана', cause)
    })
    return result
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
      const recoveringDamagedProject = get().projectLoadError !== null
      const raw = window.localStorage.getItem(HISTORY_KEY)
      if (!raw) throw new Error('тарих бос')
      const list: { at: number; json: string }[] = JSON.parse(raw)
      const found = list.find((x) => x.at === at)
      if (!found) throw new Error(`жазба табылмады: ${at}`)
      get().loadProject(parseProjectV4(JSON.parse(found.json)))
      const saveError = get().saveProjectLocally()
      if (saveError) {
        if (recoveringDamagedProject) set({ projectLoadError: saveError })
        else set({ historyRestoreError: saveError })
        return
      }
      set({ historyRestoreError: null })
    } catch (error) {
      set({ historyRestoreError: `Тарихтан қалпына келтіру мүмкін болмады: ${error instanceof Error ? error.message : String(error)}` })
    }
  },
  setFirstRun: (firstRun) => set({ firstRun }),
  setAccountOpen: (accountOpen) => set({ accountOpen }),
  setRenderOpen: (renderOpen) => set({ renderOpen }),

  editRoom(patch) {
    const dimensionIssue = roomDimensionIssue(patch)
    if (dimensionIssue) throw new ConfigValidationError(dimensionIssue.field, 'бөлме өлшемі жарамсыз', dimensionIssue.allowed)
    const s = get()
    const room = { ...s.room, ...patch }
    // Қабырғамен бірге тек қабырғаға тіреліп тұрған әрі өңделетін шкаф
    // жылжиды. Құлыпталғаны орнында қалады — бөлмені өзгертуді бұғаттамайды.
    const attached = wallAttachedPlacements(s.root, s.room).filter((placement) => {
      try {
        assertTreeNodeEditable(s.root, placement.cabinetId, s.layers)
        return true
      } catch {
        return false
      }
    })
    set({
      room,
      ...legacyEdit(s, s.cabinets, attached, room, placedIds(attached)),
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

  renameNode(id, name) {
    const s = get()
    set(treeEdit(s, renameTreeNode(s.root, id, name, s.layers)))
  },
  setNodeHidden(id, hidden) {
    const s = get()
    set(treeEdit(s, setTreeNodeFlag(s.root, id, 'hidden', hidden, s.layers)))
  },
  setNodeLocked(id, locked) {
    const s = get()
    set(treeEdit(s, setTreeNodeFlag(s.root, id, 'locked', locked, s.layers)))
  },
  groupSelected(ids, groupId, name) {
    const s = get()
    set(treeEdit(s, groupNodes(s.root, ids, groupId, name, s.layers)))
  },
  ungroup(id) {
    const s = get()
    set(treeEdit(s, ungroupNode(s.root, id, s.layers)))
  },
  reparent(id, parentId) {
    const s = get()
    const next = reparentNode(s.root, id, parentId, s.layers)
    if (next !== s.root) set(treeEdit(s, next))
  },
  arrayNode(id, opts) {
    const s = get()
    const root = appendNodeArray(s.root, id, opts, s.layers)
    flattenTree(root, s.catalog, s.projectSettings ?? s.shop.settings, s.layers)
    set(treeEdit(s, root))
  },
  translateNodes(moves, opts) {
    const s = get()
    const root = translateTreeNodes(s.root, moves, s.layers)
    if (root !== s.root) {
      set({ ...treeEdit(s, root), past: opts?.continueGesture ? s.past : [...s.past, snapshot(s)].slice(-HISTORY_LIMIT) })
    }
  },
  arrangeNodes(ids, axis, mode) {
    const s = get()
    const root = arrangeTreeSelection(s.root, ids, s.catalog, s.layers, axis, mode, s.projectSettings ?? s.shop.settings)
    if (root !== s.root) set(treeEdit(s, root))
  },
  placeLibraryItem(item, parentId) {
    const s = get()
    const merged = mergeLibraryCatalog(s.catalog, item)
    // Баға тек цехтікі (жоқ болса 0) — кітапхана файлындағы баға жобаға кірмейді,
    // әйтпесе қойғандағы смета жобаны қайта ашқандағыдан өзгеше шығады.
    const catalog = projectCatalog(s.shop, merged.materials, merged.edgeBands)
    const root = insertLibraryItem(s.root, item, catalog, parentId ?? s.root.id, () => `node-${crypto.randomUUID()}`)
    set({ root, catalog, projectMaterials: catalog.materials, projectEdgeBands: catalog.edgeBands,
      ...cabinetsFromTree(root, s.room, s.layers),
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [], lastEditKey: null })
  },
  replaceFreeBoardMaterial(oldId, newId) {
    const s = get()
    if (oldId === newId) return
    if (!s.catalog.materials.some((material) => material.id === newId)) {
      throw new ConfigValidationError('newMaterialId', `материал табылмады: ${newId}`)
    }
    const root = replaceTreeBoardMaterial(s.root, oldId, newId, s.layers)
    if (root !== s.root) set(treeEdit(s, root))
  },
  replaceProjectMaterial(oldId, newId) {
    const s = get()
    if (oldId === newId) return
    if (!s.catalog.materials.some((material) => material.id === newId)) {
      throw new ConfigValidationError('newMaterialId', `материал табылмады: ${newId}`)
    }
    const root = replaceTreeMaterial(s.root, oldId, newId, s.layers)
    if (root !== s.root) set(treeEdit(s, root))
  },
  createLayer(name) {
    const s = get()
    set(treeEdit(s, s.root, createTreeLayer(s.layers, `layer-${crypto.randomUUID()}`, name)))
  },
  renameLayer(id, name) {
    const s = get()
    set(treeEdit(s, s.root, renameTreeLayer(s.layers, id, name)))
  },
  setLayerVisible(id, visible) {
    const s = get()
    set(treeEdit(s, s.root, setLayerVisible(s.layers, id, visible)))
  },
  setLayerLocked(id, locked) {
    const s = get()
    set(treeEdit(s, s.root, setLayerLocked(s.layers, id, locked)))
  },
  setLayerColor(id, color) {
    const s = get()
    set(treeEdit(s, s.root, setLayerColor(s.layers, id, color)))
  },
  deleteLayer(id) {
    const s = get()
    const result = deleteTreeLayer(s.root, s.layers, id)
    set(treeEdit(s, result.root, result.layers))
  },
  assignNodeLayer(id, layerId) {
    const s = get()
    assertTreeNodeEditable(s.root, id, s.layers)
    set(treeEdit(s, setNodeLayer(s.root, id, layerId, s.layers)))
  },

  /** Жаңа шкаф таңдалған қабырғаның бос жеріне қойылады. */
  addCabinet() {
    const s = get()
    const entries = s.cabinets.flatMap((c) => {
      const placement = s.placements.find((p) => p.cabinetId === c.id)
      return placement ? [{ cabinet: c, placement }] : []
    })
    const id = `cabinet-${crypto.randomUUID()}`
    const source = s.cabinets.find((item) => item.id === s.activeId)
      ?? templateToCabinet(findTemplate(defaultTemplateId)!, s.catalog)
    const cabinet = { ...source, id }
    set({
      ...legacyEdit(s, [...s.cabinets, cabinet], [
        ...s.placements,
        { cabinetId: id, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ]),
      activeId: id,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  appendCabinet(cabinet) {
    const s = get()
    const entries = s.cabinets.flatMap((item) => {
      const placement = s.placements.find((p) => p.cabinetId === item.id)
      return placement ? [{ cabinet: item, placement }] : []
    })
    const placement = { cabinetId: cabinet.id, wall: s.selectedWall,
      offset: nextFreeOffset(s.room, s.selectedWall, entries) }
    set({ ...legacyEdit(s, [...s.cabinets, cabinet], [...s.placements, placement]),
      activeId: cabinet.id, templateId: '', past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: null })
  },
  replaceCabinets(cabinets) {
    const s = get()
    set({ ...legacyEdit(s, cabinets), past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [], lastEditKey: null })
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
    const entries = s.cabinets.flatMap((c) => {
      const placement = s.placements.find((p) => p.cabinetId === c.id)
      return placement ? [{ cabinet: c, placement }] : []
    })
    const newId = `cabinet-${crypto.randomUUID()}`
    set({
      ...legacyEdit(s, [...s.cabinets, { ...source, id: newId, name: `${source.name} (копия)` }], [
        ...s.placements,
        { cabinetId: newId, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ]),
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
    const entries = s.cabinets.flatMap((c) => {
      const placement = s.placements.find((p) => p.cabinetId === c.id)
      return placement ? [{ cabinet: c, placement }] : []
    })
    const newId = `cabinet-${crypto.randomUUID()}`
    set({
      ...legacyEdit(s, [...s.cabinets, mirrorCabinetConfig(source, newId)], [
        ...s.placements,
        { cabinetId: newId, wall: s.selectedWall, offset: nextFreeOffset(s.room, s.selectedWall, entries) },
      ]),
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
      ...legacyEdit(s, cabinets, s.placements.filter((p) => p.cabinetId !== id)),
      activeId: s.activeId === id ? cabinets[0]!.id : s.activeId,
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  movePlacement(cabinetId, patch, opts) {
    const s = get()
    // Еркін тұрған шкафтың placement-і тек жуықтау (ең жақын қабырғаға
    // тартылған): оны өзгертсек, шкаф қабырғаға секіреді. 3D-дегі `wallBound`
    // ережесімен бірдей — тек қабырғаға дәл тірелген шкаф жылжиды.
    if (!wallAttachedPlacements(s.root, s.room).some((placement) => placement.cabinetId === cabinetId)) {
      throw new ConfigValidationError('placement', `шкаф қабырғаға тірелмеген: ${cabinetId}`,
        'қабырғаға тірелген шкаф')
    }
    const now = Date.now()
    const key = `placement:${cabinetId}`
    const coalesce = opts?.continueGesture === true || (s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS)
    set({
      ...legacyEdit(s, s.cabinets, s.placements.map((p) => (p.cabinetId === cabinetId ? { ...p, ...patch } : p)),
        s.room, new Set([cabinetId])),
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
      ...cabinetsFromTree(previous.root, previous.room, previous.layers),
      catalog: projectCatalog(s.shop, previous.projectMaterials, previous.projectEdgeBands),
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
      ...cabinetsFromTree(next.root, next.room, next.layers),
      catalog: projectCatalog(s.shop, next.projectMaterials, next.projectEdgeBands),
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      lastEditKey: null,
    })
  },

  reset() {
    const s = get()
    set({
      ...initial,
      ...cabinetsFromTree(initial.root, initial.room, initial.layers),
      catalog: projectCatalog(s.shop),
      projectInfo: {},
      priceOverrides: {},
      projectLoadError: null,
      historyRestoreError: null,
      templateId: defaultTemplateId,
      past: [...s.past, snapshot(s)],
      future: [],
      lastEditKey: null,
    })
    // Explicit reset replaces the unreadable source; its raw backup remains.
    if (s.projectLoadError) {
      const saveError = get().saveProjectLocally()
      if (saveError) set({ projectLoadError: saveError })
    }
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
