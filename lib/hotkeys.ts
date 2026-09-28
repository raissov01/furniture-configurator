'use client'

/**
 * Хоткейлер. Тізім де, өңдеуші де — ОСЫ ЖЕРДЕ, бір көзде.
 *
 * Анықтама терезесі осы тізімнен құрылады, сондықтан «құжатта бар, ал
 * шындықта жоқ» деген перне пайда болмайды.
 *
 * Ереже: өріске мәтін теріп жатқанда хоткей ЖҮРМЕЙДІ — әйтпесе шкафтың
 * атына «3» деп жазсаң, камера пресеті ауысып кетеді.
 */

import type { CameraPreset } from '@/store/configurator'

export type HotkeyAction =
  | { kind: 'preset'; preset: CameraPreset }
  | { kind: 'fit' }
  | { kind: 'viewMode' }
  | { kind: 'xray' }
  | { kind: 'fronts' }
  | { kind: 'openness' }
  | { kind: 'projection' }
  | { kind: 'dimensions' }
  | { kind: 'help' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'delete' }
  | { kind: 'newCabinet' }
  | { kind: 'openProject' }
  | { kind: 'saveProject' }
  | { kind: 'printProject' }

export type Hotkey = {
  /** Анықтамада көрінетін жазу. */
  keys: string
  /** `event.key` (кіші әріппен) — бірнешеуі болуы мүмкін. */
  match: string[]
  /** Ctrl/Cmd басулы болуы керек пе. */
  ctrl?: boolean
  shift?: boolean
  description: string
  action: HotkeyAction
}

export const HOTKEYS: Hotkey[] = [
  { keys: 'Ctrl+N', match: ['n'], ctrl: true, description: 'Новый корпус', action: { kind: 'newCabinet' } },
  { keys: 'Ctrl+O', match: ['o'], ctrl: true, description: 'Открыть проект', action: { kind: 'openProject' } },
  { keys: 'Ctrl+S', match: ['s'], ctrl: true, description: 'Сохранить проект', action: { kind: 'saveProject' } },
  { keys: 'Ctrl+P', match: ['p'], ctrl: true, description: 'PDF — весь проект', action: { kind: 'printProject' } },
  { keys: '1', match: ['1'], description: 'Вид: фас', action: { kind: 'preset', preset: 'front' } },
  { keys: '2', match: ['2'], description: 'Вид: 3/4', action: { kind: 'preset', preset: 'three-quarter' } },
  { keys: '3', match: ['3'], description: 'Вид: внутри', action: { kind: 'preset', preset: 'inside' } },
  { keys: '4', match: ['4'], description: 'Вид: план', action: { kind: 'preset', preset: 'plan' } },
  { keys: '5', match: ['5'], description: 'Вид: комната', action: { kind: 'preset', preset: 'room' } },
  { keys: 'F', match: ['f'], description: 'Вписать в кадр', action: { kind: 'fit' } },
  { keys: 'T', match: ['t'], description: 'Прозрачность: тело → полупрозрачно → контур', action: { kind: 'viewMode' } },
  { keys: 'X', match: ['x'], description: 'Присадка (рентген)', action: { kind: 'xray' } },
  { keys: 'H', match: ['h'], description: 'Показать или скрыть фасады', action: { kind: 'fronts' } },
  { keys: 'E', match: ['e'], description: 'Открыть или закрыть двери и ящики', action: { kind: 'openness' } },
  { keys: 'O', match: ['o'], description: 'Проекция: перспектива ↔ ортогональная', action: { kind: 'projection' } },
  { keys: 'D', match: ['d'], description: 'Размеры на сцене', action: { kind: 'dimensions' } },
  { keys: '?', match: ['?', '/'], description: 'Эта справка', action: { kind: 'help' } },
  { keys: 'Ctrl+Z', match: ['z'], ctrl: true, description: 'Отменить', action: { kind: 'undo' } },
  { keys: 'Ctrl+Shift+Z', match: ['z'], ctrl: true, shift: true, description: 'Повторить', action: { kind: 'redo' } },
  { keys: 'Ctrl+Y', match: ['y'], ctrl: true, shift: false, description: 'Повторить', action: { kind: 'redo' } },
  { keys: 'Delete', match: ['delete'], description: 'Удалить выбранный объект', action: { kind: 'delete' } },
]

export function classicFileHint(kind: 'newCabinet' | 'openProject' | 'saveProject' | 'printProject'): string {
  const keys = HOTKEYS.find((hotkey) => hotkey.action.kind === kind && hotkey.ctrl)?.keys
  if (!keys) throw new Error(`Missing classic file shortcut: ${kind}`)
  return keys
}

/** Мәтін теріліп жатыр ма: сонда хоткейлер ұйықтайды. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Оқиғаға сәйкес хоткейді табу. Ретте ең НАҚТЫСЫ бірінші тұрады. */
export function matchHotkey(event: KeyboardEvent): Hotkey | undefined {
  const key = event.key.toLowerCase()
  const ctrl = event.ctrlKey || event.metaKey
  // Shift талап ететіні бұрын тексерілуі керек: Ctrl+Shift+Z — Ctrl+Z емес.
  const ordered = [...HOTKEYS].sort((a, b) => Number(b.shift ?? false) - Number(a.shift ?? false))
  return ordered.find((h) =>
    h.match.includes(key)
    && Boolean(h.ctrl) === ctrl
    && (h.shift === undefined ? true : h.shift === event.shiftKey),
  )
}
