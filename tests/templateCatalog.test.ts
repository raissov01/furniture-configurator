import { describe, expect, it } from 'vitest'
import { filterTemplateCatalog } from '../src/core/templateCatalog'
import { SEED_TEMPLATES } from '../src/core/templates'

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
