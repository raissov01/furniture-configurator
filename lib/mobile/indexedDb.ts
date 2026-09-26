import { z } from 'zod'
import { parseProjectV4 } from '../../src/core/projectV4'
import type { ProjectFileV4 } from '../../src/core/projectV4'
import type { JsonValue, SyncRecord, SyncStore } from '../../src/core/sync/types'

const DB_VERSION = 1
const recordKey = z.string().trim().min(1)
type StoredRecord = { id: string; record: SyncRecord }
type StoredSurvey = { id: string; value: JsonValue }
type StoredProject = { id: string; value: ProjectFileV4 }
type StoredPhoto = { id: string; value: Blob }

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/** One browser database for durable config, survey, photos and idempotent actions. */
export class IndexedDbMobileStore implements SyncStore {
  private constructor(private readonly database: IDBDatabase) {
    database.onversionchange = () => database.close()
  }

  static async open(name = 'tapsyrys-mobile', factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IndexedDbMobileStore> {
    if (!factory) throw new Error('IndexedDB: браузер сақтау орны қолжетімсіз')
    const request = factory.open(name, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const store of ['actions', 'projects', 'surveys', 'photos']) {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onblocked = () => {
      // An older tab can close via onversionchange; the caller stays pending until it does.
    }
    return new IndexedDbMobileStore(await resultOf(request))
  }

  close(): void { this.database.close() }

  async get(id: string): Promise<SyncRecord | undefined> {
    const transaction = this.database.transaction('actions', 'readonly')
    const row = await resultOf(transaction.objectStore('actions').get(recordKey.parse(id)) as IDBRequest<StoredRecord | undefined>)
    return row?.record
  }

  async list(): Promise<SyncRecord[]> {
    const transaction = this.database.transaction('actions', 'readonly')
    const rows = await resultOf(transaction.objectStore('actions').getAll() as IDBRequest<StoredRecord[]>)
    return rows.map((row) => row.record)
  }

  /** IDB add has a unique key constraint, so two tabs cannot insert the same action twice. */
  async insert(record: SyncRecord): Promise<boolean> {
    const id = recordKey.parse(record.action.id)
    const transaction = this.database.transaction('actions', 'readwrite')
    const done = completed(transaction)
    const request = transaction.objectStore('actions').add({ id, record } satisfies StoredRecord)
    let inserted = true
    request.onerror = (event) => {
      if (request.error?.name === 'ConstraintError') {
        event.preventDefault()
        inserted = false
      }
    }
    await done
    return inserted
  }

  async update(record: SyncRecord): Promise<void> {
    const id = recordKey.parse(record.action.id)
    const transaction = this.database.transaction('actions', 'readwrite')
    const done = completed(transaction)
    const store = transaction.objectStore('actions')
    const existing = await resultOf(store.get(id) as IDBRequest<StoredRecord | undefined>)
    if (!existing) {
      transaction.abort()
      await done.catch((error: unknown) => {
        if (!(error instanceof Error)) throw error
      })
      throw new Error(`Sync action not found: ${id}`)
    }
    await Promise.all([resultOf(store.put({ id, record } satisfies StoredRecord)), done])
  }

  async putSurvey(id: string, value: JsonValue): Promise<void> {
    const key = recordKey.parse(id)
    if (!value || Array.isArray(value) || typeof value !== 'object' || value.id !== key) {
      throw new Error('survey.id: сақтау кілті мен өлшем ID-і бірдей болуы керек')
    }
    const transaction = this.database.transaction('surveys', 'readwrite')
    await Promise.all([
      resultOf(transaction.objectStore('surveys').put({ id: key, value } satisfies StoredSurvey)),
      completed(transaction),
    ])
  }

  async getSurvey(id: string): Promise<JsonValue | undefined> {
    const transaction = this.database.transaction('surveys', 'readonly')
    const row = await resultOf(transaction.objectStore('surveys').get(recordKey.parse(id)) as IDBRequest<StoredSurvey | undefined>)
    return row?.value
  }

  async listSurveys(): Promise<JsonValue[]> {
    const transaction = this.database.transaction('surveys', 'readonly')
    const rows = await resultOf(transaction.objectStore('surveys').getAll() as IDBRequest<StoredSurvey[]>)
    return rows.map((row) => row.value)
  }

  async putProject(id: string, raw: unknown): Promise<void> {
    const key = recordKey.parse(id)
    const value = parseProjectV4(raw)
    const transaction = this.database.transaction('projects', 'readwrite')
    await Promise.all([
      resultOf(transaction.objectStore('projects').put({ id: key, value } satisfies StoredProject)),
      completed(transaction),
    ])
  }

  async getProject(id: string): Promise<ProjectFileV4 | undefined> {
    const transaction = this.database.transaction('projects', 'readonly')
    const row = await resultOf(transaction.objectStore('projects').get(recordKey.parse(id)) as IDBRequest<StoredProject | undefined>)
    return row ? parseProjectV4(row.value) : undefined
  }

  async putPhoto(id: string, value: Blob): Promise<void> {
    const key = recordKey.parse(id)
    if (!(value instanceof Blob) || !value.type.startsWith('image/')) {
      throw new Error('photo: сурет файлы қажет')
    }
    const transaction = this.database.transaction('photos', 'readwrite')
    await Promise.all([
      resultOf(transaction.objectStore('photos').put({ id: key, value } satisfies StoredPhoto)),
      completed(transaction),
    ])
  }

  async getPhoto(id: string): Promise<Blob | undefined> {
    const transaction = this.database.transaction('photos', 'readonly')
    const row = await resultOf(transaction.objectStore('photos').get(recordKey.parse(id)) as IDBRequest<StoredPhoto | undefined>)
    return row?.value
  }
}
