import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { listInstallationTasks } from '@/lib/server/installation'
import { currentAccount } from '@/lib/server/session'

export async function GET(): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
    if (account.role !== 'shop' && account.role !== 'owner') return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    return NextResponse.json({ tasks: listInstallationTasks(account.shopId) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('installation list failed', cause)
    return NextResponse.json({ error: 'Монтаж временно недоступен' }, { status: 500 })
  }
}
