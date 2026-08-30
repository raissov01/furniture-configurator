/**
 * Чат-бот: техзадание → бірнеше конструкция варианты (B фаза).
 *
 * ЕСКЕРТПЕ: модель провайдері — OpenAI (пайдаланушының сұрауы бойынша,
 * кілт `.env.local` ішінде). Модель `CabinetConfig` жазбайды — ол тек
 * `CabinetBrief` толтырады, ал оны конфигке ЯДРО айналдырады
 * (`briefToCabinet`). Сондықтан модель кромка, панель өлшемі немесе присадка
 * туралы ештеңе ойлап таба алмайды: ол «қандай шкаф» дегенді ғана айтады,
 * «қалай кесіледі» дегенді ядро есептейді.
 */

import OpenAI from 'openai'
import {
  BRIEF_LIMITS,
  CabinetBriefSchema,
  ConfigValidationError,
  SEED_CATALOG,
  briefToCabinet,
  generateCabinet,
} from '@/src/core/index'
import type { CabinetBrief, CabinetConfig } from '@/src/core/index'

/** Неше вариант сұраймыз. Көбейтсе таңдау қиындайды, азайтса салыстыру жоғалады. */
const VARIANT_COUNT = 3

const MODEL = process.env['OPENAI_MODEL'] ?? 'gpt-5.4'

const materialIds = SEED_CATALOG.materials.map((m) => m.id)
const materialLines = SEED_CATALOG.materials
  .map((m) => `- ${m.id} — ${m.name} (${m.thickness} мм${m.hasGrain ? ', с текстурой' : ''})`)
  .join('\n')

const SYSTEM = `Ты — конструктор корпусной мебели из ЛДСП для цеха в Казахстане.
Клиент описывает задачу словами (на казахском, русском или вперемешку).
Ты предлагаешь ровно ${VARIANT_COUNT} РАЗНЫХ варианта корпуса.

Порядок размеров ВСЕГДА H × W × D (высота, ширина, глубина), в миллиметрах,
целыми числами.

Что ты можешь описать:
- один прямоугольный корпус;
- вертикальные перегородки — они получаются САМИ из количества секций
  (перегородок = секций − 1), отдельно их заказывать не нужно;
  СЕКЦИИ ИДУТ ТОЛЬКО СЛЕВА НАПРАВО. Это вертикальные отсеки во всю высоту
  корпуса. Разделить корпус по высоте (внизу закрытый отсек, сверху открытый)
  конструктор ПОКА НЕ УМЕЕТ — не предлагай такое и не описывай словами
  "внизу/сверху", клиент увидит совсем другое;
- в каждой секции: полки (0..${BRIEF_LIMITS.shelves.max}) и фасады на петлях (0..${BRIEF_LIMITS.fronts.max});
- ширина секции: "flex" (делит остаток поровну с другими flex) или "fixed"
  (точная в мм; тогда width обязателен, иначе width = null).

ВАЖНО про ширину секций. Почти всегда используй "flex" — конструктор сам
разделит внутреннее пространство. "fixed" бери только если клиент назвал
ширину конкретного отсека. Ширина секции — это ЧИСТЫЙ ПРОСВЕТ между
стенками, а не доля внешней ширины: боковины и каждая перегородка съедают
по 16 мм. Поэтому сумма "fixed" ширин НИКОГДА не должна равняться внешней W —
она заметно меньше. Если сомневаешься, ставь "flex" и width = null.

Чего в конструкторе ПОКА НЕТ — не предлагай и не притворяйся, что есть:
выдвижные ящики, штанга для одежды, двери-купе, цоколь и ножки, столешница,
угловые и скошенные корпуса, подсветка.

Материалы (используй ТОЛЬКО эти id):
${materialLines}

Правила:
- backMaterialId — только ХДФ 3 мм (задняя стенка).
- Габариты в пределах ${BRIEF_LIMITS.dimension.min}..${BRIEF_LIMITS.dimension.max} мм, секций ${BRIEF_LIMITS.sections.min}..${BRIEF_LIMITS.sections.max}.
- Кухонные модули обычно белые, шкафы и стеллажи — под дерево, но слушай клиента.
- Типовые ориентиры: кухня нижняя H720 D500, кухня верхняя H720 D300,
  шкаф H2000-2400 D450-600, стеллаж D300. Это ориентиры, а не закон.
- Не выдумывай предельный пролёт полки в миллиметрах. Если секция выходит
  широкой для своей нагрузки — поставь ещё одну перегородку.
- Варианты должны РЕАЛЬНО отличаться: например, экономный (меньше деталей),
  сбалансированный и более функциональный (больше секций). Не давай три
  почти одинаковых корпуса.
- name — короткое название на языке клиента. rationale — ОДНО предложение:
  чем этот вариант отличается и кому подходит.`

/**
 * JSON Schema қолмен жазылған (zod-тан автоматты аударылмайды): strict режимде
 * әр өрісте `additionalProperties: false` және толық `required` болуы шарт,
 * ал автоаудармашылар мұны үнсіз бұзады. Пішін `CabinetBriefSchema`-мен
 * бірдей — жауап сол zod схемасымен қайта тексеріледі.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['variants'],
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name', 'rationale', 'height', 'width', 'depth', 'construction', 'back',
          'carcassMaterialId', 'frontMaterialId', 'backMaterialId', 'sections',
        ],
        properties: {
          name: { type: 'string' },
          rationale: { type: 'string' },
          height: { type: 'integer' },
          width: { type: 'integer' },
          depth: { type: 'integer' },
          construction: { type: 'string', enum: ['sidesOverlay', 'topBottomOverlay'] },
          back: { type: 'string', enum: ['overlay', 'groove'] },
          carcassMaterialId: { type: 'string', enum: materialIds },
          frontMaterialId: { type: 'string', enum: materialIds },
          backMaterialId: { type: 'string', enum: materialIds },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['widthMode', 'width', 'shelfCount', 'shelfKind', 'frontCount', 'frontMount'],
              properties: {
                widthMode: { type: 'string', enum: ['fixed', 'flex'] },
                width: { type: ['integer', 'null'] },
                shelfCount: { type: 'integer' },
                shelfKind: { type: 'string', enum: ['adjustable', 'fixed'] },
                frontCount: { type: 'integer' },
                frontMount: { type: 'string', enum: ['overlay', 'inset'] },
              },
            },
          },
        },
      },
    },
  },
} as const

type Variant = { brief: CabinetBrief; cabinet: CabinetConfig; panelCount: number }
type Dropped = { name: string; reason: string }

/**
 * Пайдаланушы өрістермен қойған шектеулер. Олар МОДЕЛЬГЕ АЙТЫЛАДЫ, әрі
 * жауап келгеннен кейін ҮСТІНЕН БЕКІТІЛЕДІ: адам 1800 деп жазса, шкаф 1800
 * болуы керек — модельдің «жақсырақ біледі» деп өзгертуіне жол жоқ.
 */
type Constraints = {
  kind?: string | undefined
  height?: number | undefined
  width?: number | undefined
  depth?: number | undefined
  materialId?: string | undefined
}

const dimension = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const rounded = Math.round(value)
  return rounded >= BRIEF_LIMITS.dimension.min && rounded <= BRIEF_LIMITS.dimension.max
    ? rounded
    : undefined
}

function readConstraints(raw: unknown): Constraints {
  const c = (raw ?? {}) as Record<string, unknown>
  const materialId = typeof c['materialId'] === 'string' && materialIds.includes(c['materialId'])
    ? c['materialId']
    : undefined
  return {
    kind: typeof c['kind'] === 'string' && c['kind'].length <= 60 ? c['kind'] : undefined,
    height: dimension(c['height']),
    width: dimension(c['width']),
    depth: dimension(c['depth']),
    materialId,
  }
}

/** Шектеулерді модель оқитын мәтінге айналдыру. */
function constraintsText(c: Constraints): string {
  const lines: string[] = []
  if (c.kind) lines.push(`Тип изделия: ${c.kind}.`)
  const dims = [
    c.height ? `высота ${c.height}` : null,
    c.width ? `ширина ${c.width}` : null,
    c.depth ? `глубина ${c.depth}` : null,
  ].filter(Boolean)
  if (dims.length > 0) lines.push(`Заданные размеры, мм: ${dims.join(', ')}. Их менять нельзя.`)
  if (c.materialId) {
    const m = SEED_CATALOG.materials.find((x) => x.id === c.materialId)
    lines.push(`Материал корпуса и фасадов: ${c.materialId}${m ? ` (${m.name})` : ''}. Другой не предлагай.`)
  }
  return lines.length > 0 ? `\n\nОбязательные условия:\n${lines.join('\n')}` : ''
}

/** Шектеулерді брифке бекіту — сұрағанын алу керек, «жуықтап» емес. */
function applyConstraints(brief: CabinetBrief, c: Constraints): CabinetBrief {
  return {
    ...brief,
    ...(c.height ? { height: c.height } : {}),
    ...(c.width ? { width: c.width } : {}),
    ...(c.depth ? { depth: c.depth } : {}),
    ...(c.materialId ? { carcassMaterialId: c.materialId, frontMaterialId: c.materialId } : {}),
  }
}

/** Модельден бір жауап алу. `repair` берілсе — өткен қатені түзетуді сұрайды. */
async function askModel(
  client: OpenAI,
  prompt: string,
  repair?: { previous: string; errors: Dropped[] },
): Promise<string> {
  const input = repair
    ? `${prompt}

Твой предыдущий ответ не прошёл проверку конструктора:
${JSON.stringify(repair.previous)}

Ошибки:
${repair.errors.map((d) => `- "${d.name}": ${d.reason}`).join('\n')}

Исправь и верни ${VARIANT_COUNT} варианта заново.`
    : prompt

  const response = await client.responses.create({
    model: MODEL,
    instructions: SYSTEM,
    input,
    text: {
      format: { type: 'json_schema', name: 'cabinet_variants', strict: true, schema: RESPONSE_SCHEMA },
    },
  })
  return response.output_text
}

/** JSON → тексерілген брифтер. Пішіні бұзылса null. */
function parseBriefs(raw: string): CabinetBrief[] | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    const check = CabinetBriefSchema.array().safeParse((parsed as { variants?: unknown }).variants)
    return check.success ? check.data : null
  } catch {
    return null
  }
}

/**
 * Брифтерді конфигке айналдыру. Жарамсызы ҮНСІЗ ТҮЗЕТІЛМЕЙДІ — ол тізімнен
 * шығып, себебі бөлек қайтарылады: жиналмайтын шкафты клиентке көрсеткеннен
 * гөрі, екі вариант көрсеткен дұрыс.
 */
function toVariants(briefs: CabinetBrief[], constraints: Constraints): { variants: Variant[]; dropped: Dropped[] } {
  const variants: Variant[] = []
  const dropped: Dropped[] = []
  briefs.map((b) => applyConstraints(b, constraints)).forEach((brief, i) => {
    try {
      const cabinet = briefToCabinet(brief, SEED_CATALOG, `cabinet-ai-${i + 1}`)
      const panels = generateCabinet(cabinet, SEED_CATALOG)
      variants.push({ brief, cabinet, panelCount: panels.length })
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        dropped.push({ name: brief.name, reason: error.message })
        return
      }
      throw error
    }
  })
  return { variants, dropped }
}

function apiErrorResponse(error: unknown): Response {
  if (error instanceof OpenAI.APIError) {
    const message =
      error.status === 401 ? 'Ключ OPENAI_API_KEY отклонён.'
      : error.status === 429 ? 'Слишком много запросов, попробуйте через минуту.'
      : `Ошибка API (${error.status}).`
    return Response.json({ error: message }, { status: error.status ?? 502 })
  }
  throw error
}

export async function POST(request: Request): Promise<Response> {
  let prompt: string
  let constraints: Constraints
  try {
    const body = (await request.json()) as { prompt?: unknown; constraints?: unknown } | null
    const value = body?.prompt
    constraints = readConstraints(body?.constraints)
    const hasConstraints = Object.values(constraints).some((v) => v !== undefined)
    if (typeof value !== 'string' || (value.trim().length === 0 && !hasConstraints)) {
      return Response.json({ error: 'Опишите задачу текстом или задайте параметры.' }, { status: 400 })
    }
    prompt = `${typeof value === 'string' ? value.trim().slice(0, 4000) : ''}${constraintsText(constraints)}`
  } catch {
    return Response.json({ error: 'Некорректный запрос.' }, { status: 400 })
  }

  if (!process.env['OPENAI_API_KEY']) {
    return Response.json(
      { error: 'OPENAI_API_KEY не задан. Добавьте ключ в .env.local и перезапустите сервер.' },
      { status: 503 },
    )
  }

  const client = new OpenAI()

  let raw: string
  try {
    raw = await askModel(client, prompt)
  } catch (error) {
    return apiErrorResponse(error)
  }

  let briefs = parseBriefs(raw)
  if (!briefs) {
    return Response.json({ error: 'Модель вернула ответ не по форме. Повторите запрос.' }, { status: 502 })
  }

  let { variants, dropped } = toVariants(briefs, constraints)

  // Бір рет қана қайта сұраймыз: қатенің өзін модельге қайтарып беру
  // «fixed секциялардың қосындысы сыймайды» деген типтік қатені жөндейді.
  // Екінші қайталау кешігуді екі есе арттырады да, пайдасы аз.
  if (dropped.length > 0 && variants.length < VARIANT_COUNT) {
    try {
      const retryRaw = await askModel(client, prompt, { previous: raw, errors: dropped })
      const retryBriefs = parseBriefs(retryRaw)
      if (retryBriefs) {
        const retry = toVariants(retryBriefs, constraints)
        if (retry.variants.length > variants.length) {
          variants = retry.variants
          dropped = retry.dropped
        }
      }
    } catch (error) {
      if (!(error instanceof OpenAI.APIError)) throw error
      // Қайталау сәтсіз болса, бірінші жүрістің нәтижесімен жалғаймыз.
    }
  }

  if (variants.length === 0) {
    return Response.json({ error: 'Ни один вариант не прошёл проверку конструктора.', dropped }, { status: 422 })
  }

  return Response.json({ variants, dropped })
}
