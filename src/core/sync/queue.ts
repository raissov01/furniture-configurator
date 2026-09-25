import type { JsonValue, NetworkState, SyncAction, SyncRecord, SyncStore, SyncTransport } from './types'
import { validateAction } from './types'

/** One second, doubled per failed send, capped at one minute. */
export function backoffMs(attempts: number): number {
  if (!Number.isSafeInteger(attempts) || attempts < 1) throw new Error('attempts must be a positive integer')
  return Math.min(60_000, 1000 * 2 ** Math.min(attempts - 1, 6))
}

export type ConflictChoice = { kind: 'keepServer' } | { kind: 'keepLocal'; newId: string }

/** Durable action journal. The caller supplies time, connectivity and a transport. */
export class SyncQueue {
  network: NetworkState = 'unknown'
  private running: Promise<void> | undefined

  constructor(private readonly store: SyncStore, private readonly transport: SyncTransport) {}

  async enqueue(action: SyncAction): Promise<SyncRecord> {
    validateAction(action)
    const record: SyncRecord = { action, status: 'pending', attempts: 0, nextAttemptAt: action.createdAt }
    if (await this.store.insert(record)) {
      if (this.network === 'online') await this.flush(action.createdAt)
      return (await this.store.get(action.id)) ?? record
    }
    const existing = await this.store.get(action.id)
    if (!existing || JSON.stringify(existing.action) !== JSON.stringify(action)) {
      throw new Error(`Sync action id already belongs to another action: ${action.id}`)
    }
    return existing
  }

  /** Calling this on a reconnect immediately sends due work without a browser timer. */
  async setOnline(online: boolean, now: number): Promise<void> {
    const wasDisconnected = this.network === 'offline' || this.network === 'unreachable'
    this.network = online ? 'online' : 'offline'
    if (!online) return
    if (wasDisconnected) {
      for (const record of await this.store.list()) {
        if (record.status === 'pending' && record.nextAttemptAt > now) {
          await this.store.update({ ...record, nextAttemptAt: now })
        }
      }
    }
    await this.flush(now)
  }

  /** Caller should schedule a timer for this timestamp while online. */
  async nextRetryAt(): Promise<number | undefined> {
    const pending = (await this.store.list()).filter((record) => record.status === 'pending')
    return pending.length ? Math.min(...pending.map((record) => record.nextAttemptAt)) : undefined
  }

  async flush(now: number): Promise<void> {
    if (this.network !== 'online') return
    if (this.running) {
      await this.running
      // A new action may have arrived after the running pass took its snapshot.
      return this.flush(now)
    }
    this.running = this.flushOnce(now)
    try { await this.running } finally { this.running = undefined }
  }

  private async flushOnce(now: number): Promise<void> {
    const records = (await this.store.list())
      .filter((record) => record.status === 'pending' && record.nextAttemptAt <= now)
      .sort((a, b) => a.action.createdAt - b.action.createdAt || a.action.id.localeCompare(b.action.id))
    for (const record of records) {
      if (this.network !== 'online') break
      let result: Awaited<ReturnType<SyncTransport['send']>>
      try {
        result = await this.transport.send(record.action)
      } catch (error) {
        await this.retry(record, now)
        this.network = 'unreachable'
        // The exception is transport failure; leave the action durable for reconnect.
        if (!(error instanceof Error)) throw error
        break
      }
      if (result.kind === 'applied' || result.kind === 'duplicate') {
        await this.store.update({ ...record, status: 'sent', attempts: record.attempts + 1, acknowledgedRevision: result.revision })
      } else if (result.kind === 'conflict') {
        await this.store.update({ ...record, status: 'conflict', attempts: record.attempts + 1,
          conflict: { revision: result.revision, serverValue: result.serverValue } })
      } else if (result.kind === 'rejected') {
        await this.store.update({ ...record, status: 'rejected', attempts: record.attempts + 1, error: result.reason })
      } else {
        await this.retry(record, now)
        break
      }
    }
  }

  private async retry(record: SyncRecord, now: number): Promise<void> {
    const attempts = record.attempts + 1
    await this.store.update({ ...record, attempts, nextAttemptAt: now + backoffMs(attempts) })
  }

  async resolveConflict(id: string, choice: ConflictChoice, now: number): Promise<JsonValue | undefined> {
    const record = await this.store.get(id)
    if (!record || record.status !== 'conflict' || !record.conflict) throw new Error(`No unresolved conflict for id: ${id}`)
    if (choice.kind === 'keepServer') {
      await this.store.update({ ...record, status: 'superseded' })
      return record.conflict.serverValue
    }
    if (choice.newId === id) throw new Error('Conflict retry needs a new idempotency id')
    const next: SyncAction = { ...record.action, id: choice.newId, baseRevision: record.conflict.revision, createdAt: now }
    await this.enqueue(next)
    await this.store.update({ ...record, status: 'superseded' })
    return undefined
  }
}
