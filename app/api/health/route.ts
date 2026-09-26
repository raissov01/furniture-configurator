import { db } from '@/lib/server/db'

export async function GET(): Promise<Response> {
  try {
    db().prepare('SELECT 1 AS ok').get()
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
