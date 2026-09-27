import { describe, expect, it } from 'vitest'
import { BASIS_FITTING_ITEMS, BASIS_MODULE_ITEMS, basisModuleChoice, categoryOptions, filterItems } from '../components/panels/libraryCatalogLogic'
import { parseBasisModule } from '../src/core/data/basisModules'

describe('Базис кітапханасының UI дерегі', () => {
  it('барлық модуль мен фурнитураны іздеу/санат механизміне қосады', () => {
    expect(BASIS_MODULE_ITEMS).toHaveLength(6948)
    expect(BASIS_FITTING_ITEMS).toHaveLength(3645)
    expect(categoryOptions(BASIS_MODULE_ITEMS)).toContain('Базис: Кухня')
    expect(categoryOptions(BASIS_MODULE_ITEMS)).toContain('Базис: Gola')
    expect(filterItems(BASIS_MODULE_ITEMS, { search: 'ШВ720', categoryPath: 'Базис: Кухня' }).length).toBeGreaterThan(0)
    const gola = filterItems(BASIS_MODULE_ITEMS, { search: 'ШВ720', categoryPath: 'Базис: Gola' })
    expect(gola.length).toBeGreaterThan(0)
    expect(gola.every((item) => item.module.system === 'gola')).toBe(true)
  })

  it('H × W × D мен 1/2 есікті ғана тура генератор өлшеміне өткізеді', () => {
    expect(basisModuleChoice(parseBasisModule('ШВ720х300х600-2Д'))).toEqual({
      allowed: true, templateId: 'kitchen-wall-600',
      size: { height: 720, width: 600, depth: 300 }, frontCount: 2,
    })
    expect(basisModuleChoice(parseBasisModule('ШН720х500х400-1Д')).allowed).toBe(true)
  })

  it('Gola, ящик, қосымша белгі, қол бағыты мен ауқымнан тыс өлшемді көрсетеді', () => {
    expect(basisModuleChoice(parseBasisModule('ШВ720х300х600-2Д', 'gola'))).toMatchObject({ allowed: false, reason: 'gola' })
    expect(basisModuleChoice(parseBasisModule('ШН720х500х600-2ящ'))).toMatchObject({ allowed: false, reason: 'unsupportedDetail' })
    expect(basisModuleChoice(parseBasisModule('ШВ720х300х600-2Д-СП8'))).toMatchObject({ allowed: false, reason: 'unsupportedDetail' })
    expect(basisModuleChoice(parseBasisModule('ШВ720х300х600-1Д-лв'))).toMatchObject({ allowed: false, reason: 'unsupportedDetail' })
    expect(basisModuleChoice(parseBasisModule('ШВ1080х300х600-2Д'))).toMatchObject({ allowed: false, reason: 'range' })
    expect(basisModuleChoice(parseBasisModule('Аксессуар'))).toMatchObject({ allowed: false, reason: 'unmatched' })
  })
})
