import type { MeasurementSurvey } from '@/src/core/measure'
import { createMeasurementSyncAction } from '@/src/core/measure'
import { SyncQueue } from '@/src/core/sync/queue'
import type { JsonValue, Revision, SyncRecord, SyncStore } from '@/src/core/sync/types'

/**
 * Сервердегі соңғы белгілі күй: жіберілген әрекет не «серверлікін қалдыру» арқылы
 * жабылған қайшылық. Екіншісін ескермесек, сервер мәні ескі нұсқамен қайта
 * жіберіліп, қайшылық шексіз қайталанады.
 */
function latestServerState(records: SyncRecord[], surveyId: string): { payload: JsonValue; revision: Revision } | undefined {
  const known = records
    .filter((record) => record.action.kind === 'measurement.upsert' && record.action.entityId === surveyId)
    .sort((a, b) => b.action.createdAt - a.action.createdAt || b.action.id.localeCompare(a.action.id))
  for (const record of known) {
    if (record.status === 'sent' && record.acknowledgedRevision) {
      return { payload: record.action.payload, revision: record.acknowledgedRevision }
    }
    if (record.status === 'superseded' && record.conflict) {
      return { payload: record.conflict.serverValue, revision: record.conflict.revision }
    }
  }
  return undefined
}

export type EnqueueResult = 'queued' | 'pending' | 'conflict' | 'rejected' | 'unchanged'

/** Keep a single in-flight revision per survey. The latest local draft stays in IndexedDB. */
export async function enqueueLatestMeasurement(
  survey: MeasurementSurvey, store: SyncStore, queue: SyncQueue,
  now: number, actionId: string,
): Promise<EnqueueResult> {
  const records = (await store.list())
    .filter((record) => record.action.kind === 'measurement.upsert' && record.action.entityId === survey.id)
    .sort((a, b) => b.action.createdAt - a.action.createdAt || b.action.id.localeCompare(a.action.id))
  if (records.some((record) => record.status === 'conflict')) return 'conflict'
  if (records.some((record) => record.status === 'rejected')) return 'rejected'
  if (records.some((record) => record.status === 'pending')) return 'pending'
  const server = latestServerState(records, survey.id)
  if (server && JSON.stringify(server.payload) === JSON.stringify(survey)) return 'unchanged'
  const base = server?.revision ?? { version: 0, updatedAt: 0 }
  await queue.enqueue(createMeasurementSyncAction(survey, actionId, base, now))
  return 'queued'
}

/** Preserve the unresolved conflict if the replacement cannot be queued. */
export async function keepLocalMeasurement(
  survey: MeasurementSurvey, record: SyncRecord, store: SyncStore, queue: SyncQueue,
  now: number, actionId: string,
): Promise<void> {
  if (record.status !== 'conflict' || !record.conflict) throw new Error('Өлшеу қайшылығы табылмады')
  await queue.enqueue(createMeasurementSyncAction(survey, actionId, record.conflict.revision, now))
  await store.update({ ...record, status: 'superseded' })
}

/** Rejected actions require an explicit user retry after the cause is fixed. */
export async function retryRejectedMeasurement(
  survey: MeasurementSurvey, record: SyncRecord, store: SyncStore, queue: SyncQueue,
  now: number, actionId: string,
): Promise<void> {
  if (record.status !== 'rejected') throw new Error('Қайта жіберілетін өлшеу табылмады')
  const server = latestServerState(await store.list(), survey.id)
  await queue.enqueue(createMeasurementSyncAction(survey, actionId,
    server?.revision ?? { version: 0, updatedAt: 0 }, now))
  await store.update({ ...record, status: 'superseded' })
}

export function retryDelay(nextAttemptAt: number | undefined, now: number, online: boolean): number | undefined {
  if (!online || nextAttemptAt === undefined) return undefined
  return Math.max(1000, nextAttemptAt - now)
}
