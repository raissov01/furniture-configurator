import { randomUUID } from 'node:crypto'
import { flattenTree } from '@/src/core/flatten'
import { projectProduction } from '@/lib/projectProduction'
import { applyInstallationAction, createInstallationTask, type InstallationAction, type InstallationTask } from '@/src/core/installation'
import { parseProjectV4 } from '@/src/core/projectV4'
import { db } from './db'
import { readProject } from './store'

export class InstallationError extends Error {
  constructor(public readonly status: 404 | 409 | 422, message: string) { super(message) }
}

type ActionRow = { shop_id: string; task_id: string; request_json: string; revision_version: number; revision_updated_at: number }
type TaskRow = { json: string }
export type SyncReply =
  | { kind: 'applied' | 'duplicate'; revision: InstallationTask['revision'] }
  | { kind: 'conflict'; revision: InstallationTask['revision']; serverValue: InstallationTask }

export function readInstallationTask(shopId: string, taskId: string): InstallationTask | null {
  const row = db().prepare('SELECT json FROM installation_tasks WHERE shop_id = ? AND id = ?').get(shopId, taskId) as TaskRow | undefined
  return row ? JSON.parse(row.json) as InstallationTask : null
}

export function listInstallationTasks(shopId: string): { id: string; projectId: string; status: InstallationTask['status']; updatedAt: number }[] {
  const rows = db().prepare('SELECT id, project_id, json, updated_at FROM installation_tasks WHERE shop_id = ? ORDER BY updated_at DESC')
    .all(shopId) as { id: string; project_id: string; json: string; updated_at: number }[]
  return rows.map((row) => ({ id: row.id, projectId: row.project_id,
    status: (JSON.parse(row.json) as InstallationTask).status, updatedAt: row.updated_at }))
}

/** A single SQLite write transaction covers task state, deduplication and outbox events. */
export function applyInstallationSync(shopId: string, action: InstallationAction, now: number): SyncReply {
  const database = db()
  database.exec('BEGIN IMMEDIATE')
  try {
    const requestJson = JSON.stringify(action)
    const previous = database.prepare('SELECT * FROM installation_actions WHERE id = ?').get(action.id) as ActionRow | undefined
    if (previous) {
      if (previous.shop_id !== shopId || previous.task_id !== action.entityId || previous.request_json !== requestJson) {
        throw new InstallationError(409, 'Әрекет ID-і басқа мазмұнға қолданылған')
      }
      database.exec('COMMIT')
      return { kind: 'duplicate', revision: { version: previous.revision_version, updatedAt: previous.revision_updated_at } }
    }

    let task = readInstallationTask(shopId, action.entityId)
    if (action.kind === 'installation.create') {
      if (task) return conflict(database, task)
      // Кесте ID-і ортақ: басқа цехтың тапсырмасы UNIQUE қатесімен 500 бермесін.
      if (database.prepare('SELECT 1 FROM installation_tasks WHERE id = ?').get(action.entityId)) {
        throw new InstallationError(409, 'Монтаж ID-і бос емес; жаңа ID жасаңыз')
      }
      if (action.baseRevision.version !== 0 || action.baseRevision.updatedAt !== 0) {
        throw new InstallationError(409, 'Жаңа монтаждың базалық нұсқасы 0 болуы керек')
      }
      const payload = action.payload as { projectId: string }
      const raw = readProject(shopId, payload.projectId)
      if (!raw) throw new InstallationError(404, 'Жоба табылмады')
      const project = parseProjectV4(raw)
      const catalog = { materials: project.materials, edgeBands: project.edgeBands }
      // Бірнеше корпуста әр шкафта «side-left» бар: ID сахна мен деталировкадағыдай
      // `mergeProjectPanels` арқылы корпус атымен бірегейленеді.
      const scene = flattenTree(project.root, catalog, project.settings, project.layers)
      const panelIds = projectProduction(project.root, scene).panels.map((panel) => panel.id)
      task = createInstallationTask(action.entityId, payload.projectId, panelIds, now)
      database.prepare('INSERT INTO installation_tasks (id, shop_id, project_id, json, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(task.id, shopId, task.projectId, JSON.stringify(task), now)
    } else {
      if (!task) throw new InstallationError(404, 'Монтаж тапсырмасы табылмады')
      if (action.baseRevision.version !== task.revision.version || action.baseRevision.updatedAt !== task.revision.updatedAt) {
        return conflict(database, task)
      }
      const result = applyInstallationAction(task, action, now)
      task = result.task
      database.prepare('UPDATE installation_tasks SET json = ?, updated_at = ? WHERE id = ? AND shop_id = ?')
        .run(JSON.stringify(task), now, task.id, shopId)
      for (const event of result.events) {
        database.prepare(`INSERT INTO installation_events
          (id, shop_id, task_id, kind, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(randomUUID(), shopId, task.id, event.kind, JSON.stringify(event), now)
      }
    }
    database.prepare(`INSERT INTO installation_actions
      (id, shop_id, task_id, request_json, revision_version, revision_updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(action.id, shopId, task.id, requestJson, task.revision.version, task.revision.updatedAt)
    database.exec('COMMIT')
    return { kind: 'applied', revision: task.revision }
  } catch (cause) {
    database.exec('ROLLBACK')
    throw cause
  }
}

function conflict(database: ReturnType<typeof db>, task: InstallationTask): SyncReply {
  database.exec('COMMIT')
  return { kind: 'conflict', revision: task.revision, serverValue: task }
}
