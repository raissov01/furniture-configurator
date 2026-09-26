import { z } from 'zod'
import {
  CORNER_IDS, OBSTACLE_KINDS, WALL_IDS, validateMeasurement,
  type MeasuredNumber, type MeasurementSurvey, type ObstacleKind,
} from '@/src/core/measure'
import type { WallId } from '@/src/core/types'

export type CaptureSource = MeasuredNumber['source']
const draftNumber = z.object({
  value: z.number().int().safe().nonnegative(),
  source: z.enum(['manual', 'voice', 'laser']),
  capturedAt: z.number().int().safe().nonnegative(),
}).strict()
const draftLocation = z.object({
  offset: draftNumber, width: draftNumber, elevation: draftNumber,
  height: draftNumber, depth: draftNumber,
}).strict()
const draftObstacle = z.object({
  status: z.enum(['unanswered', 'present', 'absent']),
  photoRef: z.string().nullable(),
  location: draftLocation.nullable(),
  thickness: draftNumber.nullable().optional(),
}).strict()
const draftObstacles = z.object({
  socket: draftObstacle, pipe: draftObstacle, radiator: draftObstacle,
  vent: draftObstacle, windowSill: draftObstacle, tileThickness: draftObstacle,
}).strict()
const draftWall = z.object({ length: draftNumber, obstacles: draftObstacles }).strict()
const draftSchema = z.object({
  id: z.string().trim().min(1), height: draftNumber,
  walls: z.object({ north: draftWall, east: draftWall, south: draftWall, west: draftWall }).strict(),
  corners: z.object({ northWest: draftNumber, northEast: draftNumber, southEast: draftNumber, southWest: draftNumber }).strict(),
}).strict()

/** A draft may have zero values until the user measures them; still reject malformed storage rows. */
export function parseSavedMeasurementDraft(value: unknown): MeasurementSurvey | null {
  const result = draftSchema.safeParse(value)
  return result.success ? result.data : null
}

export type SurveyField = 'height' | `walls.${WallId}.length` | `corners.${typeof CORNER_IDS[number]}`

export function measured(value: number, source: CaptureSource, capturedAt: number): MeasuredNumber {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Өлшем бүтін мм және теріс емес болуы керек')
  return { value, source, capturedAt }
}

export function emptySurvey(id: string, now: number): MeasurementSurvey {
  if (!id.trim()) throw new Error('Өлшеу ID-і міндетті')
  const zero = () => measured(0, 'manual', now)
  const obstacles = () => Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, {
    status: 'unanswered', photoRef: null, location: null,
  }])) as MeasurementSurvey['walls'][WallId]['obstacles']
  return {
    id, height: zero(),
    walls: Object.fromEntries(WALL_IDS.map((wall) => [wall, { length: zero(), obstacles: obstacles() }])) as MeasurementSurvey['walls'],
    corners: Object.fromEntries(CORNER_IDS.map((corner) => [corner, zero()])) as MeasurementSurvey['corners'],
  }
}

export function updateMeasure(
  survey: MeasurementSurvey, field: SurveyField, value: number,
  source: CaptureSource, now: number,
): MeasurementSurvey {
  const next = structuredClone(survey)
  const entry = measured(value, source, now)
  if (field === 'height') next.height = entry
  else {
    const [group, key] = field.split('.')
    if (group === 'walls' && key && key in next.walls) next.walls[key as WallId].length = entry
    else if (group === 'corners' && key && key in next.corners) next.corners[key as keyof typeof next.corners] = entry
    else throw new Error(`Белгісіз өлшем: ${field}`)
  }
  return next
}

export function updateObstacle(
  survey: MeasurementSurvey, wall: WallId, kind: ObstacleKind,
  patch: Partial<MeasurementSurvey['walls'][WallId]['obstacles'][ObstacleKind]>,
): MeasurementSurvey {
  const next = structuredClone(survey)
  const prior = next.walls[wall].obstacles[kind]
  const answer = { ...prior, ...patch }
  if (answer.status !== prior.status && patch.photoRef === undefined) answer.photoRef = null
  if (answer.status !== 'present') {
    answer.location = null
    answer.thickness = null
  }
  next.walls[wall].obstacles[kind] = answer
  return next
}

export function roomIssues(survey: MeasurementSurvey): string[] {
  return validateMeasurement(survey)
    .filter((issue) => issue.path === 'height' || issue.path.startsWith('height.') ||
      issue.path.startsWith('corners.') ||
      (issue.path.startsWith('walls.') && issue.path.includes('.length')))
    .map((issue) => issue.path)
}

export function wallIssues(survey: MeasurementSurvey, wall: WallId): string[] {
  const issues: string[] = []
  const wallData = survey.walls[wall]
  const path = `walls.${wall}`
  if (!Number.isSafeInteger(wallData.length.value) || wallData.length.value <= 0) issues.push(`${path}.length`)
  for (const kind of OBSTACLE_KINDS) {
    const answer = wallData.obstacles[kind]
    const item = `${path}.obstacles.${kind}`
    if (answer.status === 'unanswered') issues.push(`${item}.status`)
    if (answer.status !== 'unanswered' && !answer.photoRef?.trim()) issues.push(`${item}.photoRef`)
    if (kind === 'tileThickness' && answer.status === 'present' &&
      (!answer.thickness || answer.thickness.value <= 0)) issues.push(`${item}.thickness`)
    if (answer.location) {
      const box = answer.location
      if (box.width.value <= 0 || box.height.value <= 0 ||
        box.offset.value + box.width.value > wallData.length.value ||
        box.elevation.value + box.height.value > survey.height.value) issues.push(`${item}.location`)
    }
  }
  return issues
}

export function canAdvanceWall(survey: MeasurementSurvey, wall: WallId): boolean {
  return wallIssues(survey, wall).length === 0
}

export type ObstacleDimension = 'offset' | 'width' | 'elevation' | 'height' | 'depth'

export function setObstacleLocation(
  survey: MeasurementSurvey, wall: WallId, kind: ObstacleKind, enabled: boolean, now: number,
): MeasurementSurvey {
  const location = enabled ? {
    offset: measured(0, 'manual', now), width: measured(0, 'manual', now),
    elevation: measured(0, 'manual', now), height: measured(0, 'manual', now),
    depth: measured(0, 'manual', now),
  } : null
  return updateObstacle(survey, wall, kind, { location })
}

export function updateObstacleDimension(
  survey: MeasurementSurvey, wall: WallId, kind: ObstacleKind,
  field: ObstacleDimension, value: number, source: CaptureSource, now: number,
): MeasurementSurvey {
  const next = structuredClone(survey)
  const location = next.walls[wall].obstacles[kind].location
  if (!location) throw new Error('Кедергінің орны алдымен қосылуы керек')
  location[field] = measured(value, source, now)
  return next
}
