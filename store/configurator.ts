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
import { catalog, defaultCabinet, defaultTemplateId } from '@/lib/defaults'
import {
  DEFAULT_ROOM,
  findTemplate,
  nextFreeOffset,
  templateToCabinet,
} from '@/src/core/index'
import type { CabinetConfig, Placement, Room, Section, SectionContent, WallId } from '@/src/core/index'

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
  loadCabinet(cabinet: CabinetConfig): void

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
    const next = { ...templateToCabinet(template, catalog), id: s.activeId }
    set({
      cabinets: s.cabinets.map((c) => (c.id === s.activeId ? next : c)),
      templateId: id,
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
