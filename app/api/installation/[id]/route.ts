import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { readInstallationTask } from '@/lib/server/installation'
import { currentAccount } from '@/lib/server/session'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff(); if (off) return off
  try {
    const account = await currentAccount()
    if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
    if (account.role !== 'shop' && account.role !== 'owner') return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
    const { id } = await params
    if (!id || id.length > 120) return NextResponse.json({ error: 'Неверный ID' }, { status: 400 })
    const task = readInstallationTask(account.shopId, id)
    if (!task) return NextResponse.json({ error: 'Монтаж тапсырмасы табылмады' }, { status: 404 })
    return NextResponse.json({ task }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    console.error('installation GET failed', cause)
    return NextResponse.json({ error: 'Монтаж временно недоступен' }, { status: 500 })
  }
}
