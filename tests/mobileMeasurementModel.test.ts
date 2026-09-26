import { describe, expect, it } from 'vitest'
import { OBSTACLE_KINDS } from '../src/core/measure'
import { validateMeasurement } from '../src/core/measure'
import {
  canAdvanceWall, emptySurvey, measured, parseSavedMeasurementDraft, roomIssues, setObstacleLocation, updateMeasure, updateObstacle, updateObstacleDimension,
} from '../components/mobile/measurementModel'

describe('mobile measurement draft', () => {
  it('аяқталмаған бөлмені дайын өлшем деп сақтауға жібермейді', () => {
    expect(validateMeasurement(emptySurvey('draft', 1000)).length).toBeGreaterThan(0)
  })
  it('reopens an unfinished local draft while rejecting malformed storage rows', () => {
    const draft = emptySurvey('unfinished-1', 1000)
    expect(parseSavedMeasurementDraft(JSON.parse(JSON.stringify(draft)))).toEqual(draft)
    expect(parseSavedMeasurementDraft({ ...draft, walls: {} })).toBeNull()
    expect(parseSavedMeasurementDraft({ ...draft, height: { ...draft.height, value: 2.5 } })).toBeNull()
  })

  it('starts with separate unanswered obstacles on each wall and blocks moving on', () => {
    const draft = emptySurvey('survey-1', 1000)
    expect(draft.walls.north.obstacles.socket.status).toBe('unanswered')
    expect(draft.walls.east.obstacles.socket.status).toBe('unanswered')
    expect(canAdvanceWall(draft, 'north')).toBe(false)
    const north = updateObstacle(draft, 'north', 'socket', { status: 'absent', photoRef: 'photo-1' })
    expect(north.walls.east.obstacles.socket.status).toBe('unanswered')
  })

  it('requires every present or absent obstacle to have a saved photo before next wall', () => {
    let draft = emptySurvey('survey-2', 1000)
    draft = updateMeasure(draft, 'height', 2700, 'manual', 1001)
    draft = updateMeasure(draft, 'walls.north.length', 3200, 'laser', 1002)
    for (const kind of OBSTACLE_KINDS) draft = updateObstacle(draft, 'north', kind, { status: 'absent', photoRef: `photo-${kind}` })
    expect(canAdvanceWall(draft, 'north')).toBe(true)
    draft = updateObstacle(draft, 'north', 'pipe', { photoRef: null })
    expect(canAdvanceWall(draft, 'north')).toBe(false)
  })

  it('keeps integer millimetres, provenance and time; rejects fractional input', () => {
    const draft = updateMeasure(emptySurvey('survey-3', 1000), 'walls.west.length', 2400, 'voice', 1001)
    expect(draft.walls.west.length).toEqual({ value: 2400, source: 'voice', capturedAt: 1001 })
    expect(() => measured(12.5, 'voice', 1000)).toThrow(/бүтін/)
    expect(() => measured(-1, 'manual', 1000)).toThrow(/теріс/)
  })

  it('clears stale geometry when an obstacle is changed to absent', () => {
    let draft = emptySurvey('survey-4', 1000)
    draft = updateObstacle(draft, 'south', 'socket', {
      status: 'present', photoRef: 'photo-a',
      location: {
        offset: measured(100, 'manual', 1000), width: measured(60, 'manual', 1000),
        elevation: measured(200, 'manual', 1000), height: measured(60, 'manual', 1000),
        depth: measured(20, 'manual', 1000),
      },
    })
    draft = updateObstacle(draft, 'south', 'socket', { status: 'absent' })
    expect(draft.walls.south.obstacles.socket.location).toBeNull()
    expect(draft.walls.south.obstacles.socket.photoRef).toBeNull()
  })

  it('records obstacle position with integer measurements and capture source', () => {
    let draft = emptySurvey('survey-6', 1000)
    draft = updateObstacle(draft, 'east', 'pipe', { status: 'present', photoRef: 'photo-pipe' })
    draft = setObstacleLocation(draft, 'east', 'pipe', true, 1001)
    draft = updateObstacleDimension(draft, 'east', 'pipe', 'offset', 470, 'laser', 1002)
    expect(draft.walls.east.obstacles.pipe.location?.offset).toEqual({ value: 470, source: 'laser', capturedAt: 1002 })
    expect(() => updateObstacleDimension(draft, 'east', 'pipe', 'width', 7.5, 'manual', 1003)).toThrow()
    draft = setObstacleLocation(draft, 'east', 'pipe', false, 1004)
    expect(draft.walls.east.obstacles.pipe.location).toBeNull()
  })

  it('names incomplete room fields for the wizard', () => {
    const draft = emptySurvey('survey-5', 1000)
    expect(roomIssues(draft)).toContain('height')
    expect(roomIssues(draft)).toContain('walls.east.length')
    expect(roomIssues(draft)).toContain('corners.northWest')
  })

  it('жауаптан бұрын түсірілген фото «бар/жоқ» басылғанда жоғалмайды', () => {
    // Шеберде фото өрісі жауап батырмаларымен қатар тұр: алдымен суретке түсіру табиғи.
    let draft = emptySurvey('survey-photo-first', 1000)
    draft = updateObstacle(draft, 'west', 'vent', { photoRef: 'photo:vent' })
    draft = updateObstacle(draft, 'west', 'vent', { status: 'absent' })
    expect(draft.walls.west.obstacles.vent.photoRef).toBe('photo:vent')
    // Жауап ауысса, ескі дәлел жаңа жауапқа жарамайды.
    draft = updateObstacle(draft, 'west', 'vent', { status: 'present' })
    expect(draft.walls.west.obstacles.vent.photoRef).toBeNull()
  })
})
