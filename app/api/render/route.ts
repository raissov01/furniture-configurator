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
  'Фотореалистичный интерьерный рендер этой мебели, качество студийной визуализации.',
  'СОХРАНИ в точности пропорции, количество и расположение корпусов, фасадов, полок,',
  'ящиков и техники — это чертёж реального изделия, а не эскиз, ничего не добавляй и не убирай.',
  'Убери сетку, размерные подписи и служебные линии.',
  'Материалы реалистичные: фактура ЛДСП/МДФ, матовые или сатиновые фасады, металлические ручки,',
  'столешница с лёгким блеском. Мягкий дневной свет из окна сбоку, мягкие контактные тени,',
  'реалистичные отражения. Нейтральные стены и пол, аккуратная комната.',
  'Без людей, без текста, без логотипов, без искажений геометрии.',
].join(' ')

/** Интерьер стилі — пайдаланушы таңдайды, промптқа қосылады. */
const STYLES: Record<string, string> = {
  scandinavian: 'Стиль: скандинавский — светлое дерево, белые стены, минимализм, уют.',
  modern: 'Стиль: современный минимализм — чистые линии, матовые поверхности, нейтральные тона.',
  loft: 'Стиль: лофт — кирпич, бетон, тёплый свет, тёмный металл.',
  classic: 'Стиль: классический — тёплое дерево, филёнчатые фасады, мягкий свет.',
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env['OPENAI_API_KEY']
  if (!key) {
    return Response.json({ error: 'ИИ-рендер не настроен: нет ключа OpenAI' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { image?: unknown; hint?: unknown; style?: unknown } | null
  const image = typeof body?.image === 'string' ? body.image : ''
  const hint = typeof body?.hint === 'string' ? body.hint.slice(0, 300) : ''
  const style = typeof body?.style === 'string' && body.style in STYLES ? STYLES[body.style] : ''
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
      prompt: [PROMPT, style, hint ? `Дополнительно: ${hint}` : ''].filter(Boolean).join(' '),
      size: '1024x1024',
      quality: 'high',
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
