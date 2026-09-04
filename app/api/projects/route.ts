import { NextResponse } from 'next/server'
import { parseProject } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { listProjects, writeProject } from '@/lib/server/store'
import { projectExists, readPlan, usageOf } from '@/lib/server/plan'
import { canAddProject } from '@/lib/plans'
import { cloudOff } from '@/lib/server/cloud'

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  return NextResponse.json({ projects: listProjects(account.shopId) })
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { project?: unknown; id?: unknown }
    | null
  try {
    const project = parseProject(body?.project)
    const id = typeof body?.id === 'string' ? body.id : undefined

    /*
     * Тариф лимиті ТЕК ЖАҢА жобаға. Бар жобаны жаңарту әрқашан өтеді:
     * лимитке жеткен цех өз жұмысын сақтай алмай қалса, ол — оның еңбегін
     * құлыптау болар еді (`lib/plans.ts` қара).
     */
    const isNew = id === undefined || !projectExists(account.shopId, id)
    if (isNew) {
      const { plan } = readPlan(account.shopId)
      const check = canAddProject(plan, usageOf(account.shopId))
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })
    }

    const saved = writeProject(account.shopId, project.name, project, id)
    return NextResponse.json({ id: saved })
  } catch (error) {
    return NextResponse.json(
      { error: `Проект не принят: ${error instanceof Error ? error.message : 'неверная форма'}` },
      { status: 400 },
    )
  }
}
