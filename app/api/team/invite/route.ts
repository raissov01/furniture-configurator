import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { db } from '@/lib/server/db'
import { checkInvite } from '@/lib/server/team'

/** A public invite token grants only the inviting shop's display name. */
export async function GET(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const result = checkInvite(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const shop = db().prepare('SELECT name FROM shops WHERE id = ?').get(result.shopId) as { name: string } | undefined
  if (!shop) return NextResponse.json({ error: 'Цех приглашения не найден' }, { status: 400 })
  return NextResponse.json({ shopName: shop.name })
}
