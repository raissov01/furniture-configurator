import type { MeasurementSurvey } from '@/src/core/measure'
import { createMeasurementSyncAction } from '@/src/core/measure'
import { SyncQueue } from '@/src/core/sync/queue'
import type { SyncRecord, SyncStore } from '@/src/core/sync/types'

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
  const latestSent = records.find((record) => record.status === 'sent')
  if (latestSent && JSON.stringify(latestSent.action.payload) === JSON.stringify(survey)) return 'unchanged'
  const base = latestSent?.acknowledgedRevision ?? { version: 0, updatedAt: 0 }
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
  const sent = (await store.list())
    .filter((item) => item.action.entityId === survey.id && item.status === 'sent')
    .sort((a, b) => b.action.createdAt - a.action.createdAt)[0]
  await queue.enqueue(createMeasurementSyncAction(survey, actionId,
    sent?.acknowledgedRevision ?? { version: 0, updatedAt: 0 }, now))
  await store.update({ ...record, status: 'superseded' })
}

export function retryDelay(nextAttemptAt: number | undefined, now: number, online: boolean): number | undefined {
  if (!online || nextAttemptAt === undefined) return undefined
  return Math.max(1000, nextAttemptAt - now)
}
