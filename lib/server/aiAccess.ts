import { can } from '../permissions'
import { allowAiRequest } from './rateLimit'
import { currentAccount } from './session'

/** Барлық OpenAI маршруттары мен v1 алиастарына ортақ тексеру. */
export async function aiAccess(kind: 'render' | 'text'): Promise<Response | null> {
  const account = await currentAccount()
  if (!account) return Response.json({ error: 'Нужен вход для ИИ-запроса' }, { status: 401 })
  if (!can(account.role, 'editProject')) return Response.json({ error: 'Доступ к ИИ-запросу запрещён' }, { status: 403 })
  if (!allowAiRequest(account.shopId, kind)) {
    return Response.json({ error: 'Лимит ИИ-запросов цеха исчерпан. Попробуйте позже.' }, { status: 429 })
  }
  return null
}
