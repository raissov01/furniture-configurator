/** Камера сәулесі ең тік қиып өтетін негізгі жазықтықтың нормаль өсі. */
import type { Axis, Vec3 } from '@/src/core/types'
import { ConfigValidationError } from '@/src/core/errors'

export function dragPlaneAxis(ray: Vec3): Axis {
  const axes: readonly Axis[] = ['y', 'z', 'x']
  if (axes.some((axis) => !Number.isFinite(ray[axis])) || axes.every((axis) => ray[axis] === 0)) {
    throw new ConfigValidationError('ray', 'сүйреу сәулесі жарамсыз', 'нөл емес шекті бағыт')
  }
  return [...axes].sort((a, b) => Math.abs(ray[b]) - Math.abs(ray[a]))[0]!
}
