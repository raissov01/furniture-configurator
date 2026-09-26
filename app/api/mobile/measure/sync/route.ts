import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { cloudOff } from '@/lib/server/cloud'
import { currentAccount } from '@/lib/server/session'
import { MobileMeasurementError, applyMeasurementSync } from '@/lib/server/mobileMeasurement'
import type { SyncAction } from '@/src/core/sync/types'
import { MeasurementSurveySchema } from '@/src/core/measure'

const integer = z.number().int().safe().nonnegative()
const actionSchema = z.object({
  id: z.string().trim().min(1), kind: z.literal('measurement.upsert'), entityId: z.string().trim().min(1),
  payload: MeasurementSurveySchema,
  baseRevision: z.object({ version: integer, updatedAt: integer }).strict(),
  createdAt: integer,
}).strict()

const error = (message: string, status: number) => NextResponse.json({ error: message }, {
  status, headers: { 'Cache-Control': 'no-store' },
})

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return error('Кіру қажет', 401)
    if (account.role !== 'owner' && account.role !== 'designer') return error('Рұқсат жоқ', 403)
    const body = await request.text()
    if (body.length > 3_000_000) return error('Өлшем файлы тым үлкен', 413)
    let raw: unknown
    try { raw = JSON.parse(body) as unknown } catch { return error('JSON пішімі қате', 400) }
    const result = applyMeasurementSync(account.shopId, actionSchema.parse(raw) as unknown as SyncAction, Date.now())
    return NextResponse.json(result, {
      status: result.kind === 'conflict' ? 409 : 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (cause) {
    if (cause instanceof ZodError) return error(cause.issues.map((issue) => issue.path.join('.')).join(', '), 400)
    if (cause instanceof MobileMeasurementError) return error(cause.message, cause.status)
    if (cause instanceof Error && /Sync action|baseRevision|createdAt|payload/.test(cause.message)) return error(cause.message, 400)
    console.error('mobile measurement sync failed', cause)
    return error('Өлшем уақытша сақталмады', 500)
  }
}
