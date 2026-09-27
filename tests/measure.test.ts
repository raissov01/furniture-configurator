import { describe, expect, it } from 'vitest'
import type { Placement } from '../src/core/types'
import {
  OBSTACLE_KINDS, calculateMeasurementImpact, canCompleteWall, createMeasurementSyncAction,
  toKitchenInput, toRoom, validateMeasurement, type MeasurementSurvey,
} from '../src/core/measure'

const n = (value: number, source: 'manual' | 'voice' | 'laser' = 'manual') => ({ value, source, capturedAt: 1000 })
const obstacles = () => Object.fromEntries(OBSTACLE_KINDS.map((kind) => [kind, {
  status: 'absent', photoRef: `photo:${kind}`, location: null,
}])) as MeasurementSurvey['walls']['north']['obstacles']
const survey = (): MeasurementSurvey => ({
  id: 'm-1',
  height: n(2700),
  walls: {
    north: { length: n(3200, 'laser'), obstacles: obstacles() },
    east: { length: n(2400), obstacles: obstacles() },
    south: { length: n(3200), obstacles: obstacles() },
    west: { length: n(2400), obstacles: obstacles() },
  },
  corners: { northWest: n(90), northEast: n(90), southEast: n(90), southWest: n(90) },
})

describe('measurement wizard core', () => {
  it('blocks wall completion until every obstacle has an answer and photo reference', () => {
    const draft = survey()
    draft.walls.north.obstacles.pipe = { status: 'unanswered', photoRef: null, location: null }
    expect(canCompleteWall(draft, 'north')).toBe(false)
    draft.walls.east.length = n(0)
    expect(canCompleteWall(draft, 'north')).toBe(false)
    draft.walls.east.length = n(2400)
    expect(validateMeasurement(draft).some((issue) => issue.path === 'walls.north.obstacles.pipe.status')).toBe(true)
    draft.walls.north.obstacles.pipe = { status: 'present', photoRef: ' ', location: null }
    expect(canCompleteWall(draft, 'north')).toBe(false)
    draft.walls.north.obstacles.pipe.photoRef = 'photo:pipe'
    expect(canCompleteWall(draft, 'north')).toBe(true)
    expect(canCompleteWall({ id: 'm-1', walls: {} }, 'north')).toBe(false)
  })

  it('checks integer dimensions, provenance, timestamps and obstacle bounds', () => {
    const draft = survey()
    draft.walls.north.length = n(3200.5)
    draft.walls.east.obstacles.socket = { status: 'present', photoRef: 'photo:socket', location: {
      offset: n(2390), width: n(30), elevation: n(200), height: n(80), depth: n(20),
    } }
    expect(validateMeasurement(draft).map((issue) => issue.path)).toContain('walls.north.length.value')
    draft.walls.north.length = n(3200)
    expect(validateMeasurement(draft).map((issue) => issue.path)).toContain('walls.east.obstacles.socket.location')
    expect(() => toRoom(draft)).toThrow()
  })

  it('converts a complete rectangular survey to Room and kitchen options without losing constraints', () => {
    const draft = survey()
    draft.walls.north.obstacles.socket = { status: 'present', photoRef: 'photo:socket', location: {
      offset: n(500), width: n(100), elevation: n(300), height: n(100), depth: n(20),
    } }
    expect(toRoom(draft)).toEqual({ width: 3200, depth: 2400, height: 2700, openings: [] })
    const input = toKitchenInput(draft, ['north', 'east'])
    expect(input.options).toEqual({ layout: 'corner', lengthA: 3200, lengthB: 2400 })
    expect(input.room.width).toBe(3200)
    expect(input.constraints.north.socket.photoRef).toBe('photo:socket')
  })

  it('rejects skewed corners or mismatched opposite walls instead of inventing a rectangular Room', () => {
    const draft = survey()
    draft.corners.northWest = n(89)
    expect(() => toRoom(draft)).toThrow(/corner|бұрыш/i)
    draft.corners.northWest = n(90)
    draft.walls.south.length = n(3199)
    expect(() => toRoom(draft)).toThrow(/opposite|қарама/i)
  })

  it('бапталған ауытқумен қарама-қарсы қабырға мен бұрышты қабылдайды, шектен асса қате береді', () => {
    const draft = survey()
    draft.walls.south.length = n(3192)
    draft.corners.northEast = n(91)
    expect(() => toRoom(draft)).toThrow()
    expect(toRoom(draft, { wallMm: 10, cornerDeg: 1 })).toEqual({ width: 3200, depth: 2400, height: 2700, openings: [] })
    draft.walls.south.length = n(3189)
    expect(() => toRoom(draft, { wallMm: 10, cornerDeg: 1 })).toThrow(/opposite/i)
  })

  it('calculates affected cabinets and quotes from obstacle footprint and changed wall length', () => {
    const before = survey()
    const after = survey()
    after.walls.north.obstacles.socket = { status: 'present', photoRef: 'photo:new', location: {
      offset: n(450), width: n(100), elevation: n(200), height: n(80), depth: n(20),
    } }
    const placements: Placement[] = [
      { cabinetId: 'a', wall: 'north', offset: 0 },
      { cabinetId: 'b', wall: 'north', offset: 600 },
      { cabinetId: 'c', wall: 'east', offset: 0 },
    ]
    const cabinets = [{ id: 'a', width: 600 }, { id: 'b', width: 600 }, { id: 'c', width: 600 }]
    const quotes = [{ id: 'q1', cabinetIds: ['a', 'c'] }, { id: 'q2', cabinetIds: ['b'] }]
    expect(calculateMeasurementImpact(before, after, cabinets, placements, quotes)).toMatchObject({
      cabinetIds: ['a'], quoteIds: ['q1'],
    })
    after.walls.north.length = n(3300)
    expect(calculateMeasurementImpact(before, after, cabinets, placements, quotes).cabinetIds).toEqual(['a', 'b', 'c'])
  })

  it('does not invalidate a quote when only provenance or a photo reference changes', () => {
    const before = survey()
    const after = survey()
    after.walls.north.length = n(3200, 'voice')
    after.walls.north.obstacles.socket.photoRef = 'photo:replacement'
    expect(calculateMeasurementImpact(before, after, [{ id: 'a', width: 600 }],
      [{ cabinetId: 'a', wall: 'north', offset: 0 }], [{ id: 'q', cabinetIds: ['a'] }]))
      .toEqual({ changedPaths: [], cabinetIds: [], quoteIds: [] })
  })

  it('creates a durable idempotent sync action with provenance in the payload', () => {
    const draft = survey()
    const action = createMeasurementSyncAction(draft, 'action-1', { version: 2, updatedAt: 900 }, 1000)
    expect(action.kind).toBe('measurement.upsert')
    expect(action.entityId).toBe('m-1')
    expect(action.payload).toMatchObject({ walls: { north: { length: { source: 'laser', capturedAt: 1000 } } } })
    expect(action.id).toBe('action-1')
  })

  it('keeps an unfinished draft out of the completed sync action', () => {
    const draft = survey()
    draft.walls.west.obstacles.vent = { status: 'unanswered', photoRef: null, location: null }
    expect(() => createMeasurementSyncAction(draft, 'draft-1', { version: 0, updatedAt: 0 }, 1000))
      .toThrow(/walls|status/)
  })

  it('requires tile thickness with measured provenance when tile is present', () => {
    const draft = survey()
    draft.walls.south.obstacles.tileThickness = { status: 'present', photoRef: 'photo:tile', location: null }
    expect(canCompleteWall(draft, 'south')).toBe(false)
    draft.walls.south.obstacles.tileThickness.thickness = n(12, 'laser')
    expect(canCompleteWall(draft, 'south')).toBe(true)
  })
})
