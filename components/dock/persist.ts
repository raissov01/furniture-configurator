/**
 * Докинг күйін localStorage-те сақтау/оқу.
 *
 * ⚠ no silent catch: жеке терезе, толған квота немесе бұзылған/ескі JSON
 * жағдайында бұл модуль ЕШҚАШАН лақтырмайды — әдепкі күйге қайтады, бірақ
 * НЕГЕ қайтқанын әрқашан `console.warn`-мен логқа жазады. Тексеру
 * `tests/dockPersist.test.ts`-те.
 */
import { createDockState, isDockState, mergeWithDefaults } from './layout'
import type { DockState, PanelId } from './types'

const STORAGE_KEY = 'furniture-configurator:dock'

/** Сақтау пішінінің нұсқасы. Пішін өзгерсе өсіреміз — ескі жазба сол арқылы танылады. */
const SCHEMA_VERSION = 1

type PersistedEnvelope = { version: number; state: DockState }

function isServer(): boolean {
  return typeof window === 'undefined'
}

/** Сақталған докинг күйін оқиды; жоқ/бұзылған/ескі болса — әдепкіге түседі. */
export function loadDockState(panelIds: readonly PanelId[]): DockState {
  if (isServer()) return createDockState(panelIds)

  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[dock] localStorage оқылмады (жеке терезе/рұқсат жоқ), әдепкі орналасуға түсті:', err)
    return createDockState(panelIds)
  }

  if (!raw) return createDockState(panelIds)

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.warn('[dock] сақталған күй бұзылған JSON, әдепкіге қайтады:', err)
    return createDockState(panelIds)
  }

  if (!parsed || typeof parsed !== 'object') {
    console.warn('[dock] сақталған күй объект емес, әдепкіге қайтады. Алынған мән:', parsed)
    return createDockState(panelIds)
  }

  const envelope = parsed as Partial<PersistedEnvelope>
  if (envelope.version !== SCHEMA_VERSION) {
    console.warn(
      `[dock] сақталған күйдің схема нұсқасы сәйкес емес (күтілді ${SCHEMA_VERSION}, келді ${String(envelope.version)}), әдепкіге қайтады.`,
    )
    return createDockState(panelIds)
  }

  if (!isDockState(envelope.state)) {
    console.warn('[dock] сақталған күй DockState пішініне сай емес, әдепкіге қайтады. Алынған мән:', envelope.state)
    return createDockState(panelIds)
  }

  return mergeWithDefaults(envelope.state, panelIds)
}

/** Докинг күйін localStorage-ке жазады. Сәтсіз болса (квота, жеке терезе) — логқа жазып жалғастырады. */
export function saveDockState(state: DockState): void {
  if (isServer()) return
  try {
    const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch (err) {
    console.warn('[dock] localStorage-ке жазылмады (квота толған/жеке терезе):', err)
  }
}

export { STORAGE_KEY as DOCK_STORAGE_KEY, SCHEMA_VERSION as DOCK_SCHEMA_VERSION }
