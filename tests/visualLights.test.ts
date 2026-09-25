import { afterEach, describe, expect, it } from 'vitest'
import { parseProjectV4, SceneLightSchema, sunDirection } from '../src/core/index'
import { useConfigurator } from '../store/configurator'
import { referenceProject } from './fixtures'

const initial = useConfigurator.getState()
afterEach(() => useConfigurator.setState(initial, true))

const point = { kind: 'point' as const, id: 'point-1', color: '#fff1dc', intensity: 8,
  position: { x: 1200, y: 2400, z: 800 } }
const spot = { kind: 'spot' as const, id: 'spot-1', color: '#ffffff', intensity: 5,
  position: { x: 1000, y: 2000, z: 600 }, target: { x: 300, y: 600, z: 300 }, angleDegrees: 35 }
const sun = { kind: 'sun' as const, id: 'sun-1', color: '#ffe5bd', intensity: 1.5,
  azimuthDegrees: 45, elevationDegrees: 55 }

describe('жобаның нүкте/спот/күн жарықтары', () => {
  it('ескі жоба жарықсыз ашылады, жаңа үшеуі v4 roundtrip-та сақталады', () => {
    const old = parseProjectV4(referenceProject)
    expect(old.lights).toEqual([])
    const parsed = parseProjectV4({ ...old, lights: [point, spot, sun] })
    expect(parsed.lights).toEqual([point, spot, sun])
  })

  it('түстік hex, қарқын, бүтін мм, бұрыш және қайталанған ID тексеріледі', () => {
    expect(SceneLightSchema.parse(point)).toEqual(point)
    expect(SceneLightSchema.parse(spot)).toEqual(spot)
    expect(SceneLightSchema.parse(sun)).toEqual(sun)
    expect(() => SceneLightSchema.parse({ ...point, position: { ...point.position, x: 1.5 } })).toThrow()
    expect(() => SceneLightSchema.parse({ ...point, color: 'white' })).toThrow()
    expect(() => SceneLightSchema.parse({ ...spot, angleDegrees: 120 })).toThrow()
    expect(() => SceneLightSchema.parse({ ...sun, intensity: -1 })).toThrow()
    const project = parseProjectV4(referenceProject)
    expect(() => parseProjectV4({ ...project, lights: [point, point] })).toThrow()
  })

  it('store өзгерісті бір undo қадамына енгізіп, project файлына сақтайды', () => {
    const state = useConfigurator.getState()
    const before = state.past.length
    state.setProjectLights([point, spot, sun])
    const changed = useConfigurator.getState()
    expect(changed.past).toHaveLength(before + 1)
    expect(changed.exportProject().lights).toEqual([point, spot, sun])
    changed.undo()
    expect(useConfigurator.getState().exportProject().lights).toEqual([])
  })

  it('күн бағыты azimuth/elevation бойынша бірлік вектор болады', () => {
    const overhead = sunDirection({ ...sun, azimuthDegrees: 0, elevationDegrees: 90 })
    expect(overhead.y).toBeCloseTo(1)
    expect(overhead.x).toBeCloseTo(0)
    const eastern = sunDirection({ ...sun, azimuthDegrees: 90, elevationDegrees: 0 })
    expect(eastern.x).toBeCloseTo(1)
    expect(eastern.z).toBeCloseTo(0)
  })
})
