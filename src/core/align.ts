/**
 * Таңдалған нысандарды әлемдегі AABB бойынша туралау және тең аралықпен
 * тарату. Кіріс қораптары готовый геометриядан алынуы керек; функциялар
 * панель өлшемін өзгертпейді, тек орнын ауыстырады. React/three тәуелдігі жоқ.
 *
 * UI ағаштың көп таңдауын және әлем→ата трансформасын енгізгенде осы
 * нәтижелердің min айырмасын түйін орнына қолданады.
 */
import { ConfigValidationError } from './errors'
import type { Box } from './geometry'
import type { Axis } from './types'

export type AlignableBox = { id: string; bounds: Box }
export type BoxAlignment = 'min' | 'center' | 'max'

/**
 * Орталықтар жарты мм-ге ерекшеленсе, жылжу ең жақын бүтін мм-ге,
 * дәл жартысында +∞ жағына дөңгелектенеді. Бұл редактордың орын ережесі,
 * өндірістік өлшем/кесу төзімділігі емес. Өлшем ешқашан дөңгелектенбейді.
 */
export const ALIGN_CENTER_ROUNDING = 'nearest-mm-half-toward-positive' as const

const AXES: readonly Axis[] = ['x', 'y', 'z']

function validate(boxes: readonly AlignableBox[], axis: Axis): void {
  if (!AXES.includes(axis)) {
    throw new ConfigValidationError('axis', 'белгісіз өс', 'x | y | z')
  }
  const seen = new Set<string>()
  for (const [index, box] of boxes.entries()) {
    const path = `boxes[${index}]`
    if (!box.id.trim() || seen.has(box.id)) {
      throw new ConfigValidationError(`${path}.id`, 'бос не қайталанған id', 'бос емес бірегей id')
    }
    seen.add(box.id)
    for (const key of AXES) {
      for (const side of ['min', 'max'] as const) {
        if (!Number.isSafeInteger(box.bounds[side][key])) {
          throw new ConfigValidationError(`${path}.bounds.${side}.${key}`, 'координата бүтін мм болуы керек', 'қауіпсіз бүтін сан')
        }
      }
      if (box.bounds.max[key] <= box.bounds.min[key]) {
        throw new ConfigValidationError(`${path}.bounds.max.${key}`, 'қораптың өлшемі оң болуы керек', `> ${box.bounds.min[key]} мм`)
      }
    }
  }
}

function safeCoordinate(value: bigint, path: string): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) {
    throw new ConfigValidationError(path, 'жылжудан кейінгі координата тым үлкен', 'қауіпсіз бүтін мм')
  }
  return result
}

function translate(box: AlignableBox, axis: Axis, delta: bigint): AlignableBox {
  return {
    id: box.id,
    bounds: {
      min: { ...box.bounds.min, [axis]: safeCoordinate(BigInt(box.bounds.min[axis]) + delta, `boxes[${box.id}].bounds.min.${axis}`) },
      max: { ...box.bounds.max, [axis]: safeCoordinate(BigInt(box.bounds.max[axis]) + delta, `boxes[${box.id}].bounds.max.${axis}`) },
    },
  }
}

/**
 * Таңдаудың сыртқы min/max/ортасына, не referenceId қорабының тиісті
 * бетіне/ортасына туралайды. Тізім реті, өлшемдері, өзге өстер сақталады.
 */
export function alignBoxes(
  boxes: readonly AlignableBox[],
  axis: Axis,
  alignment: BoxAlignment,
  referenceId?: string,
): AlignableBox[] {
  validate(boxes, axis)
  if (!(['min', 'center', 'max'] as const).includes(alignment)) {
    throw new ConfigValidationError('alignment', 'белгісіз туралау', 'min | center | max')
  }
  const reference = referenceId === undefined ? undefined : boxes.find((box) => box.id === referenceId)
  if (referenceId !== undefined && !reference) {
    throw new ConfigValidationError('referenceId', 'тірек нысан таңдалмаған', 'таңдалған нысанның id-і')
  }
  if (boxes.length === 0) return []
  let min = reference?.bounds.min[axis] ?? boxes[0]!.bounds.min[axis]
  let max = reference?.bounds.max[axis] ?? boxes[0]!.bounds.max[axis]
  if (!reference) {
    for (const box of boxes) {
      min = Math.min(min, box.bounds.min[axis])
      max = Math.max(max, box.bounds.max[axis])
    }
  }
  return boxes.map((box) => {
    let delta: bigint
    if (alignment === 'center') {
      // Екі еселенген орталық бүтін болып қалады; үлкен координатада да
      // float дәлдігі жоғалмайды. Теріс жарты да +∞ жағына дөңгелектенеді.
      const twiceDelta = BigInt(min) + BigInt(max) - BigInt(box.bounds.min[axis]) - BigInt(box.bounds.max[axis])
      delta = twiceDelta / 2n + (twiceDelta % 2n > 0n ? 1n : 0n)
    } else {
      delta = BigInt(alignment === 'min' ? min : max) - BigInt(box.bounds[alignment][axis])
    }
    return translate(box, axis, delta)
  })
}

/**
 * Таңдалған өс бойымен бос аралықтарды теңестіреді. Шеткі қораптар орнында;
 * қалдық мм төменгі координатадан бастап аралықтарға бір-бірден беріледі.
 * Бір координатада тұрған нысандар кіріс ретімен қалады. Орын жетпесе
 * қиылысты үнсіз жасамай, қате береді. Үштен аз нысан — өзгеріссіз.
 */
export function distributeBoxes(boxes: readonly AlignableBox[], axis: Axis): AlignableBox[] {
  validate(boxes, axis)
  if (boxes.length < 3) return boxes.map((box) => translate(box, axis, 0n))
  const sorted = boxes.map((box, index) => ({ box, index }))
    .sort((a, b) => a.box.bounds.min[axis] - b.box.bounds.min[axis] || a.index - b.index)
  const first = sorted[0]!.box
  const last = sorted[sorted.length - 1]!.box
  const width = (box: AlignableBox): bigint => BigInt(box.bounds.max[axis]) - BigInt(box.bounds.min[axis])
  const available = BigInt(last.bounds.max[axis]) - BigInt(first.bounds.min[axis])
    - sorted.reduce((total, entry) => total + width(entry.box), 0n)
  if (available < 0n) {
    throw new ConfigValidationError('distribution.gap', 'шеткі нысандар арасында орын жетпейді', 'бос аралық ≥ 0 мм')
  }
  const count = BigInt(boxes.length - 1)
  const gap = available / count
  const remainder = available % count
  const result: AlignableBox[] = new Array(boxes.length)
  let cursor = BigInt(first.bounds.min[axis])
  for (const [order, { box, index }] of sorted.entries()) {
    result[index] = translate(box, axis, cursor - BigInt(box.bounds.min[axis]))
    cursor += width(box) + gap + (BigInt(order) < remainder ? 1n : 0n)
  }
  return result
}
