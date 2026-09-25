/** Ағаш түйіндерінің детерминдік сызықтық көшірмелері. Бастапқы түйін сақталады. */
import { ConfigValidationError } from './errors'
import type { Axis } from './types'
import type { SceneNode } from './tree'

export type ArrayOptions = { axis: Axis; count: number; step: number; startIndex?: number }

export function arrayNodes(node: SceneNode, opts: ArrayOptions): SceneNode[] {
  if (!(['x', 'y', 'z'] as const).includes(opts.axis)) throw new ConfigValidationError('axis', 'белгісіз өс', 'x | y | z')
  if (!Number.isSafeInteger(opts.count) || opts.count < 1 || opts.count > 1000) {
    throw new ConfigValidationError('count', 'көшірме саны жарамсыз', '1–1000')
  }
  if (!Number.isSafeInteger(opts.step) || opts.step === 0) throw new ConfigValidationError('step', 'қадам бүтін мм және нөл емес болуы керек', 'бүтін мм ≠ 0')
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
      const value = source.transform.pos[opts.axis] + opts.step * offset
      if (!Number.isSafeInteger(value)) throw new ConfigValidationError(`transform.pos.${opts.axis}`, 'орын шектен асты', 'қауіпсіз бүтін мм')
      clone.transform.pos[opts.axis] = value
    }
    return clone
  }
  return Array.from({ length: opts.count }, (_, index) => copy(node, first + index, index + 1, true))
}
