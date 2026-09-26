import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { currentAccount } from '@/lib/server/session'
import { MobileMeasurementError, readMeasurementPhoto, saveMeasurementPhoto } from '@/lib/server/mobileMeasurement'

const error = (message: string, status: number) => NextResponse.json({ error: message }, {
  status, headers: { 'Cache-Control': 'no-store' },
})
type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return error('Кіру қажет', 401)
    if (account.role !== 'owner' && account.role !== 'designer') return error('Рұқсат жоқ', 403)
    const { id } = await context.params
    const length = Number(request.headers.get('content-length'))
    if (Number.isFinite(length) && length > 8_000_000) return error('Фото 8 МБ-тан аспауы керек', 413)
    const bytes = new Uint8Array(await request.arrayBuffer())
    const result = saveMeasurementPhoto(account.shopId, id, request.headers.get('content-type') ?? '', bytes, Date.now())
    return NextResponse.json({ kind: result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    if (cause instanceof MobileMeasurementError) return error(cause.message, cause.status)
    console.error('mobile photo upload failed', cause)
    return error('Фото уақытша сақталмады', 500)
  }
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return error('Кіру қажет', 401)
    if (account.role !== 'owner' && account.role !== 'designer') return error('Рұқсат жоқ', 403)
    const { id } = await context.params
    const photo = readMeasurementPhoto(account.shopId, id)
    if (!photo) return error('Фото табылмады', 404)
    return new Response(Uint8Array.from(photo.bytes).buffer, {
      headers: { 'Content-Type': photo.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (cause) {
    if (cause instanceof MobileMeasurementError) return error(cause.message, cause.status)
    console.error('mobile photo read failed', cause)
    return error('Фото уақытша ашылмады', 500)
  }
}
