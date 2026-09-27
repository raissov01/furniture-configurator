import { z } from 'zod'
import type { KitchenOptions } from '../kitchen'
import type { Placement, Room, WallId } from '../types'
import type { JsonValue, Revision, SyncAction } from '../sync/types'

export const WALL_IDS = ['north', 'east', 'south', 'west'] as const satisfies readonly WallId[]
export const CORNER_IDS = ['northWest', 'northEast', 'southEast', 'southWest'] as const
export const OBSTACLE_KINDS = ['socket', 'pipe', 'radiator', 'vent', 'windowSill', 'tileThickness'] as const
export type ObstacleKind = typeof OBSTACLE_KINDS[number]
export type CornerId = typeof CORNER_IDS[number]

/** Every measured number carries its capture method and timestamp (Unix ms). */
const measuredNumber = z.object({
  value: z.number().int().safe(),
  source: z.enum(['manual', 'voice', 'laser']),
  capturedAt: z.number().int().safe().nonnegative(),
}).strict()
const nonnegativeMeasure = measuredNumber.refine((entry) => entry.value >= 0, 'өлшем теріс болмауы керек')
const positiveMeasure = measuredNumber.refine((entry) => entry.value > 0, 'өлшем нөлден үлкен болуы керек')
const locationSchema = z.object({
  offset: nonnegativeMeasure,
  width: positiveMeasure,
  elevation: nonnegativeMeasure,
  height: positiveMeasure,
  depth: nonnegativeMeasure,
}).strict()
const obstacleSchema = z.object({
  status: z.enum(['unanswered', 'present', 'absent']),
  photoRef: z.string().nullable(),
  location: locationSchema.nullable(),
  /** Tile build-up measured perpendicular to the wall. */
  thickness: positiveMeasure.nullable().optional(),
}).strict()
const obstaclesSchema = z.object(Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, obstacleSchema])) as Record<ObstacleKind, typeof obstacleSchema>).strict()
const wallSchema = z.object({ length: positiveMeasure, obstacles: obstaclesSchema }).strict()

const measurementSurveyShape = z.object({
  id: z.string().trim().min(1),
  height: positiveMeasure,
  walls: z.object({ north: wallSchema, east: wallSchema, south: wallSchema, west: wallSchema }).strict(),
  corners: z.object({
    northWest: positiveMeasure, northEast: positiveMeasure,
    southEast: positiveMeasure, southWest: positiveMeasure,
  }).strict(),
}).strict()

export type MeasuredNumber = z.infer<typeof measuredNumber>
export type ObstacleAnswer = z.infer<typeof obstacleSchema>
export type MeasurementSurvey = z.infer<typeof measurementSurveyShape>
export type MeasurementIssue = { path: string; message: string }

function surveyIssues(survey: MeasurementSurvey): MeasurementIssue[] {
  const issues: MeasurementIssue[] = []
  for (const wall of WALL_IDS) {
    const length = survey.walls[wall].length.value
    for (const kind of OBSTACLE_KINDS) {
      const answer = survey.walls[wall].obstacles[kind]
      const path = `walls.${wall}.obstacles.${kind}`
      if (answer.status === 'unanswered') issues.push({ path: `${path}.status`, message: 'бар/жоқ жауабы міндетті' })
      if (answer.status !== 'unanswered' && !answer.photoRef?.trim()) {
        issues.push({ path: `${path}.photoRef`, message: 'фото сілтемесі міндетті' })
      }
      if (answer.location && answer.location.offset.value + answer.location.width.value > length) {
        issues.push({ path: `${path}.location`, message: 'кедергі қабырға ұзындығынан асып кетті' })
      }
      if (answer.location && answer.location.elevation.value + answer.location.height.value > survey.height.value) {
        issues.push({ path: `${path}.location`, message: 'кедергі бөлме биіктігінен асып кетті' })
      }
      if (answer.status === 'absent' && (answer.location || answer.thickness)) {
        issues.push({ path, message: 'жоқ кедергінің өлшемі болмауы керек' })
      }
      if (kind === 'tileThickness' && answer.status === 'present' && !answer.thickness) {
        issues.push({ path: `${path}.thickness`, message: 'плитка қалыңдығы міндетті' })
      }
    }
  }
  return issues
}

/** Server actions and "completed" measurements must contain every answer and photo. */
export const MeasurementSurveySchema = measurementSurveyShape.superRefine((survey, context) => {
  for (const issue of surveyIssues(survey)) {
    context.addIssue({ code: 'custom', path: issue.path.split('.'), message: issue.message })
  }
})

/** Draft validation remains readable while a survey is being filled in. */
export function validateMeasurement(input: unknown): MeasurementIssue[] {
  const result = measurementSurveyShape.safeParse(input)
  if (!result.success) return result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  return surveyIssues(result.data)
}

export function canCompleteWall(input: unknown, wall: WallId): boolean {
  if (typeof input !== 'object' || input === null || !('walls' in input)) return false
  const walls = input.walls
  if (typeof walls !== 'object' || walls === null) return false
  const parsed = wallSchema.safeParse((walls as Record<string, unknown>)[wall])
  if (!parsed.success) return false
  for (const kind of OBSTACLE_KINDS) {
    const answer = parsed.data.obstacles[kind]
    if (answer.status === 'unanswered' || !answer.photoRef?.trim()) return false
    if (kind === 'tileThickness' && answer.status === 'present' && !answer.thickness) return false
    if (answer.location && answer.location.offset.value + answer.location.width.value > parsed.data.length.value) return false
  }
  return !validateMeasurement(input).some((issue) => issue.path.startsWith(`walls.${wall}.`))
}

export type RoomTolerance = { wallMm: number; cornerDeg: number }

function validTolerance(value: RoomTolerance): void {
  if (!Number.isSafeInteger(value.wallMm) || value.wallMm < 0 ||
      !Number.isSafeInteger(value.cornerDeg) || value.cornerDeg < 0) {
    throw new Error('tolerance: wallMm және cornerDeg теріс емес бүтін болуы керек')
  }
}

function completeRectangularSurvey(input: unknown, tolerance: RoomTolerance): MeasurementSurvey {
  validTolerance(tolerance)
  const issues = validateMeasurement(input)
  if (issues.length) throw new Error(`Өлшеу аяқталмаған: ${issues.map((issue) => issue.path).join(', ')}`)
  const survey = MeasurementSurveySchema.parse(input)
  for (const corner of CORNER_IDS) {
    if (Math.abs(survey.corners[corner].value - 90) > tolerance.cornerDeg) throw new Error(`corner ${corner}: Room тек төзімділік шегіндегі тік бұрышты бөлмені қолдайды`)
  }
  if (Math.abs(survey.walls.north.length.value - survey.walls.south.length.value) > tolerance.wallMm ||
      Math.abs(survey.walls.east.length.value - survey.walls.west.length.value) > tolerance.wallMm) {
    throw new Error('opposite walls: қарама-қарсы қабырғалар тең емес')
  }
  return survey
}

/** A measured room has no inferred openings; keep obstacle details in the survey. */
export function toRoom(input: unknown, tolerance: RoomTolerance = { wallMm: 0, cornerDeg: 0 }): Room {
  const survey = completeRectangularSurvey(input, tolerance)
  return {
    width: survey.walls.north.length.value,
    depth: survey.walls.east.length.value,
    height: survey.height.value,
    openings: [],
  }
}

export type KitchenMeasurementInput = {
  room: Room
  options: KitchenOptions
  /** Source wall for generator runs A/B/C; callers can remap generated placements. */
  wallMap: { runA: WallId; runB: WallId | null; runC: WallId | null }
  constraints: Record<WallId, MeasurementSurvey['walls'][WallId]['obstacles']>
}

export function toKitchenInput(input: unknown, walls: readonly WallId[], tolerance: RoomTolerance = { wallMm: 0, cornerDeg: 0 }): KitchenMeasurementInput {
  const survey = completeRectangularSurvey(input, tolerance)
  if (walls.length < 1 || walls.length > 3 || new Set(walls).size !== walls.length) {
    throw new Error('Kitchen walls: бірден үшке дейін бөлек қабырға керек')
  }
  const [a, b, c] = walls
  if (!a) throw new Error('Kitchen wall A is required')
  const opposite: Record<WallId, WallId> = { north: 'south', south: 'north', east: 'west', west: 'east' }
  if (b && (b === a || b === opposite[a])) throw new Error('Kitchen wall B must be adjacent to A')
  if (c && (!b || c !== opposite[b])) throw new Error('Kitchen wall C must oppose B')
  const options: KitchenOptions = {
    layout: c ? 'u' : b ? 'corner' : 'straight',
    lengthA: survey.walls[a].length.value,
    ...(b ? { lengthB: survey.walls[b].length.value } : {}),
    ...(c ? { lengthC: survey.walls[c].length.value } : {}),
  }
  return {
    room: toRoom(survey, tolerance), options,
    wallMap: { runA: a, runB: b ?? null, runC: c ?? null },
    constraints: Object.fromEntries(WALL_IDS.map((wall) => [wall, survey.walls[wall].obstacles])) as KitchenMeasurementInput['constraints'],
  }
}

export type MeasurementCabinet = { id: string; width: number }
export type QuoteCabinets = { id: string; cabinetIds: readonly string[] }
export type MeasurementImpact = { changedPaths: string[]; cabinetIds: string[]; quoteIds: string[] }

function obstacleGeometry(answer: ObstacleAnswer): string {
  const location = answer.location
  return JSON.stringify([
    answer.status,
    location?.offset.value ?? null, location?.width.value ?? null,
    location?.elevation.value ?? null, location?.height.value ?? null,
    location?.depth.value ?? null, answer.thickness?.value ?? null,
  ])
}

/** Conservative impact: room shape changes can move every placement; a located obstacle affects intersecting modules. */
export function calculateMeasurementImpact(
  before: MeasurementSurvey, after: MeasurementSurvey,
  cabinets: readonly MeasurementCabinet[], placements: readonly Placement[], quotes: readonly QuoteCabinets[],
): MeasurementImpact {
  const changedPaths: string[] = []
  const affected = new Set<string>()
  const widths = new Map(cabinets.map((cabinet) => [cabinet.id, cabinet.width]))
  const addAll = () => placements.forEach((placement) => affected.add(placement.cabinetId))
  if (before.height.value !== after.height.value) { changedPaths.push('height'); addAll() }
  for (const corner of CORNER_IDS) {
    if (before.corners[corner].value !== after.corners[corner].value) { changedPaths.push(`corners.${corner}`); addAll() }
  }
  for (const wall of WALL_IDS) {
    if (before.walls[wall].length.value !== after.walls[wall].length.value) {
      changedPaths.push(`walls.${wall}.length`)
      addAll()
    }
    for (const kind of OBSTACLE_KINDS) {
      const oldAnswer = before.walls[wall].obstacles[kind]
      const newAnswer = after.walls[wall].obstacles[kind]
      if (obstacleGeometry(oldAnswer) === obstacleGeometry(newAnswer)) continue
      changedPaths.push(`walls.${wall}.obstacles.${kind}`)
      for (const placement of placements.filter((item) => item.wall === wall)) {
        const width = widths.get(placement.cabinetId)
        if (width === undefined) continue
        const intersects = (answer: ObstacleAnswer) => answer.status === 'present' &&
          (!answer.location || (
            placement.offset < answer.location.offset.value + answer.location.width.value &&
            placement.offset + width > answer.location.offset.value))
        if (intersects(oldAnswer) || intersects(newAnswer)) affected.add(placement.cabinetId)
      }
    }
  }
  const cabinetIds = [...affected].sort()
  const quoteIds = quotes.filter((quote) => quote.cabinetIds.some((id) => affected.has(id))).map((quote) => quote.id).sort()
  return { changedPaths, cabinetIds, quoteIds }
}

/** Queue only JSON data; persistence and network transport are supplied by src/core/sync. */
export function createMeasurementSyncAction(
  input: unknown, actionId: string, baseRevision: Revision, createdAt: number,
): SyncAction {
  const survey = MeasurementSurveySchema.parse(input)
  return {
    id: actionId, kind: 'measurement.upsert', entityId: survey.id,
    payload: survey as unknown as JsonValue, baseRevision, createdAt,
  }
}
