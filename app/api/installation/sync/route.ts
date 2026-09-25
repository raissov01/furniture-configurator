import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { parseInstallationAction } from '@/src/core/installation'
import { cloudOff } from '@/lib/server/cloud'
import { InstallationError, applyInstallationSync } from '@/lib/server/installation'
import { currentAccount } from '@/lib/server/session'

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return error('Нужен вход', 401)
    if (account.role !== 'shop' && account.role !== 'owner') return error('Доступ запрещён', 403)
    const body = await request.text()
    if (body.length > 3_000_000) return error('Слишком большой запрос', 413)
    let raw: unknown
    try { raw = JSON.parse(body) as unknown } catch { return error('Некорректный JSON', 400) }
    const action = parseInstallationAction(raw)
    const result = applyInstallationSync(account.shopId, action, Date.now())
    return NextResponse.json(result, { status: result.kind === 'conflict' ? 409 : 200,
      headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    if (cause instanceof ZodError) return error('Неверные данные монтажа', 400)
    if (cause instanceof InstallationError) return error(cause.message, cause.status)
    if (cause instanceof Error && /Белгісіз монтаж әрекеті/.test(cause.message)) return error(cause.message, 400)
    if (cause instanceof Error && /деталь|фото|қол|ремонт|Жабылған|Ақау|тапсырма/.test(cause.message)) return error(cause.message, 422)
    console.error('installation sync failed', cause)
    return error('Монтаж временно недоступен', 500)
  }
}
