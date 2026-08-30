/**
 * Цехтың серверде сақталатын дерегі: профиль мен жобалар.
 *
 * Дерек ӘРҚАШАН цехқа байланады (`shop_id`), сондықтан бір цехтың жобасы
 * екіншісіне ешқашан көрінбейді: сұраныс сессиядан алынған shop_id-мен
 * шектеледі, клиенттен келген id-мен емес.
 */

import { randomUUID } from 'node:crypto'
import { db } from './db'

export type ProjectRow = { id: string; name: string; updatedAt: number }

export function readShopProfile(shopId: string): unknown | null {
  const row = db().prepare('SELECT json FROM shop_profiles WHERE shop_id = ?').get(shopId) as
    | { json: string }
    | undefined
  if (!row) return null
  try {
    return JSON.parse(row.json)
  } catch {
    return null
  }
}

export function writeShopProfile(shopId: string, profile: unknown): void {
  db()
    .prepare(`
      INSERT INTO shop_profiles (shop_id, json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT (shop_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
    `)
    .run(shopId, JSON.stringify(profile), Date.now())
}

export function listProjects(shopId: string): ProjectRow[] {
  const rows = db()
    .prepare('SELECT id, name, updated_at FROM projects WHERE shop_id = ? ORDER BY updated_at DESC LIMIT 100')
    .all(shopId) as { id: string; name: string; updated_at: number }[]
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }))
}

export function readProject(shopId: string, id: string): unknown | null {
  const row = db().prepare('SELECT json FROM projects WHERE shop_id = ? AND id = ?').get(shopId, id) as
    | { json: string }
    | undefined
  if (!row) return null
  try {
    return JSON.parse(row.json)
  } catch {
    return null
  }
}

/** Жоба сақтау. `id` берілсе — жаңарту, әйтпесе жаңасы. */
export function writeProject(shopId: string, name: string, project: unknown, id?: string): string {
  const projectId = id ?? randomUUID()
  const now = Date.now()
  db()
    .prepare(`
      INSERT INTO projects (id, shop_id, name, json, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name, json = excluded.json, updated_at = excluded.updated_at
      WHERE projects.shop_id = excluded.shop_id
    `)
    .run(projectId, shopId, name.trim() || 'Проект', JSON.stringify(project), now)
  return projectId
}

export function deleteProject(shopId: string, id: string): void {
  db().prepare('DELETE FROM projects WHERE shop_id = ? AND id = ?').run(shopId, id)
}
