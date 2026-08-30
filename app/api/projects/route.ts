import { NextResponse } from 'next/server'
import { parseProject } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { listProjects, writeProject } from '@/lib/server/store'

export async function GET(): Promise<Response> {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  return NextResponse.json({ projects: listProjects(account.shopId) })
}

export async function POST(request: Request): Promise<Response> {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { project?: unknown; id?: unknown }
    | null
  try {
    const project = parseProject(body?.project)
    const id = typeof body?.id === 'string' ? body.id : undefined
    const saved = writeProject(account.shopId, project.name, project, id)
    return NextResponse.json({ id: saved })
  } catch (error) {
    return NextResponse.json(
      { error: `Проект не принят: ${error instanceof Error ? error.message : 'неверная форма'}` },
      { status: 400 },
    )
  }
}
