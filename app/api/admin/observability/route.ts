import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { recentObservability } from '@/lib/server/observability'

export async function GET(): Promise<Response> {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Кіру қажет' }, { status: 401 })
  if (account.role !== 'owner') return NextResponse.json({ error: 'Рұқсат жоқ' }, { status: 403 })
  return NextResponse.json(recentObservability(account.shopId), { headers: { 'Cache-Control': 'private, no-store' } })
}
