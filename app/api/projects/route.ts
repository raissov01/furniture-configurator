import { NextResponse } from 'next/server'
import { parseProjectV4 } from '@/src/core/index'
import { currentAccount } from '@/lib/server/session'
import { listProjects, listProjectsPage, projectRevision, updateProject, writeProject } from '@/lib/server/store'
import { readPlan, usageOf } from '@/lib/server/plan'
import { canAddProject } from '@/lib/plans'
import { cloudOff } from '@/lib/server/cloud'
import { can } from '@/lib/permissions'

export async function GET(request?: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'readProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const params = request ? new URL(request.url).searchParams : new URLSearchParams()
  if (!params.has('limit') && !params.has('offset') && !params.has('q')) {
    return NextResponse.json({ projects: listProjects(account.shopId) })
  }
  const limit = Number(params.get('limit') ?? '100')
  const offset = Number(params.get('offset') ?? '0')
  const query = params.get('q') ?? ''
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isSafeInteger(offset) || offset < 0 || query.length > 80) {
    return NextResponse.json({ error: 'limit: 1–100, offset: 0+, q: 0–80 таңба' }, { status: 400 })
  }
  return NextResponse.json(listProjectsPage(account.shopId, { limit, offset, query }))
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off

  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'editProject')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

  const body = (await request.json().catch(() => null)) as
    | { project?: unknown; id?: unknown; baseRevision?: unknown }
    | null
  try {
    const project = parseProjectV4(body?.project)
    const id = typeof body?.id === 'string' && body.id.length > 0 ? body.id : undefined

    if (id) {
      if (!Number.isSafeInteger(body?.baseRevision) || (body?.baseRevision as number) < 0) {
        return NextResponse.json({ error: 'Требуется baseRevision проекта' }, { status: 428 })
      }
      const result = updateProject(account.shopId, id, project.name, project, body?.baseRevision as number, account.userId)
      if (result.kind === 'missing') return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
      if (result.kind === 'conflict') return NextResponse.json(
        { error: 'Проект изменён в другой вкладке', revision: result.revision }, { status: 409 },
      )
      return NextResponse.json({ id, revision: result.revision })
    }

    /*
     * Тариф лимиті ТЕК ЖАҢА жобаға. Бар жобаны жаңарту әрқашан өтеді:
     * лимитке жеткен цех өз жұмысын сақтай алмай қалса, ол — оның еңбегін
     * құлыптау болар еді (`lib/plans.ts` қара).
     */
    const { plan } = readPlan(account.shopId)
    const check = canAddProject(plan, usageOf(account.shopId))
    if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

    const saved = writeProject(account.shopId, project.name, project, undefined, account.userId)
    return NextResponse.json({ id: saved, revision: projectRevision(account.shopId, saved) })
  } catch (error) {
    return NextResponse.json(
      { error: `Проект не принят: ${error instanceof Error ? error.message : 'неверная форма'}` },
      { status: 400 },
    )
  }
}
