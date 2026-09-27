import { db } from './db'
import { cloudEnabled } from '@/lib/cloud'

export type AuditEvent = {
  shopId: string
  actorId?: string | null | undefined
  action: string
  entityType: 'project' | 'price' | 'role' | 'approval' | 'password'
  entityId?: string | null
  detail?: unknown
}

export function audit(event: AuditEvent, now = Date.now()): void {
  db().prepare(`INSERT INTO audit_log (shop_id, actor_id, action, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(event.shopId, event.actorId ?? null, event.action,
      event.entityType, event.entityId ?? null, JSON.stringify(event.detail ?? {}), now)
}

export function recordMetric(route: string, method: string, status: number, latencyMs: number, now = Date.now()): void {
  db().prepare(`INSERT INTO api_metrics (route, method, status, latency_ms, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(route, method, status, Math.round(latencyMs), now)
}

export function recordError(route: string, cause: unknown, now = Date.now()): void {
  const error = cause instanceof Error ? cause : new Error(String(cause))
  db().prepare(`INSERT INTO error_log (route, message, stack, created_at) VALUES (?, ?, ?, ?)`)
    .run(route, error.message, error.stack ?? null, now)
}

export function observe<Args extends unknown[]>(
  route: string, method: string, handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    if (!cloudEnabled) return handler(...args)
    const start = performance.now()
    try {
      const response = await handler(...args)
      try {
        recordMetric(route, method, response.status, performance.now() - start)
        if (response.status >= 500) recordError(route, new Error(`HTTP ${response.status}`))
      }
      catch (cause) { console.error('API metric write failed', cause) }
      return response
    } catch (cause) {
      try { recordError(route, cause); recordMetric(route, method, 500, performance.now() - start) }
      catch (recordCause) { console.error('API error log write failed', recordCause) }
      throw cause
    }
  }
}

export type AuditRow = { id: number; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; created_at: number }
export type MetricRow = { route: string; method: string; status: number; latency_ms: number; created_at: number }
export type ErrorRow = { route: string; message: string; created_at: number }

export function recentObservability(shopId: string): { audit: AuditRow[]; metrics: MetricRow[]; errors: ErrorRow[] } {
  const platformAdmin = process.env['PLATFORM_ADMIN_SHOP_ID'] === shopId
  return {
    audit: db().prepare('SELECT id, actor_id, action, entity_type, entity_id, created_at FROM audit_log WHERE shop_id = ? ORDER BY created_at DESC LIMIT 100').all(shopId) as AuditRow[],
    metrics: platformAdmin ? db().prepare('SELECT route, method, status, latency_ms, created_at FROM api_metrics ORDER BY created_at DESC LIMIT 100').all() as MetricRow[] : [],
    errors: platformAdmin ? db().prepare('SELECT route, message, created_at FROM error_log ORDER BY created_at DESC LIMIT 100').all() as ErrorRow[] : [],
  }
}
