import { NextResponse } from 'next/server'
import { currentAccount } from '@/lib/server/session'
import { deleteProject, readProject } from '@/lib/server/store'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'
import { toProductionProject } from '@/src/core/publicProject'
import type { ProjectFile } from '@/src/core/types'
import type { ProjectFileV4 } from '@/src/core/projectV4'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const { id } = await context.params
  // Іздеу ӘРҚАШАН cookie-ден алынған цехпен шектеледі — бөтен жобаны
  // id-мен сұрап алуға болмайды.
  const project = readProject(account.shopId, id)
  if (!project) return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
  return NextResponse.json({ project: account.role === 'shop'
    ? toProductionProject(project as ProjectFile | ProjectFileV4) : project })
}

export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const { id } = await context.params
  deleteProject(account.shopId, id)
  return NextResponse.json({ ok: true })
}
