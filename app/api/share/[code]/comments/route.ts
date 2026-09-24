import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cloudOff } from '@/lib/server/cloud'
import { addClientComment, listForShare } from '@/lib/server/comments'
import { readShare } from '@/lib/server/share'
import { allowComment, allowShareMiss, isShareLimited, requestIp } from '@/lib/server/rateLimit'

type Context = { params: Promise<{ code: string }> }
const Input = z.strictObject({
  body: z.string().trim().min(1).max(2000),
  author: z.string().trim().min(1).max(60),
  targetId: z.string().min(1).max(100).nullable(),
})

function targetExists(json: string, id: string): boolean {
  try {
    const project: unknown = JSON.parse(json)
    if (!project || typeof project !== 'object') return false
    if ('cabinets' in project && Array.isArray(project.cabinets)) {
      return project.cabinets.some((item: unknown) => item && typeof item === 'object' && 'id' in item && item.id === id)
    }
    if ('root' in project && project.root && typeof project.root === 'object') {
      const visit = (node: unknown): boolean => {
        if (!node || typeof node !== 'object') return false
        if ('id' in node && node.id === id) return true
        return 'children' in node && Array.isArray(node.children) && node.children.some(visit)
      }
      return visit(project.root)
    }
    return false
  } catch {
    return false
  }
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const { code } = await params
  const ip = requestIp(request)
  if (isShareLimited(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
  if (!readShare(code)) {
    if (!allowShareMiss(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
    return NextResponse.json({ error: 'Код не найден или истёк' }, { status: 404 })
  }
  return NextResponse.json({ comments: listForShare(code) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request, { params }: Context): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const { code } = await params
  const ip = requestIp(request)
  if (isShareLimited(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
  const share = readShare(code)
  if (!share) {
    if (!allowShareMiss(ip, code)) return NextResponse.json({ error: 'Слишком много попыток' }, { status: 429 })
    return NextResponse.json({ error: 'Код не найден или истёк' }, { status: 404 })
  }
  const text = await request.text()
  if (text.length > 3000) return NextResponse.json({ error: 'Комментарий слишком длинный' }, { status: 413 })
  let raw: unknown
  try { raw = JSON.parse(text) as unknown } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  const input = Input.safeParse(raw)
  if (!input.success) return NextResponse.json({ error: 'Нужны имя, текст и targetId (или null)' }, { status: 400 })
  if (input.data.targetId && !targetExists(share.json, input.data.targetId)) {
    return NextResponse.json({ error: 'Объект не найден' }, { status: 400 })
  }
  if (listForShare(code).length >= 200) {
    return NextResponse.json({ error: 'Достигнут предел комментариев' }, { status: 409 })
  }
  if (!allowComment(ip, code)) return NextResponse.json({ error: 'Слишком много комментариев' }, { status: 429 })
  const comment = addClientComment(code, input.data.targetId, input.data.body, input.data.author)
  if (!comment) return NextResponse.json({ error: 'Код истёк' }, { status: 404 })
  return NextResponse.json({ comment }, { status: 201 })
}
