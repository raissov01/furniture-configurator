import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can } from '@/lib/permissions'
import { cloudOff } from '@/lib/server/cloud'
import { addCreatorReply, addDesignerReply, listForShop } from '@/lib/server/comments'
import { currentAccount } from '@/lib/server/session'
import { ownsShareKey } from '@/lib/server/share'

const Reply = z.strictObject({
  code: z.string().regex(/^\d{6}$/),
  replyTo: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
})

export async function GET(): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  if (!can(account.role, 'reply')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  return NextResponse.json({ comments: listForShop(account.shopId) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  const text = await request.text()
  if (text.length > 3000) return NextResponse.json({ error: 'Ответ слишком длинный' }, { status: 413 })
  let raw: unknown
  try { raw = JSON.parse(text) as unknown } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  const input = Reply.safeParse(raw)
  if (!input.success) return NextResponse.json({ error: 'Нужны code, replyTo и текст' }, { status: 400 })
  const key = request.headers.get('x-share-key') ?? ''
  if (account && !can(account.role, 'reply')) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })
  const keyAccess = !account && ownsShareKey(input.data.code, key)
  if (!account && !keyAccess) return NextResponse.json({ error: 'Нужен вход или ключ автора' }, { status: 401 })
  const comment = account
    ? addDesignerReply(input.data.code, input.data.replyTo, input.data.body, account.shopId, account.userId)
    : addCreatorReply(input.data.code, input.data.replyTo, input.data.body)
  if (!comment) return NextResponse.json({ error: 'Комментарий не найден' }, { status: 404 })
  return NextResponse.json({ comment }, { status: 201 })
}
