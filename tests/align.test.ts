import { describe, expect, it } from 'vitest'
import { alignBoxes, distributeBoxes } from '../src/core/align'
import type { AlignableBox } from '../src/core/align'
import { ConfigValidationError } from '../src/core/errors'
import type { Axis } from '../src/core/types'

function item(id: string, start: number, size: number, axis: Axis = 'x'): AlignableBox {
  const min = { x: -20, y: 30, z: 70 }
  const max = { x: 80, y: 130, z: 170 }
  min[axis] = start
  max[axis] = start + size
  return { id, bounds: { min, max } }
}

describe('AABB бойынша туралау', () => {
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const [mode, expected] of [
      ['min', [10, 10, 10]], ['max', [130, 110, 150]], ['center', [70, 60, 80]],
    ] as const) {
      it(`${axis} / ${mode}: өлшем мен басқа өстер сақталады`, () => {
        const input = [item('a', 10, 40, axis), item('b', 80, 60, axis), item('c', 150, 20, axis)]
        const before = structuredClone(input)
        const output = alignBoxes(input, axis, mode)
        expect(output.map((entry) => entry.bounds.min[axis])).toEqual(expected)
        output.forEach((entry, i) => {
          expect(entry.bounds.max[axis] - entry.bounds.min[axis]).toBe(before[i]!.bounds.max[axis] - before[i]!.bounds.min[axis])
          for (const other of ['x', 'y', 'z'] as const) {
            if (other !== axis) expect([entry.bounds.min[other], entry.bounds.max[other]])
              .toEqual([before[i]!.bounds.min[other], before[i]!.bounds.max[other]])
          }
        })
        expect(input).toEqual(before)
      })
    }
  }

  it('негізгі нысанға туралайды, өзі орнында қалады', () => {
    const input = [item('a', -80, 40), item('anchor', 10, 50), item('c', 150, 20)]
    const output = alignBoxes(input, 'x', 'max', 'anchor')
    expect(output.map((entry) => entry.bounds.min.x)).toEqual([20, 10, 40])
    expect(output[1]).toEqual(input[1])
  })

  it('жарты мм орталық айырмасын +∞ жағына дөңгелектейді: тек бүтін орын', () => {
    const output = alignBoxes([item('a', -20, 20), item('b', 1, 21)], 'x', 'center', 'b')
    expect(output[0]!.bounds.min.x).toBe(2)
    expect(output[0]!.bounds.max.x).toBe(22)
    const negative = alignBoxes([item('a', 0, 20), item('b', -2, 21)], 'x', 'center', 'b')
    expect(negative[0]!.bounds.min.x).toBe(-1)
  })

  it('бос/жалғыз таңдау — өзгеріссіз, нәтиже тәуелсіз', () => {
    expect(alignBoxes([], 'x', 'min')).toEqual([])
    const one = [item('a', 10, 40)]
    const result = alignBoxes(one, 'x', 'center')
    expect(result).toEqual(one)
    result[0]!.bounds.min.y = 0
    expect(one[0]!.bounds.min.y).toBe(30)
  })

  it('жоқ referenceId — өріс аты бар қате', () => {
    expect(() => alignBoxes([item('a', 0, 20)], 'x', 'min', 'missing')).toThrow(/referenceId/)
  })
})

describe('AABB арасындағы бос орынды тең тарату', () => {
  for (const axis of ['x', 'y', 'z'] as const) {
    it(`${axis}: сыртқы екеуі қозғалмайды, қалдық мм солдан оңға`, () => {
      const input = [item('c', 80, 30, axis), item('a', -10, 10, axis), item('d', 123, 10, axis), item('b', 20, 20, axis)]
      const before = structuredClone(input)
      const result = distributeBoxes(input, axis)
      // Span 143, widths 70 -> 73 free mm -> gaps 25, 24, 24.
      expect(result.map((entry) => entry.id)).toEqual(['c', 'a', 'd', 'b'])
      expect(result.map((entry) => entry.bounds.min[axis])).toEqual([69, -10, 123, 25])
      expect(result[1]).toEqual(input[1])
      expect(result[2]).toEqual(input[2])
      expect(input).toEqual(before)
      for (const [i, entry] of result.entries()) {
        for (const other of ['x', 'y', 'z'] as const) {
          expect(entry.bounds.max[other] - entry.bounds.min[other]).toBe(input[i]!.bounds.max[other] - input[i]!.bounds.min[other])
          if (other !== axis) expect(entry.bounds.min[other]).toBe(input[i]!.bounds.min[other])
        }
      }
    })
  }

  it('үштен аз болса өзгеріс жоқ', () => {
    expect(distributeBoxes([], 'x')).toEqual([])
    const input = [item('b', 100, 50), item('a', 0, 20)]
    const result = distributeBoxes(input, 'x')
    expect(result).toEqual(input)
    result[0]!.bounds.min.x = 0
    expect(input[0]!.bounds.min.x).toBe(100)
  })

  it('бірдей бастапқы координатада кіріс реті тұрақты, қиылысуды жояды', () => {
    const result = distributeBoxes([item('a', 0, 10), item('b', 0, 20), item('c', 100, 30)], 'x')
    expect(result.map((entry) => entry.bounds.min.x)).toEqual([0, 45, 100])
  })

  it('бос аралық нөл болса қораптар тек жанасады', () => {
    const result = distributeBoxes([item('a', 0, 20), item('b', 5, 20), item('c', 40, 20)], 'x')
    expect(result.map((entry) => entry.bounds.min.x)).toEqual([0, 20, 40])
  })

  it('сыртқы шекарада орын жетпесе нысандарды қабаттастырмайды', () => {
    expect(() => distributeBoxes([item('a', 0, 40), item('b', 10, 40), item('c', 20, 40)], 'x'))
      .toThrow(/distribution.gap/)
  })
})

describe('туралау/тарату кірісінің валидациясы', () => {
  const operations = [
    (boxes: AlignableBox[]) => alignBoxes(boxes, 'x', 'min'),
    (boxes: AlignableBox[]) => distributeBoxes(boxes, 'x'),
  ]
  for (const [index, operation] of operations.entries()) {
    it(`${index}: id қайталанса қате`, () => {
      expect(() => operation([item('same', 0, 10), item('same', 40, 20)]))
        .toThrow(ConfigValidationError)
    })
    it(`${index}: бос id қате`, () => {
      expect(() => operation([item('', 0, 10)])).toThrow(/boxes\[0\].id/)
    })
    for (const invalid of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      it(`${index}: ${invalid} координата бүтін қауіпсіз мм емес`, () => {
        const box = item('a', 0, 10)
        box.bounds.min.z = invalid
        expect(() => operation([box])).toThrow(/boxes\[0\].bounds.min.z/)
      })
    }
    it(`${index}: теріс/нөл өлшем қате`, () => {
      expect(() => operation([item('a', 10, -1)])).toThrow(/bounds.max.x/)
      expect(() => operation([item('a', 10, 0)])).toThrow(/bounds.max.x/)
    })
  }
})
