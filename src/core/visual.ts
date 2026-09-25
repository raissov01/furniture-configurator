/** Жобаға байланған, тек көрініске әсер ететін жарық деректері. */
import { z } from 'zod'
import type { Vec3 } from './types'

type LightBase = { id: string; color: string; intensity: number }
export type SceneLight =
  | (LightBase & { kind: 'point'; position: Vec3 })
  | (LightBase & { kind: 'spot'; position: Vec3; target: Vec3; angleDegrees: number })
  | (LightBase & { kind: 'sun'; azimuthDegrees: number; elevationDegrees: number })

const vec3 = z.strictObject({ x: z.number().int(), y: z.number().int(), z: z.number().int() })
const base = { id: z.string().min(1).max(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  intensity: z.number().min(0).max(100) }

export const SceneLightSchema: z.ZodType<SceneLight> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('point'), ...base, position: vec3 }),
  z.strictObject({ kind: z.literal('spot'), ...base, position: vec3, target: vec3,
    angleDegrees: z.number().min(1).max(89) }),
  z.strictObject({ kind: z.literal('sun'), ...base,
    azimuthDegrees: z.number().min(-180).max(180),
    elevationDegrees: z.number().min(-90).max(90) }),
])

export const SceneLightsSchema = z.array(SceneLightSchema).superRefine((lights, context) => {
  const ids = new Set<string>()
  lights.forEach((light, index) => {
    if (ids.has(light.id)) context.addIssue({ code: 'custom', path: [index, 'id'],
      message: `Қайталанған жарық id: ${light.id}` })
    ids.add(light.id)
  })
})

/** Sun direction as a unit vector, from room centre toward the source. */
export function sunDirection(light: Extract<SceneLight, { kind: 'sun' }>): Vec3 {
  const azimuth = light.azimuthDegrees * Math.PI / 180
  const elevation = light.elevationDegrees * Math.PI / 180
  return { x: Math.sin(azimuth) * Math.cos(elevation),
    y: Math.sin(elevation), z: Math.cos(azimuth) * Math.cos(elevation) }
}
