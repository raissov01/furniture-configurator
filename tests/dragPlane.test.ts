import { describe, expect, it } from 'vitest'
import { dragPlaneAxis } from '../lib/dragPlane'

describe('еркін нысан сүйреу жазықтығы', () => {
  it('жоғарыдан қарағанда XZ, алдынан қарағанда XY, бүйірден қарағанда YZ', () => {
    expect(dragPlaneAxis({ x: 0.1, y: -0.9, z: -0.2 })).toBe('y')
    expect(dragPlaneAxis({ x: 0.1, y: -0.1, z: -0.9 })).toBe('z')
    expect(dragPlaneAxis({ x: -0.9, y: -0.1, z: -0.2 })).toBe('x')
  })
  it('нөл не шекті емес сәулеге өріс аты бар қате', () => {
    expect(() => dragPlaneAxis({ x: 0, y: 0, z: 0 })).toThrow(/ray/)
    expect(() => dragPlaneAxis({ x: NaN, y: 1, z: 0 })).toThrow(/ray/)
  })
})
