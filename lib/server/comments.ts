import { randomUUID } from 'node:crypto'
import { db } from './db'
import { readShare } from './share'

export type Comment = {
  id: string
  code: string
  targetId: string | null
  body: string
  author: string
  authorRole: 'client' | 'designer' | 'creator'
  replyTo: string | null
  createdAt: number
}

type CommentRow = {
  id: string; code: string; target_id: string | null; body: string
  author: string; author_role: 'client' | 'designer' | 'creator'; reply_to: string | null; created_at: number
}
const map = (row: CommentRow): Comment => ({
  id: row.id, code: row.code, targetId: row.target_id, body: row.body,
  author: row.author, authorRole: row.author_role, replyTo: row.reply_to, createdAt: row.created_at,
})

export function listForShare(code: string): Comment[] {
  if (!readShare(code)) return []
  return (db().prepare('SELECT * FROM comments WHERE code = ? ORDER BY created_at, id')
    .all(code) as CommentRow[]).map(map)
}

export function listForShop(shopId: string): Comment[] {
  return (db().prepare(`SELECT c.* FROM comments c JOIN shares s ON s.code = c.code
    WHERE s.shop_id = ? ORDER BY c.created_at DESC, c.id LIMIT 200`)
    .all(shopId) as CommentRow[]).map(map)
}

export function addClientComment(code: string, targetId: string | null, body: string, author: string): Comment | null {
  if (!readShare(code)) return null
  const now = Date.now()
  const id = randomUUID()
  db().prepare("INSERT INTO comments (id, code, target_id, body, author, author_role, created_at) VALUES (?, ?, ?, ?, ?, 'client', ?)")
    .run(id, code, targetId, body, author, now)
  return { id, code, targetId, body, author, authorRole: 'client', replyTo: null, createdAt: now }
}

export function addDesignerReply(code: string, replyTo: string, body: string, shopId: string, userId: string): Comment | null {
  const parent = db().prepare(`SELECT c.target_id FROM comments c JOIN shares s ON s.code = c.code
    WHERE c.id = ? AND c.code = ? AND s.shop_id = ?`)
    .get(replyTo, code, shopId) as { target_id: string | null } | undefined
  if (!parent) return null
  const now = Date.now()
  const id = randomUUID()
  db().prepare(`INSERT INTO comments (id, code, target_id, body, author, author_role, reply_to, user_id, created_at)
    VALUES (?, ?, ?, ?, 'designer', 'designer', ?, ?, ?)`)
    .run(id, code, parent.target_id, body, replyTo, userId, now)
  return { id, code, targetId: parent.target_id, body, author: 'designer', authorRole: 'designer', replyTo, createdAt: now }
}

export function addCreatorReply(code: string, replyTo: string, body: string): Comment | null {
  const parent = db().prepare('SELECT target_id FROM comments WHERE id = ? AND code = ?')
    .get(replyTo, code) as { target_id: string | null } | undefined
  if (!parent) return null
  const now = Date.now()
  const id = randomUUID()
  db().prepare(`INSERT INTO comments (id, code, target_id, body, author, author_role, reply_to, created_at)
    VALUES (?, ?, ?, ?, 'creator', 'creator', ?, ?)`).run(id, code, parent.target_id, body, replyTo, now)
  return { id, code, targetId: parent.target_id, body, author: 'creator', authorRole: 'creator', replyTo, createdAt: now }
}
