import { db } from './db'
import { parseLibraryItem } from '@/src/core/library'
import type { LibraryItem } from '@/src/core/library'

export function listLibraryItems(userId: string): LibraryItem[] {
  const rows = db().prepare('SELECT json FROM library_items WHERE user_id = ? ORDER BY updated_at DESC, id')
    .all(userId) as { json: string }[]
  return rows.map((row) => parseLibraryItem(JSON.parse(row.json) as unknown))
}

export function writeLibraryItem(userId: string, item: LibraryItem): void {
  db().prepare(`INSERT INTO library_items (user_id, id, json, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`)
    .run(userId, item.id, JSON.stringify(item), Date.now())
}

export function deleteLibraryItem(userId: string, id: string): boolean {
  return Number(db().prepare('DELETE FROM library_items WHERE user_id = ? AND id = ?').run(userId, id).changes) > 0
}
