/** Ағаш түйіндерінің детерминдік сызықтық көшірмелері. Бастапқы түйін сақталады. */
import { ConfigValidationError } from './errors'
import type { Axis } from './types'
import type { SceneNode } from './tree'

export type ArrayOptions = { axis: Axis; count: number; step: number; startIndex?: number; parentRotationY?: number }

export function arrayNodes(node: SceneNode, opts: ArrayOptions): SceneNode[] {
  if (!(['x', 'y', 'z'] as const).includes(opts.axis)) throw new ConfigValidationError('axis', 'белгісіз өс', 'x | y | z')
  if (!Number.isSafeInteger(opts.count) || opts.count < 1 || opts.count > 1000) {
    throw new ConfigValidationError('count', 'көшірме саны жарамсыз', '1–1000')
  }
  if (!Number.isSafeInteger(opts.step) || opts.step === 0) throw new ConfigValidationError('step', 'қадам бүтін мм және нөл емес болуы керек', 'бүтін мм ≠ 0')
  const radians = (opts.parentRotationY ?? 0) * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const localStep = {
    x: opts.axis === 'x' ? opts.step * cos : opts.axis === 'z' ? -opts.step * sin : 0,
    y: opts.axis === 'y' ? opts.step : 0,
    z: opts.axis === 'x' ? opts.step * sin : opts.axis === 'z' ? opts.step * cos : 0,
  }
  const first = opts.startIndex ?? 1
  if (!Number.isSafeInteger(first) || first < 1 || !Number.isSafeInteger(first + opts.count - 1)) {
    throw new ConfigValidationError('startIndex', 'рет нөмірі жарамсыз', 'қауіпсіз оң бүтін сан')
  }
  const copy = (source: SceneNode, suffix: number, offset: number, top: boolean): SceneNode => {
    const clone: SceneNode = { ...structuredClone(source), id: `${source.id}-array-${suffix}`, name: `${source.name} ${suffix}`,
      transform: { pos: { ...source.transform.pos }, rot: { ...source.transform.rot } },
      ...(source.kind === 'group' ? { children: source.children.map((child) => copy(child, suffix, offset, false)) } : {}) } as SceneNode
    if (clone.kind === 'cabinet') clone.config = { ...clone.config, id: clone.id, name: clone.name }
    if (top) {
      for (const axis of ['x', 'y', 'z'] as const) {
        const value = source.transform.pos[axis] + localStep[axis] * offset
        const rounded = Math.round(value)
        if (!Number.isSafeInteger(rounded) || Math.abs(value - rounded) > 1e-7) {
          throw new ConfigValidationError(`transform.pos.${axis}`, 'әлем қадамы ата осінде бүтін мм бермейді', '90°-қа еселі бұрылыс және қауіпсіз бүтін мм')
        }
        clone.transform.pos[axis] = rounded === 0 ? 0 : rounded
      }
    }
    return clone
  }
  return Array.from({ length: opts.count }, (_, index) => copy(node, first + index, index + 1, true))
}
