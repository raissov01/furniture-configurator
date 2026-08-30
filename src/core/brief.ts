/**
 * «Техзадание → конфиг» аралық қабаты (B фаза).
 *
 * Чат-бот НАҚТЫ `CabinetConfig` жазбайды. Ол осындағы ЖАЙПАҚ `CabinetBrief`
 * пішінін толтырады, ал `briefToCabinet()` оны конфигке айналдырады.
 * Себебі:
 *   1. Модель кромка саясатын, панель рөлін немесе id-лерді ойлап таппауы керек —
 *      олар материалдан және ядродан шығады.
 *   2. Пішін жайпақ әрі шағын болса, structured output сенімді толтырылады.
 *   3. Осы функция ТАЗА әрі тестелетін: модельдің шығысы дұрыс па екенін
 *      желіге шықпай тексереміз.
 *
 * Жарамсыз бриф ҮНСІЗ ТҮЗЕТІЛМЕЙДІ — ол `ConfigValidationError` лақтырады.
 * Клиентке «жиналмайтын» шкаф ұсынғаннан гөрі, вариантты мүлде көрсетпеген
 * жақсы (шақырушы жағы қатені ұстап, сол вариантты тастайды).
 */

import { z } from 'zod'
import { ConfigValidationError } from './errors'
import type { CabinetConfig, Catalog, Section } from './types'

/** generateCabinet-тегі шектеулермен БІРДЕЙ болуы керек. */
export const BRIEF_LIMITS = {
  dimension: { min: 100, max: 4000 },
  sections: { min: 1, max: 12 },
  shelves: { min: 0, max: 20 },
  fronts: { min: 0, max: 8 },
} as const

export const BriefSectionSchema = z.object({
  widthMode: z.enum(['fixed', 'flex']),
  /** widthMode === 'fixed' болғанда ғана оқылады. */
  width: z.number().int().nullable(),
  shelfCount: z.number().int(),
  shelfKind: z.enum(['adjustable', 'fixed']),
  frontCount: z.number().int(),
  frontMount: z.enum(['overlay', 'inset']),
})

export const CabinetBriefSchema = z.object({
  /** Клиентке көрсетілетін атау: «Шкаф в прихожую, 3 секции». */
  name: z.string().min(1),
  /** Осы вариант неге дәл осындай — бір сөйлем. Карточкада тұрады. */
  rationale: z.string().min(1),
  height: z.number().int(),
  width: z.number().int(),
  depth: z.number().int(),
  construction: z.enum(['sidesOverlay', 'topBottomOverlay']),
  back: z.enum(['overlay', 'groove']),
  carcassMaterialId: z.string().min(1),
  frontMaterialId: z.string().min(1),
  backMaterialId: z.string().min(1),
  sections: z.array(BriefSectionSchema),
})

export type BriefSection = z.infer<typeof BriefSectionSchema>
export type CabinetBrief = z.infer<typeof CabinetBriefSchema>

export const VariantsResponseSchema = z.object({
  variants: z.array(CabinetBriefSchema),
})

function requireRange(field: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value)) {
    throw new ConfigValidationError(field, `${value} — бүтін сан емес`, 'бүтін сан')
  }
  if (value < min || value > max) {
    throw new ConfigValidationError(field, `${value}`, `${min}..${max}`)
  }
}

function requireMaterial(catalog: Catalog, field: string, id: string): void {
  if (!catalog.materials.some((m) => m.id === id)) {
    throw new ConfigValidationError(
      field,
      `материал табылмады: "${id}"`,
      catalog.materials.map((m) => m.id).join(' | '),
    )
  }
}

/**
 * Бриф → конфиг. Кромка ЖИЫНТЫҒЫ корпус материалынан алынады (§4.1) —
 * модель оны таңдамайды.
 */
export function briefToCabinet(brief: CabinetBrief, catalog: Catalog, id = 'cabinet-ai'): CabinetConfig {
  requireRange('height', brief.height, BRIEF_LIMITS.dimension.min, BRIEF_LIMITS.dimension.max)
  requireRange('width', brief.width, BRIEF_LIMITS.dimension.min, BRIEF_LIMITS.dimension.max)
  requireRange('depth', brief.depth, BRIEF_LIMITS.dimension.min, BRIEF_LIMITS.dimension.max)

  if (brief.sections.length < BRIEF_LIMITS.sections.min || brief.sections.length > BRIEF_LIMITS.sections.max) {
    throw new ConfigValidationError(
      'sections',
      `${brief.sections.length} секция`,
      `${BRIEF_LIMITS.sections.min}..${BRIEF_LIMITS.sections.max}`,
    )
  }

  requireMaterial(catalog, 'carcassMaterialId', brief.carcassMaterialId)
  requireMaterial(catalog, 'frontMaterialId', brief.frontMaterialId)
  requireMaterial(catalog, 'backMaterialId', brief.backMaterialId)

  const carcass = catalog.materials.find((m) => m.id === brief.carcassMaterialId)!
  if (!carcass.defaultEdging) {
    throw new ConfigValidationError('edging', `материалда defaultEdging жоқ: ${carcass.id}`)
  }

  const sections: Section[] = brief.sections.map((s, i) => {
    requireRange(`sections[${i}].shelfCount`, s.shelfCount, BRIEF_LIMITS.shelves.min, BRIEF_LIMITS.shelves.max)
    requireRange(`sections[${i}].frontCount`, s.frontCount, BRIEF_LIMITS.fronts.min, BRIEF_LIMITS.fronts.max)

    if (s.widthMode === 'fixed') {
      if (s.width === null) {
        throw new ConfigValidationError(`sections[${i}].width`, 'fixed секцияда ен көрсетілмеген', 'мм, бүтін сан')
      }
      requireRange(`sections[${i}].width`, s.width, BRIEF_LIMITS.dimension.min, BRIEF_LIMITS.dimension.max)
    }

    return {
      id: `s${i + 1}`,
      widthMode: s.widthMode,
      // exactOptionalPropertyTypes: flex секцияда өріс МҮЛДЕ болмауы керек.
      ...(s.widthMode === 'fixed' ? { width: s.width as number } : {}),
      contents:
        s.shelfCount > 0
          ? [{ kind: 'shelves' as const, count: s.shelfCount, shelfKind: s.shelfKind }]
          : [{ kind: 'empty' as const }],
      fronts: s.frontCount > 0 ? { count: s.frontCount, mount: s.frontMount } : null,
    }
  })

  return {
    id,
    name: brief.name,
    construction: brief.construction,
    height: brief.height,
    width: brief.width,
    depth: brief.depth,
    carcassMaterialId: brief.carcassMaterialId,
    frontMaterialId: brief.frontMaterialId,
    backMaterialId: brief.backMaterialId,
    back: { mode: brief.back },
    sections,
    edging: { ...carcass.defaultEdging },
  }
}
