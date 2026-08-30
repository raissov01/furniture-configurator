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
  catalogOf,
  findSet,
  findTemplate,
  nextFreeOffset,
  parseProject,
  parseShopProfile,
  setToProject,
  templateToCabinet,
} from '@/src/core/index'
import type {
  CabinetConfig, Catalog, Placement, ProjectFile, Room, Section, SectionContent, ShopProfile, WallId,
} from '@/src/core/index'

/** Цех профилі браузерде осы кілтпен жатады. Сервер қосылғанда осы жерден синхрондалады. */
const SHOP_KEY = 'furniture-configurator:shop'
/** Ағымдағы жоба — бетті жаңартқанда жұмыс жоғалмауы үшін. */
const PROJECT_KEY = 'furniture-configurator:project'

/** Осы уақыт ішіндегі бір өрістің өзгерісі бір undo қадамына біріктіріледі. */
const COALESCE_MS = 500
/** Тарих тереңдігі. */
const HISTORY_LIMIT = 100

export type CameraPreset = 'front' | 'three-quarter' | 'inside' | 'plan' | 'room'

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
  shopOpen: boolean
  quoteOpen: boolean
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

  edit(key: string, patch: Partial<CabinetConfig>): void
  editSection(index: number, patch: Partial<Section>, key: string): void
  addSection(): void
  removeSection(index: number): void

  loadTemplate(id: string): void
  loadSet(id: string): void
  loadCabinet(cabinet: CabinetConfig): void

  exportProject(): ProjectFile
  loadProject(file: ProjectFile): void
  saveProjectLocally(): void
  hydrateProject(): void

  setShop(shop: ShopProfile): void
  editShop(patch: Partial<ShopProfile>): void
  hydrateShop(): void
  setShopOpen(v: boolean): void
  setQuoteOpen(v: boolean): void

  editRoom(patch: Partial<Room>): void
  setSelectedWall(wall: WallId): void
  setActive(id: string): void
  addCabinet(): void
  removeCabinet(id: string): void
  movePlacement(cabinetId: string, patch: Partial<Omit<Placement, 'cabinetId'>>): void

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

const initial: Snapshot = {
  room: DEFAULT_ROOM,
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
  shopOpen: false,
  quoteOpen: false,
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
      past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
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
      })
    } catch {
      // Ескі не бүлінген жазба: үнсіз ЖОЙМАЙМЫЗ, әдепкі жобамен ашылады.
    }
  },

  setShop(shop) {
    set({ shop, catalog: catalogOf(shop) })
    // Сақтау сәтсіз болса (жабық режим, толған қойма) — жұмыс тоқтамауы керек.
    try {
      window.localStorage.setItem(SHOP_KEY, JSON.stringify(shop))
    } catch {
      // қоймаға жазылмады: профиль осы сеанста ғана тұрады
    }
  },

  editShop(patch) {
    get().setShop({ ...get().shop, ...patch })
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
  setActive: (activeId) => set({ activeId, templateId: '' }),

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

  movePlacement(cabinetId, patch) {
    const s = get()
    const now = Date.now()
    const key = `placement:${cabinetId}`
    const coalesce = s.lastEditKey === key && now - s.lastEditAt < COALESCE_MS
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
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setRoomOpen: (roomOpen) => set({ roomOpen }),
}))
