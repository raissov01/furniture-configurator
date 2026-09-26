import { z } from 'zod'
import { MeasurementSurveySchema } from '../../src/core/measure'
import type { JsonValue, Revision, SendResult, SyncAction, SyncTransport } from '../../src/core/sync/types'
import type { IndexedDbMobileStore } from './indexedDb'

const revisionSchema = z.object({ version: z.number().int().safe().nonnegative(), updatedAt: z.number().int().safe().nonnegative() }).strict()
const replySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['applied', 'duplicate']), revision: revisionSchema }).strict(),
  z.object({ kind: z.literal('conflict'), revision: revisionSchema, serverValue: z.unknown() }).strict(),
])
const photoReplySchema = z.object({ kind: z.enum(['applied', 'duplicate']) }).strict()

function onlineFailure(status: number): SendResult {
  if (status >= 500 || status === 429) return { kind: 'retry' }
  if (status === 401) return { kind: 'rejected', reason: 'Кіру қажет' }
  if (status === 403) return { kind: 'rejected', reason: 'Рұқсат жоқ' }
  return { kind: 'rejected', reason: `Сервер қабылдамады (${status})` }
}

async function readReply(response: Response): Promise<SendResult> {
  if (!response.ok && response.status !== 409) return onlineFailure(response.status)
  const parsed = replySchema.safeParse(await response.json() as unknown)
  if (!parsed.success) return { kind: 'retry' }
  if (response.status === 409 && parsed.data.kind !== 'conflict') return { kind: 'retry' }
  if (parsed.data.kind === 'conflict') {
    return { kind: 'conflict', revision: parsed.data.revision as Revision, serverValue: parsed.data.serverValue as JsonValue }
  }
  return { kind: parsed.data.kind, revision: parsed.data.revision }
}

/** Upload referenced Blob bytes before the immutable JSON action; both endpoints dedupe by ID. */
export function createMobileSyncTransport(store: IndexedDbMobileStore, fetcher: typeof fetch = globalThis.fetch): SyncTransport {
  return {
    async send(action: SyncAction): Promise<SendResult> {
      if (action.kind === 'measurement.upsert') {
        const result = MeasurementSurveySchema.safeParse(action.payload)
        if (!result.success) return { kind: 'rejected', reason: 'Өлшем пішімі қате' }
        const refs = new Set<string>()
        for (const wall of Object.values(result.data.walls)) {
          for (const answer of Object.values(wall.obstacles)) {
            if (answer.photoRef?.trim()) refs.add(answer.photoRef)
          }
        }
        for (const ref of refs) {
          const photo = await store.getPhoto(ref)
          if (!photo) return { kind: 'rejected', reason: `photoRef: ${ref} жергілікті фото табылмады` }
          const upload = await fetcher(`/api/mobile/photos/${encodeURIComponent(ref)}`, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': photo.type }, body: photo,
          })
          if (!upload.ok) return onlineFailure(upload.status)
          if (!photoReplySchema.safeParse(await upload.json() as unknown).success) return { kind: 'retry' }
        }
        const response = await fetcher('/api/mobile/measure/sync', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action),
        })
        return readReply(response)
      }
      if (action.kind.startsWith('installation.')) {
        const response = await fetcher('/api/installation/sync', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action),
        })
        return readReply(response)
      }
      return { kind: 'rejected', reason: `Әрекет түріне сервер жолы жоқ: ${action.kind}` }
    },
  }
}
