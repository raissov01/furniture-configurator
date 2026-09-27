/**
 * Сөзбен генерация: еркін мәтін → ГЕНЕРАТОР опциялары (`FurnitureOptions`).
 *
 * qdesign «Этапты конструктор»-дың жоғарысында сөзбен енгізу бар. Бізде де —
 * бірақ модель конфиг ЖАЗБАЙДЫ: ол тек «қандай жиынтық» дегенді (түр, пішін,
 * қабырға ұзындығы, мойка/техника) толтырады, ал толық гарнитурды ЯДРО құрайды
 * (`generateFurniture`). Сондықтан модель раскрой, присадка немесе өлшем ойлап
 * таба алмайды — «нені» дейді, «қалай» дегенді ядро есептейді.
 */

import OpenAI from 'openai'
import { aiAccess } from '@/lib/server/aiAccess'
import { sanitizeGeneratedOptions } from '@/src/core/stageBrief'
import type { StageBriefOptions } from '@/src/core/stageBrief'

const MODEL = process.env['OPENAI_MODEL'] ?? 'gpt-5.4'

const SYSTEM = `Ты помогаешь настроить ГЕНЕРАТОР корпусной мебели по описанию.
Клиент пишет словами (казахский, русский или вперемешку), ты возвращаешь
параметры генератора. Ты НЕ проектируешь детали — только выбираешь тип,
форму, длины стен и что включить.

Поля:
- type: "kitchen" (кухня, ас үй), "wardrobe" (шкаф), "tv" (тв-зона),
  "chest" (комод), "office" (кабинет, жұмыс үстелі),
  "bedroom" (жатын бөлме, кереует).
- layout: "corner" (угловая, Г-образная, две стены, бұрыш) или "straight"
  (прямая, одна стена). Для tv и bedroom всегда "straight".
- lengthA: длина основной стены в мм (целое). "3 метра" -> 3000. Если не
  сказано - 3000.
- lengthB: длина второй стены в мм для угловой; иначе null.
- sink: нужна ли мойка (только кухня). По умолчанию true для кухни.
- upper: нужен ли верхний ряд шкафов. По умолчанию true для кухни, false для
  остальных.
- appliances: встроенная техника и пенал-колонны (холодильник, духовка,
  посудомойка). По умолчанию true для кухни, false для остальных.

Слушай клиента: "без верхних" -> upper=false, "без техники" -> appliances=false,
"с посудомойкой" -> appliances=true. Длины бери из чисел в тексте.`

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'layout', 'lengthA', 'lengthB', 'sink', 'upper', 'appliances'],
  properties: {
    type: { type: 'string', enum: ['kitchen', 'wardrobe', 'tv', 'chest', 'office', 'bedroom'] },
    layout: { type: 'string', enum: ['straight', 'corner'] },
    lengthA: { type: 'integer' },
    lengthB: { type: ['integer', 'null'] },
    sink: { type: 'boolean' },
    upper: { type: 'boolean' },
    appliances: { type: 'boolean' },
  },
} as const

export async function POST(request: Request): Promise<Response> {
  const denied = await aiAccess('text')
  if (denied) return denied
  let prompt: string
  try {
    const body = (await request.json()) as { prompt?: unknown }
    prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }
  if (!prompt) {
    return Response.json({ error: 'Опишите мебель словами.' }, { status: 400 })
  }
  if (!process.env['OPENAI_API_KEY']) {
    return Response.json(
      { error: 'OPENAI_API_KEY не задан. Опишите параметры вручную или добавьте ключ.' },
      { status: 503 },
    )
  }

  const client = new OpenAI()
  let raw: string
  try {
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM,
      input: prompt,
      text: { format: { type: 'json_schema', name: 'generator_options', strict: true, schema: RESPONSE_SCHEMA } },
    })
    raw = response.output_text
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const message =
        error.status === 401 ? 'Ключ OPENAI_API_KEY отклонён.'
        : error.status === 429 ? 'Слишком много запросов, попробуйте через минуту.'
        : `Ошибка API (${error.status}).`
      return Response.json({ error: message }, { status: error.status ?? 502 })
    }
    throw error
  }

  let parsed: StageBriefOptions
  try {
    parsed = JSON.parse(raw) as StageBriefOptions
  } catch {
    return Response.json({ error: 'Модель вернула ответ не по форме. Повторите.' }, { status: 502 })
  }
  return Response.json({ options: sanitizeGeneratedOptions(parsed) })
}
