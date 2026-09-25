/** Serializable action metadata. Large photos live in a separate local object store;
 * payload carries their local reference until an upload adapter sends them. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type Revision = { version: number; updatedAt: number }

export type SyncAction = {
  /** Stable client-generated idempotency key. The server must deduplicate by this id. */
  id: string
  kind: string
  entityId: string
  payload: JsonValue
  baseRevision: Revision
  createdAt: number
}

export type SyncConflict = { revision: Revision; serverValue: JsonValue }
export type SyncStatus = 'pending' | 'sent' | 'conflict' | 'rejected' | 'superseded'
export type SyncRecord = {
  action: SyncAction
  status: SyncStatus
  attempts: number
  nextAttemptAt: number
  /** Server acknowledgement is retained in the journal for audit and recovery. */
  acknowledgedRevision?: Revision
  conflict?: SyncConflict
  error?: string
}

/** The IndexedDB adapter must implement insert atomically with a unique id key. */
export interface SyncStore {
  get(id: string): Promise<SyncRecord | undefined>
  list(): Promise<SyncRecord[]>
  insert(record: SyncRecord): Promise<boolean>
  update(record: SyncRecord): Promise<void>
}

export type SendResult =
  | { kind: 'applied' | 'duplicate'; revision: Revision }
  | { kind: 'conflict'; revision: Revision; serverValue: JsonValue }
  | { kind: 'retry' }
  | { kind: 'rejected'; reason: string }

/** Transport must send action.id as the server idempotency key unchanged on retries. */
export interface SyncTransport {
  send(action: SyncAction): Promise<SendResult>
}

export type NetworkState = 'unknown' | 'offline' | 'online' | 'unreachable'

export function hasRevisionConflict(base: Revision, server: Revision): boolean {
  return base.version !== server.version || base.updatedAt !== server.updatedAt
}

export function validateAction(action: SyncAction): void {
  if (!action.id.trim() || !action.kind.trim() || !action.entityId.trim()) {
    throw new Error('Sync action id, kind and entityId are required')
  }
  for (const [name, value] of [
    ['baseRevision.version', action.baseRevision.version],
    ['baseRevision.updatedAt', action.baseRevision.updatedAt],
    ['createdAt', action.createdAt],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative integer`)
  }
  // JSON payloads can be persisted and compared after an interrupted send.
  if (action.payload === undefined || JSON.stringify(action.payload) === undefined) {
    throw new Error('Sync action payload must be JSON serializable')
  }
}
