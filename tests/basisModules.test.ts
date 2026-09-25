import { describe, expect, it } from 'vitest'
import {
  BASIS_MODULES,
  basisModuleStats,
  parseBasisModule,
} from '../src/core/data/basisModules'

describe('Базис ас үй модулінің атау талдағышы', () => {
  it('H×D×W ретін H/W/D өрістеріне ауыстырады және белгілерді сақтайды', () => {
    expect(parseBasisModule('ШВ720х300х600-СП8-1Д+1Д-лв')).toEqual({
      raw: 'ШВ720х300х600-СП8-1Д+1Д-лв',
      kind: 'wall',
      height: 720,
      depth: 300,
      width: 600,
      doors: 2,
      drawers: 0,
      tokens: ['СП8', '1Д+1Д'],
      hand: 'left',
      count: 1,
      system: 'standard',
    })
  })

  it('Gola контекстін таза функцияға беруге болады', () => {
    expect(parseBasisModule('ШН780×550×600-СН-2БГ-пр', { system: 'gola' })).toMatchObject({
      kind: 'base', height: 780, depth: 550, width: 600,
      doors: 0, drawers: 2, hand: 'right', system: 'gola',
    })
    expect(parseBasisModule('ШН780×550×600-СН-2БГ-пр', 'gola').system).toBe('gola')
  })

  it('есіктер мен ящиктер аралас белгілерде жеке саналады', () => {
    expect(parseBasisModule('ШВ1080x300x1000-СП8-1БГ+2Д-Сушка-900-лв')).toMatchObject({
      doors: 2, drawers: 1, tokens: ['СП8', '1БГ+2Д', 'Сушка', '900'],
    })
    expect(parseBasisModule('ШП2540х550х900-СП8-Шкаф-2Д-3Д')).toMatchObject({ doors: 5, drawers: 0 })
  })

  it('шкаф емес 9 атауды қауіпсіз түрде unmatched деп қайтарады', () => {
    const parsed = parseBasisModule('Мойка Прямоугольная 600 лв')
    expect(parsed).toMatchObject({ kind: null, height: null, depth: null, width: null, doors: null, drawers: null })
    expect(parsed.tokens).toEqual([])
  })

  it('JSON-дегі 6 948 жазба мен статистика дерек тұтастығын ұстайды', () => {
    expect(BASIS_MODULES).toHaveLength(6948)
    expect(BASIS_MODULES.filter((item) => item.kind !== null)).toHaveLength(6939)
    expect(BASIS_MODULES.filter((item) => item.system === 'standard')).toHaveLength(4593)
    expect(BASIS_MODULES.filter((item) => item.system === 'gola')).toHaveLength(2355)
    expect(basisModuleStats()).toEqual({ total: 6948, parsed: 6939, unmatched: 9, standard: 4593, gola: 2355 })
  })

  it('дерек JSON-ы parser-мен қайта тексеріледі', () => {
    for (const item of BASIS_MODULES) {
      expect(parseBasisModule(item.raw, { system: item.system }), item.raw).toEqual(item)
    }
  })
})
