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

import OpenAI from 'openai'

const MODEL = process.env['OPENAI_IMAGE_MODEL'] ?? 'gpt-image-1'
/** Кірістің шегі: 3D скриншоты әдетте 1–3 МБ. */
const MAX_BYTES = 8 * 1024 * 1024

const PROMPT = [
  'Фотореалистичный интерьерный рендер этой мебели.',
  'СОХРАНИ пропорции, количество и расположение фасадов, полок и ящиков без изменений —',
  'это чертёж реального изделия, а не эскиз.',
  'Убери сетку, размерные подписи и служебные линии.',
  'Поставь мебель в светлую комнату с мягким дневным светом, лёгкой тенью на полу,',
  'нейтральными стенами и полом. Без людей, без текста, без логотипов.',
].join(' ')

export async function POST(request: Request): Promise<Response> {
  const key = process.env['OPENAI_API_KEY']
  if (!key) {
    return Response.json({ error: 'ИИ-рендер не настроен: нет ключа OpenAI' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { image?: unknown; hint?: unknown } | null
  const image = typeof body?.image === 'string' ? body.image : ''
  const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 300) : ''
  if (!image.startsWith('data:image/png;base64,')) {
    return Response.json({ error: 'Нужен снимок сцены' }, { status: 400 })
  }

  const bytes = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64')
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: 'Снимок слишком большой' }, { status: 413 })
  }

  try {
    const openai = new OpenAI({ apiKey: key })
    const result = await openai.images.edit({
      model: MODEL,
      // `File` — Node 20+ ішінде бар, қосымша тәуелділік керек емес.
      image: new File([bytes as unknown as BlobPart], 'scene.png', { type: 'image/png' }),
      prompt: hint ? `${PROMPT} Дополнительно: ${hint}` : PROMPT,
      size: '1024x1024',
    })
    const b64 = result.data?.[0]?.b64_json
    if (!b64) return Response.json({ error: 'Модель не вернула изображение' }, { status: 502 })
    return Response.json({ image: `data:image/png;base64,${b64}` })
  } catch (error) {
    // Қате мәтіні пайдаланушыға шығады, сондықтан ол ТҮСІНІКТІ болуы керек.
    const message = error instanceof Error ? error.message : 'неизвестная ошибка'
    return Response.json({ error: `ИИ-рендер не получился: ${message}` }, { status: 502 })
  }
}
