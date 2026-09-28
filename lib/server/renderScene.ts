import OpenAI from 'openai'

const MODEL = process.env['OPENAI_IMAGE_MODEL'] ?? 'gpt-image-1'
/** 3D скриншоты әдетте 1–3 МБ; OpenAI-ға жіберілетін кірістің шегі. */
export const MAX_RENDER_BYTES = 8 * 1024 * 1024

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

const STYLES: Record<string, string> = {
  scandinavian: 'Стиль: скандинавский — светлое дерево, белые стены, минимализм, уют.',
  modern: 'Стиль: современный минимализм — чистые линии, матовые поверхности, нейтральные тона.',
  loft: 'Стиль: лофт — кирпич, бетон, тёплый свет, тёмный металл.',
  classic: 'Стиль: классический — тёплое дерево, филёнчатые фасады, мягкий свет.',
}

/** HTTP маршрутынан да, фондық жұмысшыдан да шақырылатын серверлік OpenAI қадамы. */
export async function renderScene(bytes: Uint8Array, hint = '', style = ''): Promise<string> {
  if (bytes.byteLength > MAX_RENDER_BYTES) throw new Error('Снимок слишком большой')
  const key = process.env['OPENAI_API_KEY']
  if (!key) throw new Error('ИИ-рендер не настроен: нет ключа OpenAI')
  const openai = new OpenAI({ apiKey: key })
  const styleText = Object.hasOwn(STYLES, style) ? STYLES[style] : ''
  const hintText = hint.slice(0, 300)
  const result = await openai.images.edit({
    model: MODEL,
    image: new File([bytes as unknown as BlobPart], 'scene.png', { type: 'image/png' }),
    prompt: [PROMPT, styleText, hintText ? `Дополнительно: ${hintText}` : '']
      .filter(Boolean).join(' '),
    size: '1024x1024',
    quality: 'high',
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('Модель не вернула изображение')
  return b64
}
