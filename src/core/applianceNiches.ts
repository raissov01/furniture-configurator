/** Өндіруші паспортындағы кіріктірілетін техника ұялары; H × W × D, мм. */
import { ConfigValidationError } from './errors'
import type { ApplianceKind } from './filling'

export type NicheRange = { min: number; max?: number }
export type ApplianceNicheModel = {
  id: string
  appliance: ApplianceKind
  article: string
  height: NicheRange
  width: NicheRange
  depthMin: number
  source: string
}

export const APPLIANCE_NICHE_MODELS: readonly ApplianceNicheModel[] = [
  // Bosch ресми spec sheet-тері: ұяның H × W × D өлшемі.
  { id: 'bosch-hbf113br0b', appliance: 'oven', article: 'HBF113BR0B',
    height: { min: 575, max: 597 }, width: { min: 560, max: 568 }, depthMin: 550,
    source: 'Bosch HBF113BR0B б.1,3 https://media3.bosch-home.com/Documents/specsheet/en-GB/HBF113BR0B.pdf' },
  { id: 'bosch-cbg7341b1', appliance: 'oven', article: 'CBG7341B1 (45 см)',
    height: { min: 450, max: 455 }, width: { min: 560, max: 568 }, depthMin: 550,
    source: 'Bosch CBG7341B1 б.1 https://media3.bosch-home.com/Documents/specsheet/de-DE/CBG7341B1.pdf' },
  { id: 'bosch-bfl524ms0b', appliance: 'microwave', article: 'BFL524MS0B (38 см)',
    height: { min: 362, max: 365 }, width: { min: 560, max: 568 }, depthMin: 300,
    source: 'Bosch BFL524MS0B б.2 https://media3.bosch-home.com/Documents/specsheet/en-GB/BFL524MS0B.pdf' },
  { id: 'bosch-cma583ms0b', appliance: 'microwave', article: 'CMA583MS0B (45 см)',
    height: { min: 450, max: 452 }, width: { min: 560, max: 568 }, depthMin: 550,
    source: 'Bosch CMA583MS0B б.2 https://media3.bosch-home.com/Documents/specsheet/en-GB/CMA583MS0B.pdf' },
  { id: 'bosch-smv4htx31e', appliance: 'dishwasher', article: 'SMV4HTX31E (60 см)',
    height: { min: 815, max: 875 }, width: { min: 600 }, depthMin: 550,
    source: 'Bosch SMV4HTX31E б.1 https://media3.bosch-home.com/Documents/specsheet/de-DE/SMV4HTX31E.pdf' },
  { id: 'bosch-spv2hkx42e', appliance: 'dishwasher', article: 'SPV2HKX42E (45 см)',
    height: { min: 815, max: 875 }, width: { min: 450 }, depthMin: 550,
    source: 'Bosch SPV2HKX42E б.1 https://media3.bosch-home.com/Documents/specsheet/de-DE/SPV2HKX42E.pdf' },
  { id: 'bosch-kin86vse0', appliance: 'fridge', article: 'KIN86VSE0 (177 см)',
    height: { min: 1775 }, width: { min: 560 }, depthMin: 550,
    source: 'Bosch KIN86VSE0 б.1,3 https://media3.bosch-home.com/Documents/specsheet/de-DE/KIN86VSE0.pdf' },
]

export function applianceNicheModel(id: string): ApplianceNicheModel {
  const found = APPLIANCE_NICHE_MODELS.find((model) => model.id === id)
  if (!found) throw new ConfigValidationError('appliance.modelId', id,
    APPLIANCE_NICHE_MODELS.map((model) => model.id).join(' | '))
  return found
}

export function validateApplianceNiche(
  model: ApplianceNicheModel,
  niche: { height: number; width: number; depth: number },
  field: string,
): void {
  const dimensions = [
    ['height', niche.height, model.height],
    ['width', niche.width, model.width],
    ['depth', niche.depth, { min: model.depthMin }],
  ] as const
  for (const [axis, value, range] of dimensions) {
    const max = 'max' in range ? range.max : undefined
    if (!Number.isInteger(value) || value < range.min || (max !== undefined && value > max)) {
      throw new ConfigValidationError(`${field}.${axis}`, `${value} мм`,
        `${max === undefined ? `≥ ${range.min}` : `${range.min}..${max}`} мм (${model.article})`)
    }
  }
}
