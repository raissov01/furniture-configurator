'use client'

/**
 * Классикалық (PRO100) жұмыс орнының КӨРІНІС күйі: терезелердің ашықтығы,
 * «Реалистичный вид», «Свет» баптаулары және Структурадағы көптік таңдау.
 *
 * Жоба деректері емес — undo/redo тарихына, жоба файлына кірмейді. Баптаулар
 * браузерде сақталады (тема мен 3D сапасы сияқты адамның өз ыңғайы).
 */

import { create } from 'zustand'
import { DEFAULT_LIGHTING, parseLighting, type ClassicLighting, type LightingKey } from '@/lib/classicLighting'

const REALISTIC_KEY = 'furniture-configurator:classic-realistic'
const LIGHTING_KEY = 'furniture-configurator:classic-lighting'
const LIBRARY_KEY = 'furniture-configurator:classic-library-open'

function save(key: string, value: string) {
  try { window.localStorage.setItem(key, value) }
  catch (cause) { console.debug('Classic view preference not stored', cause) }
}

function load(key: string): string | null {
  try { return window.localStorage.getItem(key) }
  catch { return null }
}

export type ClassicViewState = {
  /** Бөлмеге материал берілмесе де шынайы (текстура, көлеңке) көрініс. */
  realisticView: boolean
  lighting: ClassicLighting
  libraryOpen: boolean
  roomDialogOpen: boolean
  lightDialogOpen: boolean
  reportsOpen: boolean
  /** «Начало работы»: Свойства помещения → Библиотека → модуль қою. */
  startGuideOpen: boolean
  /** Структура терезесіндегі көптік таңдау: туралау/тарату/топтау батырмалары соны алады. */
  treeSelection: string[]
  hydrate(): void
  setRealisticView(on: boolean): void
  setLightingChannel(key: LightingKey, patch: Partial<ClassicLighting[LightingKey]>): void
  resetLighting(): void
  setLibraryOpen(open: boolean): void
  setRoomDialogOpen(open: boolean): void
  setLightDialogOpen(open: boolean): void
  setReportsOpen(open: boolean): void
  setStartGuideOpen(open: boolean): void
  setTreeSelection(ids: string[]): void
}

export const useClassicView = create<ClassicViewState>((set, get) => ({
  realisticView: false,
  lighting: DEFAULT_LIGHTING,
  libraryOpen: false,
  roomDialogOpen: false,
  lightDialogOpen: false,
  reportsOpen: false,
  startGuideOpen: false,
  treeSelection: [],
  hydrate() {
    set({
      realisticView: load(REALISTIC_KEY) === '1',
      lighting: parseLighting(load(LIGHTING_KEY)),
      libraryOpen: load(LIBRARY_KEY) === '1',
    })
  },
  setRealisticView(on) {
    save(REALISTIC_KEY, on ? '1' : '0')
    set({ realisticView: on })
  },
  setLightingChannel(key, patch) {
    const lighting = { ...get().lighting, [key]: { ...get().lighting[key], ...patch } }
    save(LIGHTING_KEY, JSON.stringify(lighting))
    set({ lighting })
  },
  resetLighting() {
    save(LIGHTING_KEY, JSON.stringify(DEFAULT_LIGHTING))
    set({ lighting: DEFAULT_LIGHTING })
  },
  setLibraryOpen(open) {
    save(LIBRARY_KEY, open ? '1' : '0')
    set({ libraryOpen: open })
  },
  setRoomDialogOpen: (roomDialogOpen) => set({ roomDialogOpen }),
  setLightDialogOpen: (lightDialogOpen) => set({ lightDialogOpen }),
  setReportsOpen: (reportsOpen) => set({ reportsOpen }),
  setStartGuideOpen: (startGuideOpen) => set({ startGuideOpen }),
  setTreeSelection(ids) {
    const current = get().treeSelection
    if (current.length === ids.length && current.every((id, index) => id === ids[index])) return
    set({ treeSelection: ids })
  },
}))

/**
 * Сахна қай стильде салынады. Бос бөлме (отделка берілмеген) — PRO100-дегідей
 * ақ фон мен жіңішке тор; отделка берілсе не «Реалистичный вид» қосулы болса —
 * текстура мен жұмсақ көлеңкесі бар шынайы бөлме.
 */
export function classicSceneLook(classic: boolean, roomHasFinish: boolean, realisticView: boolean): 'schematic' | 'realistic' {
  return classic && !roomHasFinish && !realisticView ? 'schematic' : 'realistic'
}
