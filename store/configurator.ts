'use client'

/**
 * Конфигуратордың күйі. КОНФИГ қана сақталады — панельдер әрдайым қайта
 * есептеледі (CLAUDE.md §3, §7). Мұнда геометрия есептелмейді.
 */

import { create } from 'zustand'
import { catalog, defaultCabinet, defaultTemplateId } from '@/lib/defaults'
import { findTemplate, templateToCabinet } from '@/src/core/index'
import type { CabinetConfig, Section, SectionContent } from '@/src/core/index'

/** Осы уақыт ішіндегі бір өрістің өзгерісі бір undo қадамына біріктіріледі. */
const COALESCE_MS = 500
/** Тарих тереңдігі. */
const HISTORY_LIMIT = 100

export type CameraPreset = 'front' | 'three-quarter' | 'inside' | 'plan'

type State = {
  cabinet: CabinetConfig
  /** Соңғы жүктелген шаблон. Габарит аралығын UI осыдан алады. */
  templateId: string
  /** Шаблон галереясы ашық па */
  galleryOpen: boolean
  /** Чат-бот панелі ашық па */
  aiOpen: boolean
  past: CabinetConfig[]
  future: CabinetConfig[]
  lastEditKey: string | null
  lastEditAt: number

  /** Ажыратылған көрініс: 0 — жиналған, 1 — толық ажыраған */
  exploded: number
  showDimensions: boolean
  cameraPreset: CameraPreset
  /** Тінтуір астындағы панельдің id-і */
  hovered: string | null

  edit(key: string, patch: Partial<CabinetConfig>): void
  loadTemplate(id: string): void
  loadCabinet(cabinet: CabinetConfig): void
  setGalleryOpen(v: boolean): void
  setAiOpen(v: boolean): void
  editSection(index: number, patch: Partial<Section>, key: string): void
  addSection(): void
  removeSection(index: number): void
  undo(): void
  redo(): void
  reset(): void
  setExploded(v: number): void
  setShowDimensions(v: boolean): void
  setCameraPreset(v: CameraPreset): void
  setHovered(v: string | null): void
}

export const useConfigurator = create<State>((set, get) => ({
  cabinet: defaultCabinet,
  templateId: defaultTemplateId,
  galleryOpen: false,
  aiOpen: false,
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
      cabinet: { ...s.cabinet, ...patch },
      past: coalesce ? s.past : [...s.past, s.cabinet].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: key,
      lastEditAt: now,
    })
  },

  /**
   * Шаблонды жүктеу. Бұл ТОЛЫҚ ауыстыру: жаңа корпустың секциялары мен
   * материалдары шаблондікі болады. Undo тарихына бір қадам болып түседі,
   * сондықтан қате бассаң Ctrl+Z қайтарады.
   */
  loadTemplate(id) {
    const template = findTemplate(id)
    if (!template) return
    const s = get()
    set({
      cabinet: templateToCabinet(template, catalog),
      templateId: id,
      galleryOpen: false,
      past: [...s.past, s.cabinet].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  /**
   * Дайын конфигті жүктеу — чат-боттың варианты осы жолмен түседі.
   * Шаблон байланысы үзіледі: бұл енді «свой корпус», габарит аралығы жоқ.
   */
  loadCabinet(cabinet) {
    const s = get()
    set({
      cabinet,
      templateId: '',
      aiOpen: false,
      past: [...s.past, s.cabinet].slice(-HISTORY_LIMIT),
      future: [],
      lastEditKey: null,
    })
  },

  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),

  editSection(index, patch, key) {
    const s = get()
    const sections = s.cabinet.sections.map((sec, i) => (i === index ? { ...sec, ...patch } : sec))
    get().edit(`${key}:${index}`, { sections })
  },

  addSection() {
    const s = get()
    const nextId = `s${s.cabinet.sections.length + 1}`
    const contents: SectionContent[] = [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }]
    get().edit('sections:add', {
      sections: [
        ...s.cabinet.sections,
        { id: nextId, widthMode: 'flex', contents, fronts: { count: 1, mount: 'overlay' } },
      ],
    })
  },

  removeSection(index) {
    const s = get()
    if (s.cabinet.sections.length <= 1) return
    get().edit('sections:remove', {
      sections: s.cabinet.sections.filter((_, i) => i !== index),
    })
  },

  undo() {
    const s = get()
    const previous = s.past[s.past.length - 1]
    if (!previous) return
    set({
      cabinet: previous,
      past: s.past.slice(0, -1),
      future: [s.cabinet, ...s.future],
      lastEditKey: null,
    })
  },

  redo() {
    const s = get()
    const next = s.future[0]
    if (!next) return
    set({
      cabinet: next,
      past: [...s.past, s.cabinet],
      future: s.future.slice(1),
      lastEditKey: null,
    })
  },

  reset() {
    const s = get()
    set({
      cabinet: defaultCabinet,
      templateId: defaultTemplateId,
      past: [...s.past, s.cabinet],
      future: [],
      lastEditKey: null,
    })
  },

  setExploded: (exploded) => set({ exploded }),
  setShowDimensions: (showDimensions) => set({ showDimensions }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setHovered: (hovered) => set({ hovered }),
}))
