import type { MeasurementSurvey } from '@/src/core/measure'
import type { SyncQueue } from '@/src/core/sync/queue'
import type { JsonValue, SyncRecord, SyncStore } from '@/src/core/sync/types'
import { enqueueLatestMeasurement, type EnqueueResult } from './measurementSync'

/**
 * Гибрид қосымшаның офлайн → онлайн тапсыруы (docs/mobile/hybrid.md).
 *
 * Офлайн бет пен толық `/mobile` бір origin-де, бір IndexedDB (`tapsyrys-mobile`)
 * мен бір `SyncQueue` журналын ортақ пайдаланады. Офлайн бет тек кезекке ҚОЯДЫ
 * (жібермейді); жіберетін — кірген пайдаланушының `/mobile` беті.
 */

/** Серверлік 401 себебі (`lib/mobile/syncTransport.ts` пен API маршруттары қайтарады). */
export const AUTH_REQUIRED_REASON = 'Кіру қажет'

type SurveyStore = SyncStore & { putSurvey(id: string, value: JsonValue): Promise<void> }

/**
 * Офлайн сақтау: алдымен черновик, сосын идемпотентті әрекет журналға.
 * Кезектің `network` күйі 'online' болмағандықтан `enqueue` желіге шықпайды.
 */
export async function saveOfflineMeasurement(
  survey: MeasurementSurvey, store: SurveyStore, queue: SyncQueue, now: number, actionId: string,
): Promise<EnqueueResult> {
  await store.putSurvey(survey.id, survey as unknown as JsonValue)
  return enqueueLatestMeasurement(survey, store, queue, now, actionId)
}

export type SurveySyncState = 'local' | 'pending' | 'sent' | 'conflict' | 'rejected'

const measurement = (record: SyncRecord) => record.action.kind === 'measurement.upsert'

/** Әр өлшемнің көрсетілетін күйі: шешілмеген мәселе жіберілгеннен маңызды. */
export function surveySyncState(records: SyncRecord[], surveyId: string): SurveySyncState {
  const own = records.filter((record) => measurement(record) && record.action.entityId === surveyId)
  for (const status of ['conflict', 'rejected', 'pending', 'sent'] as const) {
    if (own.some((record) => record.status === status)) return status
  }
  return 'local'
}

export function pendingMeasurementCount(records: SyncRecord[]): number {
  return records.filter((record) => measurement(record) && record.status === 'pending').length
}

/**
 * Кірмей тұрып жіберілген (401) өлшемдер: пайдаланушы кіргеннен кейін қайта
 * жіберіледі. Әр өлшемнен біреуі ғана (ең соңғысы), рөл өлшем жіберуге рұқсатты болса.
 */
export function authRetryCandidates(records: SyncRecord[], role: string | null): SyncRecord[] {
  if (role !== 'owner' && role !== 'designer') return []
  const latest = new Map<string, SyncRecord>()
  for (const record of records) {
    if (!measurement(record) || record.status !== 'rejected' || record.error !== AUTH_REQUIRED_REASON) continue
    const seen = latest.get(record.action.entityId)
    if (!seen || record.action.createdAt > seen.action.createdAt) latest.set(record.action.entityId, record)
  }
  return [...latest.values()].sort((a, b) => a.action.createdAt - b.action.createdAt)
}

/** Автоматты өтуден кейін осы уақыт ішінде қайта өтпейміз (сервер 5xx берсе цикл болмасын). */
export const AUTO_OPEN_COOLDOWN_MS = 60_000

/**
 * Офлайн беттен толық нұсқаға қашан өтеміз: сервер жауап берсе, пайдаланушы
 * өлшеу шеберінің ішінде болмаса (толтырып жатқан экранды үзбейміз) және жақында
 * өтіп көрмесек (сервер /mobile-ге қате берсе, errorPath қайта осында әкеледі).
 */
export function offlineShellNext(state: {
  browserOnline: boolean; serverReachable: boolean; editing: boolean; lastAutoOpenAt: number | null; now: number
}): 'stay' | 'open-online' {
  if (!state.browserOnline || !state.serverReachable || state.editing) return 'stay'
  if (state.lastAutoOpenAt !== null && state.now - state.lastAutoOpenAt < AUTO_OPEN_COOLDOWN_MS) return 'stay'
  return 'open-online'
}
