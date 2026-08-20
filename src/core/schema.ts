/**
 * Zod схемалары мен схема миграциясы.
 *
 * §7: жоба сақталғанда КОНФИГ сақталады, панель емес. Конфиг пішіні өзгереді,
 * бірақ сақталған жобалар сынбауы керек — сондықтан әр нұсқа өз схемасымен
 * тұрады, ал `parseProject` ескісін жаңасына көтереді.
 */

import { z } from 'zod'
import type { ProjectFile } from './types.js'

/** Өлшем: мм, бүтін, оң сан. */
const mm = z.number().int().positive()
/** Ақша: тиын, бүтін. Float ЕШҚАШАН. */
const minorUnits = z.number().int().nonnegative()

export const EdgePolicySchema = z.object({
  visibleFront: z.string().nullable(),
  visibleSecondary: z.string().nullable(),
  hidden: z.string().nullable(),
})

export const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thickness: z.number().positive(),
  sheetWidth: mm,
  sheetHeight: mm,
  hasGrain: z.boolean(),
  pricePerSheet: minorUnits,
  trimEdge: z.number().int().nonnegative(),
  defaultEdging: EdgePolicySchema.optional(),
})

export const EdgeBandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thickness: z.number().positive(),
  pricePerMeter: minorUnits,
})

export const ConstructionSettingsSchema = z.object({
  shelfGap: z.number().int().nonnegative(),
  shelfSetback: z.number().int().nonnegative(),
  frontGap: z.number().int().nonnegative(),
  backThickness: z.number().positive(),
  grooveDepth: z.number().int().nonnegative(),
  grooveInset: z.number().int().nonnegative(),
  minBandSubtract: z.number().nonnegative(),
  confirmatSpanForThird: mm,
}).partial()

const FrontsSchema = z.object({
  count: z.number().int().min(1).max(8),
  mount: z.enum(['overlay', 'inset']),
}).nullable()

const CabinetBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  construction: z.enum(['sidesOverlay', 'topBottomOverlay']),
  // Рет ӘРҚАШАН H × W × D.
  height: mm,
  width: mm,
  depth: mm,
  carcassMaterialId: z.string().min(1),
  frontMaterialId: z.string().min(1),
  backMaterialId: z.string().min(1),
  back: z.object({ mode: z.enum(['overlay', 'groove']) }),
  edging: EdgePolicySchema,
  settings: ConstructionSettingsSchema.optional(),
})

// ── schemaVersion 1 — секцияларға дейінгі пішін ──────────────────────────────

const CabinetV1Schema = CabinetBaseSchema.extend({
  shelves: z.object({
    count: z.number().int().min(0).max(20),
    kind: z.enum(['adjustable', 'fixed']),
  }),
  fronts: FrontsSchema,
})

export const ProjectFileV1Schema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  settings: ConstructionSettingsSchema.optional(),
  cabinets: z.array(CabinetV1Schema).min(1),
})

// ── schemaVersion 2 — көп секциялы (PHASE-2 A1) ──────────────────────────────

export const SectionContentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('shelves'),
    count: z.number().int().min(0).max(20),
    shelfKind: z.enum(['adjustable', 'fixed']),
  }),
  z.object({ kind: z.literal('empty') }),
])

export const SectionSchema = z.object({
  id: z.string().min(1),
  widthMode: z.enum(['fixed', 'flex']),
  width: mm.optional(),
  contents: z.array(SectionContentSchema),
  fronts: FrontsSchema.optional(),
}).refine((s) => s.widthMode !== 'fixed' || s.width !== undefined, {
  message: 'widthMode: "fixed" болса width міндетті',
  path: ['width'],
})

export const CabinetConfigSchema = CabinetBaseSchema.extend({
  sections: z.array(SectionSchema).min(1).max(12),
})

export const ProjectFileSchema = z.object({
  schemaVersion: z.literal(2),
  name: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  settings: ConstructionSettingsSchema.optional(),
  cabinets: z.array(CabinetConfigSchema).min(1),
})

export const CURRENT_SCHEMA_VERSION = 2

// ── Миграция ─────────────────────────────────────────────────────────────────

type ProjectV1 = z.infer<typeof ProjectFileV1Schema>

/**
 * v1 → v2: перегородкасыз кабинет = бір flex секция.
 * Нәтижесі миллиметрге дейін бұрынғымен бірдей болуы керек — оны
 * snapshot тесті қорғайды.
 */
export function migrateV1ToV2(project: ProjectV1): ProjectFile {
  return {
    ...project,
    schemaVersion: 2,
    cabinets: project.cabinets.map(({ shelves, fronts, ...cabinet }) => ({
      ...cabinet,
      sections: [
        {
          id: 's1',
          widthMode: 'flex' as const,
          contents: shelves.count > 0
            ? [{ kind: 'shelves' as const, count: shelves.count, shelfKind: shelves.kind }]
            : [{ kind: 'empty' as const }],
          fronts,
        },
      ],
    })),
  }
}

/**
 * Кез келген нұсқадағы жоба файлын оқып, ағымдағы пішінге келтіру.
 * Белгісіз нұсқа — үнсіз өтпейді, қате лақтырады.
 */
export function parseProject(raw: unknown): ProjectFile {
  const version = (raw as { schemaVersion?: unknown })?.schemaVersion
  switch (version) {
    case 1:
      return migrateV1ToV2(ProjectFileV1Schema.parse(raw))
    case 2:
      return ProjectFileSchema.parse(raw)
    default:
      throw new Error(
        `Белгісіз schemaVersion: ${String(version)}. Қолдау бар нұсқалар: 1, ${CURRENT_SCHEMA_VERSION}`,
      )
  }
}
