/**
 * Бір рендердің БАҒАСЫН бағалау, тиын (03g §1: «бір рендердің бағасын көрсету»).
 *
 * Провайдер (gpt-image) жауабында АҚША ЖОҚ — тек токен саны (`usage`).
 * Сондықтан баға цехтың/сервердің баптауындағы мөлшерлемемен есептеледі:
 *   - токенмен: 1 млн токенге тиын (кіріс мәтіні, кіріс суреті, шығыс бөлек);
 *   - немесе тіркелген: бір суретке тиын.
 * Мөлшерлеме берілмесе — баға БЕЛГІСІЗ (`null`), ойдан сан шығармаймыз.
 *
 * Дөңгелектеу: ЖОҒАРЫ, бүтін тиынға (бағалау — шығынның төменгі шегі емес,
 * цех «кем» деп алданбауы керек). Есеп BigInt-пен.
 */

import { ConfigValidationError } from '../errors'

export type RenderUsage = {
  inputTextTokens: number
  inputImageTokens: number
  outputTokens: number
}

export type RenderCostRates =
  | { kind: 'tokens'; inputTextPerMillion: number; inputImagePerMillion: number; outputPerMillion: number }
  | { kind: 'flat'; perImage: number }

export type RenderCost = { tiyn: number; basis: 'tokens' | 'flat' }

const ENV = {
  flat: 'RENDER_COST_TIYN_PER_IMAGE',
  text: 'RENDER_COST_TIYN_PER_MTOK_INPUT_TEXT',
  image: 'RENDER_COST_TIYN_PER_MTOK_INPUT_IMAGE',
  output: 'RENDER_COST_TIYN_PER_MTOK_OUTPUT',
} as const

function rate(env: Record<string, string | undefined>, key: string): number | undefined {
  const raw = env[key]
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ConfigValidationError(key, `«${raw}» — бүтін тиын емес`, '≥ 0, бүтін тиын')
  }
  return value
}

/**
 * Орта айнымалыларынан мөлшерлеме. Тіркелген баға басым; токен мөлшерлемесі
 * үшеуі бірге берілуі керек — біреуі жетіспесе, жартылай баға жалған болар еді.
 */
export function readRenderCostRates(env: Record<string, string | undefined>): RenderCostRates | null {
  const flat = rate(env, ENV.flat)
  if (flat !== undefined) return { kind: 'flat', perImage: flat }
  const text = rate(env, ENV.text)
  const image = rate(env, ENV.image)
  const output = rate(env, ENV.output)
  const given = [text, image, output].filter((v) => v !== undefined).length
  if (given === 0) return null
  if (given < 3) {
    throw new ConfigValidationError(ENV.output, 'токен мөлшерлемесінің үшеуі бірге берілуі керек',
      `${ENV.text}, ${ENV.image}, ${ENV.output}`)
  }
  return { kind: 'tokens', inputTextPerMillion: text!, inputImagePerMillion: image!, outputPerMillion: output! }
}

export function estimateRenderCost(usage: RenderUsage | null, rates: RenderCostRates | null): RenderCost | null {
  if (!rates) return null
  if (rates.kind === 'flat') return { tiyn: rates.perImage, basis: 'flat' }
  if (!usage) return null
  for (const [key, value] of Object.entries(usage)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new ConfigValidationError(`usage.${key}`, `${value}`, '≥ 0, бүтін токен')
    }
  }
  const micro = BigInt(usage.inputTextTokens) * BigInt(rates.inputTextPerMillion)
    + BigInt(usage.inputImageTokens) * BigInt(rates.inputImagePerMillion)
    + BigInt(usage.outputTokens) * BigInt(rates.outputPerMillion)
  const million = 1_000_000n
  return { tiyn: Number((micro + million - 1n) / million), basis: 'tokens' }
}
