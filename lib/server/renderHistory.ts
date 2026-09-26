/**
 * ЖИ-рендер тарихы: әр пайдаланушының әр жобасы бойынша соңғы рендерлер.
 *
 * ОҚШАУЛАУ: әр сұрау `user_id` ЖӘНЕ `shop_id` бойынша сүзіледі. Басқа адам
 * жазбаның id-ін білсе де, оны оқи да, өшіре де алмайды (404).
 * Көлем: бір жобада ең көбі `MAX_RENDER_HISTORY` жазба, ескілері өшеді —
 * сурет байттары базаны шексіз өсірмеуі керек.
 */

import { randomUUID } from 'node:crypto'
import { db } from './db'
import type { RenderAspect, RenderReferenceMode, RenderStyle } from '@/src/core/render/prompt'
import type { RenderCost, RenderUsage } from '@/src/core/render/cost'

export const MAX_RENDER_HISTORY = 30

export type RenderHistoryMeta = {
  aspect: RenderAspect
  referenceMode: RenderReferenceMode
  style: RenderStyle | null
  hint: string | null
  model: string
  promptVersion: number
  size: string
  crop: { x: number; y: number; width: number; height: number }
  usage: RenderUsage | null
  cost: RenderCost | null
}

export type RenderHistoryRecord = RenderHistoryMeta & {
  id: string
  projectId: string
  createdAt: number
  /** Суретті алу: GET /api/render/history/<id> */
  imageUrl: string
}

type Row = { id: string; project_id: string; json: string; created_at: number }

const toRecord = (row: Row): RenderHistoryRecord => ({
  ...(JSON.parse(row.json) as RenderHistoryMeta),
  id: row.id,
  projectId: row.project_id,
  createdAt: row.created_at,
  imageUrl: `/api/render/history/${row.id}`,
})

export function addRenderRecord(
  owner: { userId: string; shopId: string }, projectId: string, meta: RenderHistoryMeta, image: Uint8Array, now = Date.now(),
): RenderHistoryRecord {
  const database = db()
  const id = randomUUID()
  database.exec('BEGIN IMMEDIATE')
  try {
    database.prepare(`INSERT INTO render_history (id, shop_id, user_id, project_id, json, image, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, owner.shopId, owner.userId, projectId, JSON.stringify(meta), image, now)
    database.prepare(`DELETE FROM render_history WHERE user_id = ? AND shop_id = ? AND project_id = ? AND id NOT IN (
      SELECT id FROM render_history WHERE user_id = ? AND shop_id = ? AND project_id = ?
      ORDER BY created_at DESC, id DESC LIMIT ?)`)
      .run(owner.userId, owner.shopId, projectId, owner.userId, owner.shopId, projectId, MAX_RENDER_HISTORY)
    database.exec('COMMIT')
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
  return toRecord({ id, project_id: projectId, json: JSON.stringify(meta), created_at: now })
}

export function listRenderHistory(owner: { userId: string; shopId: string }, projectId: string): RenderHistoryRecord[] {
  return (db().prepare(`SELECT id, project_id, json, created_at FROM render_history
    WHERE user_id = ? AND shop_id = ? AND project_id = ? ORDER BY created_at DESC, id DESC`)
    .all(owner.userId, owner.shopId, projectId) as Row[]).map(toRecord)
}

export function readRenderImage(owner: { userId: string; shopId: string }, id: string): Uint8Array | null {
  const row = db().prepare('SELECT image FROM render_history WHERE id = ? AND user_id = ? AND shop_id = ?')
    .get(id, owner.userId, owner.shopId) as { image: Uint8Array } | undefined
  return row?.image ?? null
}

export function deleteRenderRecord(owner: { userId: string; shopId: string }, id: string): boolean {
  return Number(db().prepare('DELETE FROM render_history WHERE id = ? AND user_id = ? AND shop_id = ?')
    .run(id, owner.userId, owner.shopId).changes) > 0
}
