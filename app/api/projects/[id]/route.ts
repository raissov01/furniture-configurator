import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { deleteProject, readProject } from '@/lib/server/store'
import { cloudOff } from '@/lib/server/cloud'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  const { id } = await context.params
  // Іздеу ӘРҚАШАН cookie-ден алынған цехпен шектеледі — бөтен жобаны
  // id-мен сұрап алуға болмайды.
  const project = readProject(account.shopId, id)
  if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
  return NextResponse.json({ project })
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  const { id } = await context.params
  deleteProject(account.shopId, id)
  return NextResponse.json({ ok: true })
}
