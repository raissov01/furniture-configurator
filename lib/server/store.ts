/**
 * Цехтың серверде сақталатын дерегі: профиль мен жобалар.
 *
 * Дерек ӘРҚАШАН цехқа байланады (`shop_id`), сондықтан бір цехтың жобасы
 * екіншісіне ешқашан көрінбейді: сұраныс сессиядан алынған shop_id-мен
 * шектеледі, клиенттен келген id-мен емес.
 */

import { randomUUID } from 'node:crypto'
import { db } from './db'
import { audit } from './observability'

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

export function writeShopProfile(shopId: string, profile: unknown, actorId?: string): void {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    database
      .prepare(`
        INSERT INTO shop_profiles (shop_id, json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT (shop_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at
      `)
      .run(shopId, JSON.stringify(profile), Date.now())
    audit({ shopId, actorId, action: 'profile_update', entityType: 'price', entityId: shopId })
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

export function listProjects(shopId: string): ProjectRow[] {
  const rows = db()
    .prepare('SELECT id, name, updated_at FROM projects WHERE shop_id = ? ORDER BY updated_at DESC, id DESC')
    .all(shopId) as { id: string; name: string; updated_at: number }[]
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }))
}

export function listProjectsPage(
  shopId: string, options: { limit: number; offset: number; query?: string },
): { projects: ProjectRow[]; total: number } {
  const query = options.query?.trim() ?? ''
  const escaped = query.replace(/[!%_]/g, (character) => `!${character}`)
  const filter = query ? " AND LOWER(name) LIKE LOWER(?) ESCAPE '!'" : ''
  const args = query ? [shopId, `%${escaped}%`] : [shopId]
  const database = db()
  const count = database.prepare(`SELECT COUNT(*) AS total FROM projects WHERE shop_id = ?${filter}`)
    .get(...args) as { total: number }
  const rows = database.prepare(`SELECT id, name, updated_at FROM projects WHERE shop_id = ?${filter}
    ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, options.limit, options.offset) as { id: string; name: string; updated_at: number }[]
  return { total: count.total, projects: rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at })) }
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

export function projectRevision(shopId: string, id: string): number | null {
  const row = db().prepare('SELECT updated_at FROM projects WHERE shop_id = ? AND id = ?')
    .get(shopId, id) as { updated_at: number } | undefined
  return row?.updated_at ?? null
}

/** Екі браузердегі бір жобаның ескі көшірмесі жаңасын баспасын. */
export function updateProject(
  shopId: string, id: string, name: string, project: unknown, baseRevision: number, actorId?: string,
): { kind: 'updated'; revision: number } | { kind: 'conflict'; revision: number } | { kind: 'missing' } {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const current = database.prepare('SELECT updated_at FROM projects WHERE shop_id = ? AND id = ?')
      .get(shopId, id) as { updated_at: number } | undefined
    if (!current) {
      database.exec('COMMIT')
      return { kind: 'missing' }
    }
    if (current.updated_at !== baseRevision) {
      database.exec('COMMIT')
      return { kind: 'conflict', revision: current.updated_at }
    }
    // Бір миллисекундтағы екі жазу да әртүрлі ревизия алуы тиіс.
    const revision = Math.max(Date.now(), current.updated_at + 1)
    database.prepare('UPDATE projects SET name = ?, json = ?, updated_at = ? WHERE shop_id = ? AND id = ?')
      .run(name.trim() || 'Проект', JSON.stringify(project), revision, shopId, id)
    if (actorId) audit({ shopId, actorId, action: 'update', entityType: 'project', entityId: id }, revision)
    database.exec('COMMIT')
    return { kind: 'updated', revision }
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

/** Жоба сақтау. `id` берілсе — жаңарту, әйтпесе жаңасы. */
export function writeProject(shopId: string, name: string, project: unknown, id?: string, actorId?: string): string {
  const projectId = id ?? randomUUID()
  const now = Date.now()
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const result = database
      .prepare(`
        INSERT INTO projects (id, shop_id, name, json, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name, json = excluded.json, updated_at = excluded.updated_at
        WHERE projects.shop_id = excluded.shop_id
      `)
      .run(projectId, shopId, name.trim() || 'Проект', JSON.stringify(project), now)
    if (result.changes) audit({ shopId, actorId, action: id ? 'update' : 'create', entityType: 'project', entityId: projectId }, now)
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
  return projectId
}

export function deleteProject(shopId: string, id: string, actorId?: string): void {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const result = database.prepare('DELETE FROM projects WHERE shop_id = ? AND id = ?').run(shopId, id)
    if (result.changes) audit({ shopId, actorId, action: 'delete', entityType: 'project', entityId: id })
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}
