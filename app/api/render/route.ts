/**
 * ИИ-рендер: 3D көрінісінен фотореалистік сурет.
 *
 * НЕГЕ КЕРЕК. Цехтың 3D-і — ЖИНАУ сызбасы: панельдер, өлшемдер, тор. Клиент
 * оны түсінеді, бірақ «менің бөлмемде қалай тұрады» дегенді көрмейді.
 * Рендер сол сұраққа жауап береді, ал шешім қабылдау сол суреттен басталады.
 *
 * ⚠ ЕКІ ЕСКЕРТУ, ЕКЕУІ ДЕ МАҢЫЗДЫ:
 *
 * 1. **Рендер — СУРЕТ, ӨЛШЕМ ЕМЕС.** Модель пропорцияны да, түсті де сәл
 *    өзгертуі мүмкін. Клиентке жіберер алдында цех оны деталировкамен
 *    салыстыруы керек — интерфейсте де солай жазылған.
 * 2. **Әр рендер OpenAI-да АҚША тұрады.** Сондықтан ол автоматты түрде
 *    жүрмейді: тек батырма басылғанда.
 */

import { aiAccess } from '@/lib/server/aiAccess'
import { MAX_RENDER_BYTES, renderScene } from '@/lib/server/renderScene'
import { readLimitedBody } from '@/lib/server/readLimitedBody'

/** 8 МиБ PNG-нің base64 JSON пішімі және шағын prompt өрістеріне орын. */
const MAX_RENDER_BODY_BYTES = Math.ceil(MAX_RENDER_BYTES / 3) * 4 + 4096
type RenderBody = { image?: unknown; hint?: unknown; style?: unknown }

export async function POST(request: Request): Promise<Response> {
  const denied = await aiAccess('render')
  if (denied) return denied
  const key = process.env['OPENAI_API_KEY']
  if (!key) {
    return Response.json({ error: 'ИИ-рендер не настроен: нет ключа OpenAI' }, { status: 503 })
  }

  const requestBytes = await readLimitedBody(request, MAX_RENDER_BODY_BYTES)
  if (!requestBytes) return Response.json({ error: 'Снимок слишком большой' }, { status: 413 })
  let body: RenderBody | null = null
  try {
    body = JSON.parse(new TextDecoder().decode(requestBytes)) as RenderBody
  } catch {
    // Пішімі жарамсыз JSON төмендегі нақты өріс қатесімен қайтады.
  }
  const image = typeof body?.image === 'string' ? body.image : ''
  const hint = typeof body?.hint === 'string' ? body.hint : ''
  const style = typeof body?.style === 'string' ? body.style : ''
  if (!image.startsWith('data:image/png;base64,')) {
    return Response.json({ error: 'Нужен снимок сцены' }, { status: 400 })
  }

  const bytes = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64')
  if (bytes.byteLength > MAX_RENDER_BYTES) {
    return Response.json({ error: 'Снимок слишком большой' }, { status: 413 })
  }

  try {
    const b64 = await renderScene(bytes, hint, style)
    return Response.json({ image: `data:image/png;base64,${b64}` })
  } catch (error) {
    // Қате мәтіні пайдаланушыға шығады, сондықтан ол ТҮСІНІКТІ болуы керек.
    const message = error instanceof Error ? error.message : 'неизвестная ошибка'
    return Response.json({ error: `ИИ-рендер не получился: ${message}` }, { status: 502 })
  }
}
