import type { SyncRecord, SyncStore } from './types'

/** Test and non-browser adapter. Returns copies, as IndexedDB structured clone does. */
export class MemorySyncStore implements SyncStore {
  private readonly records = new Map<string, SyncRecord>()

  async get(id: string): Promise<SyncRecord | undefined> {
    const record = this.records.get(id)
    return record === undefined ? undefined : structuredClone(record)
  }

  async list(): Promise<SyncRecord[]> {
    return [...this.records.values()].map((record) => structuredClone(record))
  }

  async insert(record: SyncRecord): Promise<boolean> {
    const id = record.action.id
    if (this.records.has(id)) return false
    this.records.set(id, structuredClone(record))
    return true
  }

  async update(record: SyncRecord): Promise<void> {
    const id = record.action.id
    if (!this.records.has(id)) throw new Error(`Unknown sync action id: ${id}`)
    this.records.set(id, structuredClone(record))
  }
}
