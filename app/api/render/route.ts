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
 *    жүрмейді: тек батырма басылғанда. Бағасы (баптау болса) жауапта келеді.
 *
 * Промпт ЖОБАНЫҢ нақты материалдарынан құралады (`src/core/render/prompt.ts`):
 * клиент `renderMaterialsFromPanels` пен `renderStagingOf` нәтижесін жібереді,
 * ал ережелер мәтінін тек сервер жазады.
 *
 * Дене (`RenderRequestSchema`): image (PNG data URL), aspect (1:1 | 16:9 |
 * 3:4 | 9:16), referenceMode (scene | cameraReference) + reference (бөлме
 * фотосы), style, hint, materials, staging, projectId. Жауап: image, frame
 * (size + crop), usage, cost (тиын, баптау болса), history (аккаунт пен
 * projectId болса сақталған жазба).
 */

import OpenAI from 'openai'
import { cloudOff } from '@/lib/server/cloud'
import { addRenderRecord } from '@/lib/server/renderHistory'
import type { RenderHistoryRecord } from '@/lib/server/renderHistory'
import { currentAccount } from '@/lib/server/session'
import { ConfigValidationError } from '@/src/core/errors'
import { estimateRenderCost, readRenderCostRates } from '@/src/core/render/cost'
import type { RenderUsage } from '@/src/core/render/cost'
import { RENDER_HINT_MAX, RenderRequestSchema, buildRenderPrompt } from '@/src/core/render/prompt'

const MODEL = process.env['OPENAI_IMAGE_MODEL'] ?? 'gpt-image-1'
/** Кірістің шегі: 3D скриншоты мен бөлме фотосы әдетте 1–3 МБ. */
const MAX_BYTES = 8 * 1024 * 1024

function decode(dataUrl: string): { bytes: Buffer; mime: string } {
  const comma = dataUrl.indexOf(',')
  return { bytes: Buffer.from(dataUrl.slice(comma + 1), 'base64'), mime: dataUrl.slice(5, dataUrl.indexOf(';')) }
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env['OPENAI_API_KEY']
  if (!key) {
    return Response.json({ error: 'ИИ-рендер не настроен: нет ключа OpenAI' }, { status: 503 })
  }

  const raw = (await request.json().catch(() => null)) as unknown
  const parsed = RenderRequestSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.join('.') || 'body'
    const message = field === 'image' ? 'Нужен снимок сцены' : `Неверное поле ${field}: ${issue?.message ?? ''}`
    return Response.json({ error: message, field }, { status: 400 })
  }
  const body = parsed.data

  const scene = decode(body.image)
  const reference = body.reference ? decode(body.reference) : null
  if (scene.bytes.byteLength > MAX_BYTES || (reference?.bytes.byteLength ?? 0) > MAX_BYTES) {
    return Response.json({ error: 'Снимок слишком большой', field: reference && reference.bytes.byteLength > MAX_BYTES ? 'reference' : 'image' },
      { status: 413 })
  }

  let rates
  try {
    rates = readRenderCostRates(process.env)
  } catch (cause) {
    // Баптау қатесі — сервердің қатесі, клиенттің емес; бірақ рендерді тоқтатпаймыз.
    console.error('render cost rates:', cause)
    rates = null
  }

  const prompt = buildRenderPrompt({
    materials: body.materials,
    staging: body.staging,
    aspect: body.aspect,
    reference: body.referenceMode,
    style: body.style,
    hint: body.hint?.slice(0, RENDER_HINT_MAX),
  })

  let b64: string | undefined
  let usage: RenderUsage | null = null
  try {
    const openai = new OpenAI({ apiKey: key })
    // `File` — Node 20+ ішінде бар, қосымша тәуелділік керек емес.
    const sceneFile = new File([scene.bytes as unknown as BlobPart], 'scene.png', { type: 'image/png' })
    const images = reference
      ? [sceneFile, new File([reference.bytes as unknown as BlobPart], `room.${reference.mime.split('/')[1]}`, { type: reference.mime })]
      : sceneFile
    const result = await openai.images.edit({
      model: MODEL,
      image: images,
      prompt: prompt.prompt,
      size: prompt.size,
      quality: 'high',
    })
    b64 = result.data?.[0]?.b64_json
    if (result.usage) {
      usage = {
        inputTextTokens: result.usage.input_tokens_details.text_tokens,
        inputImageTokens: result.usage.input_tokens_details.image_tokens,
        outputTokens: result.usage.output_tokens,
      }
    }
  } catch (error) {
    // Қате мәтіні пайдаланушыға шығады, сондықтан ол ТҮСІНІКТІ болуы керек.
    const message = error instanceof Error ? error.message : 'неизвестная ошибка'
    return Response.json({ error: `ИИ-рендер не получился: ${message}` }, { status: 502 })
  }
  if (!b64) return Response.json({ error: 'Модель не вернула изображение' }, { status: 502 })

  let cost = null
  try {
    cost = estimateRenderCost(usage, rates)
  } catch (cause) {
    if (!(cause instanceof ConfigValidationError)) throw cause
    console.error('render cost:', cause)
  }

  let history: RenderHistoryRecord | null = null
  if (body.projectId && !cloudOff()) {
    const account = await currentAccount()
    if (account) {
      history = addRenderRecord(account, body.projectId, {
        aspect: body.aspect,
        referenceMode: body.referenceMode,
        style: body.style ?? null,
        hint: body.hint?.slice(0, RENDER_HINT_MAX) ?? null,
        model: MODEL,
        promptVersion: prompt.version,
        size: prompt.size,
        crop: prompt.crop,
        usage,
        cost,
      }, Buffer.from(b64, 'base64'))
    }
  }

  return Response.json({
    image: `data:image/png;base64,${b64}`,
    frame: { aspect: prompt.aspect, size: prompt.size, crop: prompt.crop },
    usage,
    cost,
    history,
  })
}
