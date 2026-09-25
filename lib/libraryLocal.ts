import { z } from 'zod'
import { ConfigValidationError } from '@/src/core/errors'
import { LibraryItemSchema, parseLibraryItem } from '@/src/core/library'
import type { LibraryItem } from '@/src/core/library'

export const LIBRARY_LOCAL_KEY = 'furniture-configurator:library-v1'
const LibraryFile = z.strictObject({ schemaVersion: z.literal(1), items: z.array(LibraryItemSchema) })

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function parseFile(json: string): LibraryItem[] {
  let value: unknown
  try { value = JSON.parse(json) as unknown }
  catch (error) { throw new ConfigValidationError('library.json', error instanceof Error ? error.message : 'JSON бұзылған') }
  const file = LibraryFile.parse(value)
  const ids = new Set<string>()
  for (const item of file.items) {
    parseLibraryItem(item)
    if (ids.has(item.id)) throw new ConfigValidationError('library.items.id', `id қайталанды: ${item.id}`)
    ids.add(item.id)
  }
  return file.items
}

export function exportLibraryJson(items: LibraryItem[]): string {
  const json = JSON.stringify({ schemaVersion: 1, items })
  parseFile(json)
  return json
}

export function importLibraryJson(json: string, existing: LibraryItem[]): LibraryItem[] {
  const imported = parseFile(json)
  const result = [...existing]
  for (const item of imported) {
    const old = result.find((entry) => entry.id === item.id)
    if (!old) result.push(item)
    else if (JSON.stringify(old) !== JSON.stringify(item)) {
      throw new ConfigValidationError('library.items.id', `id қақтығысы: ${item.id}`)
    }
  }
  return result
}

export function readLocalLibrary(storage: StorageLike): LibraryItem[] {
  const raw = storage.getItem(LIBRARY_LOCAL_KEY)
  return raw ? parseFile(raw) : []
}

export function writeLocalLibrary(storage: StorageLike, items: LibraryItem[]): void {
  storage.setItem(LIBRARY_LOCAL_KEY, exportLibraryJson(items))
}
