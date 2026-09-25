import { describe, expect, it } from 'vitest'
import { filterTemplateCatalog } from '../src/core/templateCatalog'
import { SEED_TEMPLATES } from '../src/core/templates'
import { KITCHEN_EXPANSION_TEMPLATES } from '../src/core/templatesKitchenExpansion'
import { WARDROBE_EXPANSION_TEMPLATES } from '../src/core/templatesWardrobeExpansion'

const sample = [
  { ...SEED_TEMPLATES[0]!, id: 'k-base', name: 'Нижний шкаф', description: '', category: 'kitchen' as const, subcategory: 'Нижние' },
  { ...SEED_TEMPLATES[0]!, id: 'k-wall', name: 'Верхний шкаф', description: '', category: 'kitchen' as const, subcategory: 'Верхние' },
  { ...SEED_TEMPLATES[0]!, id: 'w-slide', name: 'Шкаф купе', description: '', category: 'wardrobe' as const, subcategory: 'Купе' },
]

describe('каталог іздеуі', () => {
  it('әр дайын шаблонның санаты және ішкі санаты бар', () => {
    expect(SEED_TEMPLATES.every((template) => Boolean(template.subcategory))).toBe(true)
    expect(SEED_TEMPLATES.find((template) => template.id === 'bathroom-600')?.category).toBe('bathroom')
    expect(SEED_TEMPLATES.find((template) => template.id === 'shoe-rack-800')?.category).toBe('entry')
  })

  it('әр кеңейту SEED_TEMPLATES және ағаш эквиваленттік тізіміне кіреді', () => {
    const ids = new Set(SEED_TEMPLATES.map((template) => template.id))
    for (const template of [...KITCHEN_EXPANSION_TEMPLATES, ...WARDROBE_EXPANSION_TEMPLATES]) {
      expect(ids.has(template.id), template.id).toBe(true)
    }
    expect(ids.size).toBe(45)
  })

  it('ұсынылған ен қатары реттелген және бастапқы ен сол қатарда', () => {
    for (const template of SEED_TEMPLATES) {
      if (!template.recommendedWidths) continue
      expect(template.recommendedWidths).toEqual([...new Set(template.recommendedWidths)].sort((a, b) => a - b))
      expect(template.recommendedWidths).toContain(template.width)
      expect(template.recommendedWidths[0]).toBeGreaterThanOrEqual(template.range.width.min)
      expect(template.recommendedWidths.at(-1)).toBeLessThanOrEqual(template.range.width.max)
    }
    expect(SEED_TEMPLATES.find((template) => template.id === 'kitchen-base-drawers-4-600')?.recommendedWidths)
      .toEqual([300, 400, 500, 600, 700, 800, 900])
  })

  it('санат пен ішкі санатты бірге сүзеді', () => {
    expect(filterTemplateCatalog(sample, { category: 'kitchen', subcategory: 'Верхние' }).map((t) => t.id))
      .toEqual(['k-wall'])
  })

  it('іздеуді регистрге тәуелсіз етеді және екі тілдегі атауды табады', () => {
    const translate = (value: string) => value === 'Шкаф купе' ? 'Жылжымалы есікті шкаф' : value
    expect(filterTemplateCatalog(sample, { search: '  ЖЫЛЖЫМАЛЫ  ' }, translate).map((t) => t.id))
      .toEqual(['w-slide'])
    expect(filterTemplateCatalog(sample, { search: 'шкаф' }, translate).map((t) => t.id))
      .toEqual(['k-base', 'k-wall', 'w-slide'])
  })

  it('бірнеше сөзді сол карточканың мәтінінен іздейді', () => {
    expect(filterTemplateCatalog(sample, { search: 'купе шкаф' }).map((t) => t.id))
      .toEqual(['w-slide'])
    expect(filterTemplateCatalog(sample, { search: 'купе нижний' })).toEqual([])
  })
})
