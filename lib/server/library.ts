import { db } from './db'
import { parseLibraryItem } from '@/src/core/library'
import type { LibraryItem } from '@/src/core/library'

export const MAX_LIBRARY_ITEMS = 200

export class LibraryLimitError extends Error {}

export function listLibraryItems(userId: string): { items: LibraryItem[]; skipped: number } {
  const rows = db().prepare('SELECT id, json FROM library_items WHERE user_id = ? ORDER BY updated_at DESC, id')
    .all(userId) as { id: string; json: string }[]
  const items: LibraryItem[] = []
  let skipped = 0
  for (const row of rows) {
    try { items.push(parseLibraryItem(JSON.parse(row.json) as unknown)) }
    catch (cause) {
      skipped += 1
      console.warn(`library item ${row.id} skipped for user ${userId}:`, cause)
    }
  }
  return { items, skipped }
}

export function writeLibraryItem(userId: string, item: LibraryItem): void {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const existing = database.prepare('SELECT 1 FROM library_items WHERE user_id = ? AND id = ?')
      .get(userId, item.id)
    if (!existing) {
      const row = database.prepare('SELECT COUNT(*) AS count FROM library_items WHERE user_id = ?')
        .get(userId) as { count: number }
      if (row.count >= MAX_LIBRARY_ITEMS) throw new LibraryLimitError(`Кітапхана шегі: ${MAX_LIBRARY_ITEMS} элемент`)
    }
    database.prepare(`INSERT INTO library_items (user_id, id, json, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`)
      .run(userId, item.id, JSON.stringify(item), Date.now())
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

export function deleteLibraryItem(userId: string, id: string): boolean {
  return Number(db().prepare('DELETE FROM library_items WHERE user_id = ? AND id = ?').run(userId, id).changes) > 0
}
