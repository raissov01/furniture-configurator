/** ЖИ-рендер тарихы: GET ?projectId=… — тек ӨЗ жазбаларың (пайдаланушы + цех). */

import { NextResponse } from 'next/server'
import { cloudOff } from '@/lib/server/cloud'
import { listRenderHistory } from '@/lib/server/renderHistory'
import { currentAccount } from '@/lib/server/session'

export async function GET(request: Request): Promise<Response> {
  const off = cloudOff()
  if (off) return off
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Нужен вход' }, { status: 401 })
  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() ?? ''
  if (!projectId || projectId.length > 120) {
    return NextResponse.json({ error: 'Нужен projectId (1..120 символов)', field: 'projectId' }, { status: 400 })
  }
  return NextResponse.json({ renders: listRenderHistory(account, projectId) }, { headers: { 'Cache-Control': 'no-store' } })
}
