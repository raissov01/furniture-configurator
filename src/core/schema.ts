/**
 * Zod схемалары мен схема миграциясы.
 *
 * §7: жоба сақталғанда КОНФИГ сақталады, панель емес. Конфиг пішіні өзгереді,
 * бірақ сақталған жобалар сынбауы керек — сондықтан әр нұсқа өз схемасымен
 * тұрады, ал `parseProject` ескісін жаңасына көтереді.
 */

import { z } from 'zod'
import { ApplianceKindSchema, FillingKindSchema } from './filling'
import { HandleSpecSchema } from './fittings'
import { MillingSpecSchema } from './milling'
import type { ProjectFile } from './types'

/** Өлшем: мм, бүтін, оң сан. */
const mm = z.number().int().positive()
/** Ақша: тиын, бүтін. Float ЕШҚАШАН. */
const minorUnits = z.number().int().nonnegative()

export const EdgePolicySchema = z.object({
  visibleFront: z.string().nullable(),
  visibleSecondary: z.string().nullable(),
  hidden: z.string().nullable(),
})

export const DecorFinishSchema = z.enum(['matte', 'satin', 'gloss', 'stone', 'metal'])

export const DecorSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(['solid', 'wood']),
  // ЕРІКТІ: ескі жобада жоқ, сондықтан бұл өріс қосылса да schemaVersion
  // көтерілмейді (types.ts-тегі Decor.finish түсінігі).
  finish: DecorFinishSchema.optional(),
  mapUrl: z.string().url().optional(),
  mapSizeMm: z.object({ x: mm, y: mm }).optional(),
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
  decor: DecorSchema.optional(),
  /** Тақта (постформинг): раскройға кірмейді, сметаға метрмен. */
  slab: z.object({
    stockLengths: z.array(mm).min(1),
    pricePerMeter: minorUnits,
  }).optional(),
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
  plinthSetback: z.number().int().nonnegative(),
  frontGap: z.number().int().nonnegative(),
  backThickness: z.number().positive(),
  grooveDepth: z.number().int().nonnegative(),
  grooveInset: z.number().int().nonnegative(),
  minBandSubtract: z.number().nonnegative(),
  confirmatSpanForThird: mm.nullable(),
  shelfPinDatum: z.number().int().nonnegative(),
  slidingDoorOverlap: z.number().int().nonnegative(),
  slidingTrackTopSpace: z.number().int().nonnegative(),
  slidingTrackBottomSpace: z.number().int().nonnegative(),
  slidingProfileSide: z.number().int().nonnegative(),
  slidingProfileTopBottom: z.number().int().nonnegative(),
  drawerRunnerGap: z.number().int().nonnegative(),
  drawerBackGap: z.number().int().nonnegative(),
  drawerBoxDrop: z.number().int().nonnegative(),
}).partial()

const FrontGapsSchema = z.object({
  between: z.number().int().min(0).max(50).optional(),
  left: z.number().int().min(0).max(50).optional(),
  right: z.number().int().min(0).max(50).optional(),
  top: z.number().int().min(0).max(50).optional(),
  bottom: z.number().int().min(0).max(50).optional(),
})

const FrontsSchema = z.object({
  count: z.number().int().min(1).max(8),
  mount: z.enum(['overlay', 'inset']),
  // Екеуі де ЕРІКТІ: ілгек жүйесі мен тұтқа кейін қосылды, ал бұрын
  // сақталған жобаларда бұл өрістер жоқ. Болмаса цехтың әдепкісі алынады.
  hingeSystemId: z.string().min(1).optional(),
  handle: HandleSpecSchema.nullable().optional(),
  milling: MillingSpecSchema.nullable().optional(),
  opening: z.enum(['auto', 'left', 'right', 'up']).optional(),
  gaps: FrontGapsSchema.optional(),
}).nullable()

const RailSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['carcass', 'facade', 'filler']),
  position: z.enum(['top', 'bottom', 'left', 'right']),
  materialId: z.string().min(1).optional(),
  width: z.number().positive(),
  inset: z.number().min(0),
  depthOffset: z.number().min(0),
})

const CabinetBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  construction: z.enum(['sidesOverlay', 'topBottomOverlay']),
  /**
   * Крышка мен дноның бекітілуі. ЕРІКТІ: болмаса `construction`-нан шығады,
   * сондықтан ескі жоба сол күйінде оқылады әрі сол панельдерді береді.
   */
  mounts: z.object({
    top: z.enum(['inset', 'overlay', 'overlayLeft', 'overlayRight']).optional(),
    bottom: z.enum(['inset', 'overlay', 'overlayLeft', 'overlayRight']).optional(),
  }).optional(),
  // Рет ӘРҚАШАН H × W × D.
  height: mm,
  width: mm,
  depth: mm,
  carcassMaterialId: z.string().min(1),
  frontMaterialId: z.string().min(1),
  backMaterialId: z.string().min(1),
  back: z.object({
    mode: z.enum(['overlay', 'groove', 'inset', 'none']),
    /** Вкладной арт қабырғаның арт жиектен шегінісі, мм. ЕРІКТІ (әдепкі 0). */
    inset: z.number().int().min(0).max(200).optional(),
  }),
  edging: EdgePolicySchema,
  settings: ConstructionSettingsSchema.optional(),
  corner: z.object({ depthAtRight: mm }).optional(),
  rails: z.array(RailSchema).optional(),
  backsplash: z.object({
    materialId: z.string().min(1).optional(),
    height: z.number().positive(),
  }).optional(),
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

const bandHeight = mm.optional()

export const SectionContentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('shelves'),
    count: z.number().int().min(0).max(20),
    shelfKind: z.enum(['adjustable', 'fixed']),
    height: bandHeight,
    /** Ұяның шетінен шегіністер. ЕРІКТІ — ескі жобада жоқ, мәні 0. */
    insets: z.object({
      left: z.number().int().min(0).max(1000).optional(),
      right: z.number().int().min(0).max(1000).optional(),
      front: z.number().int().min(0).max(1000).optional(),
      back: z.number().int().min(0).max(1000).optional(),
    }).optional(),
    /** Нақты биіктіктер, мм. Берілсе, `count` еленбейді. */
    at: z.array(z.number().int().min(0)).max(20).optional(),
  }),
  z.object({
    kind: z.literal('drawers'),
    count: z.number().int().min(1).max(8),
    height: bandHeight,
    gaps: FrontGapsSchema.optional(),
    frontMount: z.enum(['overlay', 'inset']).optional(),
    fillers: z.object({
      left: z.number().int().min(0).max(200).optional(),
      right: z.number().int().min(0).max(200).optional(),
    }).optional(),
    // ЕРІКТІ: ескі жобада жоқ — ол кезде цехтың әдепкі тұтқасы.
    handle: HandleSpecSchema.nullable().optional(),
  }),
  z.object({
    kind: z.literal('stand'),
    count: z.number().int().min(1).max(10),
    height: bandHeight,
    at: z.array(z.number().int().min(0)).max(10).optional(),
    insets: z.object({
      top: z.number().int().min(0).max(1000).optional(),
      bottom: z.number().int().min(0).max(1000).optional(),
      front: z.number().int().min(0).max(1000).optional(),
      back: z.number().int().min(0).max(1000).optional(),
    }).optional(),
  }),
  z.object({ kind: z.literal('rod'), height: bandHeight }),
  z.object({ kind: z.literal('filling'), filling: FillingKindSchema, height: bandHeight }),
  z.object({ kind: z.literal('appliance'), appliance: ApplianceKindSchema, height: bandHeight }),
  z.object({ kind: z.literal('empty'), height: bandHeight }),
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

/**
 * Присадканың қолмен түзетілуі. Координата бүтін миллиметр (§0.2), ал
 * ТЕРЕҢДІК бүтін емес болуы мүмкін: ілгектің чашкасы 12,5 мм — ол физикалық
 * константа, туынды өлшем емес.
 */
const DrillSchema = z.object({
  face: z.enum(['inner', 'outer', 'edgeL1', 'edgeL2', 'edgeW1', 'edgeW2']),
  x: z.number().int(),
  y: z.number().int(),
  diameter: z.number().positive(),
  depth: z.number().positive(),
  purpose: z.enum([
    'confirmat', 'dowel', 'minifix', 'shelfPin', 'hinge', 'runner', 'handle', 'leg', 'facadeScrew',
  ]),
  hardwareId: z.string().min(1).optional(),
})

const DrillEditSchema = z.object({
  added: z.array(DrillSchema),
  removed: z.array(z.string().min(1)),
})

export const CabinetConfigSchema = CabinetBaseSchema.extend({
  sections: z.array(SectionSchema).min(1).max(12),
  sliding: z.object({ count: z.number().int().min(2).max(4) }).optional(),
  base: z.object({
    kind: z.enum(['plinth', 'legs']),
    height: mm,
    legType: z.enum(['cylinder', 'cone', 'square', 'vector', 'none']).optional(),
    legPlate: z.enum(['round', 'square', 'none']).optional(),
    legHoleSpacing: mm.optional(),
    legStep: mm.optional(),
    plinthMaterialId: z.string().min(1).optional(),
    plinthShape: z.enum(['front', 'box']).optional(),
    plinthJoint: z.enum(['confirmat', 'minifix']).optional(),
  }).optional(),
  openTop: z.boolean().optional(),
  frontPanel: z.object({
    width: mm,
    side: z.enum(['left', 'right']),
    materialId: z.string().min(1).optional(),
  }).optional(),
  drawerSystem: z.enum([
    'roller', 'ball', 'tandem', 'tandembox', 'legrabox', 'merivobox',
  ]).optional(),
  metalBoxBackHeight: mm.optional(),
  topRails: z.object({
    width: z.number().int().positive(),
    count: z.union([z.literal(1), z.literal(2)]),
    orientation: z.enum(['flat', 'edge']).optional(),
  }).optional(),
  slope: z.object({
    towards: z.enum(['back', 'front']),
    lowHeight: mm,
  }).optional(),
  worktop: z.object({
    materialId: z.string().min(1).optional(),
    overhangFront: z.number().int().nonnegative(),
    overhangSides: z.number().int().nonnegative(),
    /** Ортақ (қатардың бір тақтасы) — корпуста өз детальі жоқ. Жоқ болса zod оны үнсіз алып тастар еді. */
    shared: z.boolean().optional(),
  }).optional(),
  // Техника (мойка, плита, сорғыш). ЕРІКТІ — ескі жобада жоқ.
  fixtures: z.array(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('sink') }),
    z.object({ kind: z.literal('hob'), fuel: z.enum(['gas', 'electric']) }),
    z.object({ kind: z.literal('hood') }),
  ])).max(3).optional(),
  /**
   * Присадканың қолмен түзетілуі, панель id-і бойынша.
   *
   * Өріс ЕРІКТІ, сондықтан `schemaVersion` көтерілмейді: түзетуі жоқ ескі
   * жоба дәл сол күйінде оқылады, ал жаңа жоба ескі нұсқада ашылса, тек
   * түзетуін жоғалтады да, корпустың өзі бүтін қалады.
   */
  drillEdits: z.record(z.string().min(1), DrillEditSchema).optional(),
  /**
   * Панельдің ІШІНДЕГІ оймалар, панель id-і бойынша. ЕРІКТІ өріс.
   */
  panelCutouts: z.record(z.string().min(1), z.array(z.discriminatedUnion('shape', [
    z.object({
      shape: z.literal('rect'),
      id: z.string().min(1),
      label: z.string().optional(),
      corner: z.enum(['bottomLeft', 'bottomRight', 'topLeft', 'topRight']),
      x: z.number().int(),
      y: z.number().int(),
      width: mm,
      height: mm,
      radius: z.number().int().min(0).optional(),
    }),
    z.object({
      shape: z.literal('circle'),
      id: z.string().min(1),
      label: z.string().optional(),
      corner: z.enum(['bottomLeft', 'bottomRight', 'topLeft', 'topRight']),
      x: z.number().int(),
      y: z.number().int(),
      diameter: mm,
    }),
  ]))).optional(),

  /** Жеке детальдің текстура бағыты. ЕРІКТІ. */
  panelGrain: z.record(z.string().min(1), z.enum(['length', 'width'])).optional(),
  /** Бұрыштардың радиусы, мм. ЕРІКТІ. */
  panelCorners: z.record(z.string().min(1), z.object({
    bottomLeft: z.number().int().min(0),
    bottomRight: z.number().int().min(0),
    topRight: z.number().int().min(0),
    topLeft: z.number().int().min(0),
  })).optional(),

  /**
   * Ерікті детальдар. Бұл да ЕРІКТІ өріс — ескі жоба сол күйінде оқылады.
   */
  customParts: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    materialId: z.string().min(1).optional(),
    length: mm,
    width: mm,
    position: z.object({ x: z.number().int(), y: z.number().int(), z: z.number().int() }),
    plane: z.enum(['horizontal', 'vertical', 'front']),
    edging: z.enum(['none', 'front', 'all']),
    note: z.string().optional(),
  })).optional(),
})

export const ProjectFileV2Schema = z.object({
  schemaVersion: z.literal(2),
  name: z.string().min(1),
  materials: z.array(MaterialSchema).min(1),
  edgeBands: z.array(EdgeBandSchema),
  settings: ConstructionSettingsSchema.optional(),
  cabinets: z.array(CabinetConfigSchema).min(1),
})

// ── schemaVersion 3 — бөлме мен орналастыру (C фаза) ─────────────────────────

export const RoomOpeningSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['window', 'door']),
  wall: z.enum(['north', 'east', 'south', 'west']),
  offset: z.number().int().min(0),
  width: mm,
  height: mm,
  elevation: z.number().int().min(0),
})

// Терезе, есік, әрлеу ЕРІКТІ: ескі жобада жоқ, сондықтан нұсқа көтерілмейді.
export const RoomSchema = z.object({
  width: mm,
  depth: mm,
  height: mm,
  openings: z.array(RoomOpeningSchema).max(20).optional(),
  finish: z.object({
    wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    floor: z.enum(['oak', 'walnut', 'tile', 'concrete']).optional(),
  }).optional(),
})

export const PlacementSchema = z.object({
  cabinetId: z.string().min(1),
  wall: z.enum(['north', 'east', 'south', 'west']),
  offset: z.number().int(),
  /** Еденнен биіктік, мм. ЕРІКТІ: ескі жобада ол жоқ, мәні 0 деп саналады. */
  elevation: z.number().int().min(0).max(4000).optional(),
  /** Қабырғаның бұрышына қосымша бұрылыс, градус. Ескі жобада жоқ = 0. */
  rotate: z.number().min(-180).max(180).optional(),
})

/**
 * Тапсырыс реквизиттері (PRO100 паритеті §4.1): Заказ · Дата · Клиент ·
 * Дизайнер · Примечание. Толықтай ЕРІКТІ — ескі жобада `info` жоқ,
 * сондықтан бұл өріс қосылса да `schemaVersion` көтерілмейді.
 */
export const ProjectInfoSchema = z.object({
  orderNo: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  client: z.string().min(1).optional(),
  designer: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
})

/**
 * Баға түзетулері (qdesign паритеті): коэффициент/сату бағасын жоба
 * деңгейінде алмастыру. Толықтай ЕРІКТІ — ескі жобада жоқ, сондықтан бұл
 * өріс қосылса да `schemaVersion` көтерілмейді. Терең тексеру (коэффициент
 * > 0, сату бағасы теріс емес/бүтін) осы жерде емес, `priceProject`-те
 * жүреді — `ConfigValidationError` жол атымен әрі аралығымен лақтырады,
 * ал схема тек ПІШІНДІ тексереді.
 */
export const PriceOverridesSchema = z.object({
  coefficient: z.number().positive().optional(),
  salePrice: z.number().int().min(0).optional(),
})

export const ProjectFileSchema = ProjectFileV2Schema.extend({
  schemaVersion: z.literal(3),
  room: RoomSchema,
  placements: z.array(PlacementSchema),
  // ЕРІКТІ: ескі жобада жоқ, сондықтан нұсқа көтерілмейді (жоғарыдағы түсінік).
  info: ProjectInfoSchema.optional(),
  priceOverrides: PriceOverridesSchema.optional(),
})

export const CURRENT_SCHEMA_VERSION = 3

// ── Миграция ─────────────────────────────────────────────────────────────────

type ProjectV1 = z.infer<typeof ProjectFileV1Schema>

/**
 * v1 → v2: перегородкасыз кабинет = бір flex секция.
 * Нәтижесі миллиметрге дейін бұрынғымен бірдей болуы керек — оны
 * snapshot тесті қорғайды.
 */
type ProjectV2 = z.infer<typeof ProjectFileV2Schema>

export function migrateV1ToV2(project: ProjectV1): ProjectV2 {
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

/** Бөлме — v2-де мұндай ұғым болмаған, әдепкі бөлме беріледі. */
const DEFAULT_PROJECT_ROOM = { width: 4000, depth: 3000, height: 2700 }

/**
 * v2 → v3: бөлме әдепкі болады, шкафтар бір қабырғаға қатарынан тізіледі.
 * Ені белгісіз қалмайды: әрқайсысының өз ені бойынша жылжытылады.
 */
export function migrateV2ToV3(project: ProjectV2): ProjectFile {
  let offset = 0
  const placements = project.cabinets.map((cabinet) => {
    const placement = { cabinetId: cabinet.id, wall: 'south' as const, offset }
    offset += cabinet.width
    return placement
  })
  return { ...project, schemaVersion: 3, room: { ...DEFAULT_PROJECT_ROOM }, placements }
}

/**
 * Кез келген нұсқадағы жоба файлын оқып, ағымдағы пішінге келтіру.
 * Белгісіз нұсқа — үнсіз өтпейді, қате лақтырады.
 */
export function parseProject(raw: unknown): ProjectFile {
  const version = (raw as { schemaVersion?: unknown })?.schemaVersion
  switch (version) {
    case 1:
      return migrateV2ToV3(migrateV1ToV2(ProjectFileV1Schema.parse(raw)))
    case 2:
      return migrateV2ToV3(ProjectFileV2Schema.parse(raw))
    case 3:
      return ProjectFileSchema.parse(raw)
    default:
      throw new Error(
        `Белгісіз schemaVersion: ${String(version)}. Қолдау бар нұсқалар: 1, 2, ${CURRENT_SCHEMA_VERSION}`,
      )
  }
}
