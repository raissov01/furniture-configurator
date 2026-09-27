import { describe, expect, it } from 'vitest'
import { visibleCategoryOptions } from '@/components/panels/libraryCatalogLogic'

describe('кітапхана санат таңдағышы', () => {
  const categories = Array.from({ length: 4624 }, (_, index) => `Санат ${String(index).padStart(4, '0')}`)

  it('бастапқы DOM-ға тек алғашқы 40 нұсқаны береді', () => {
    expect(visibleCategoryOptions(categories, '', null)).toHaveLength(40)
  })

  it('іздеу арқылы кейінгі санатқа жетеді және таңдалғанын сақтайды', () => {
    expect(visibleCategoryOptions(categories, '4623', null)).toEqual(['Санат 4623'])
    expect(visibleCategoryOptions(categories, '', 'Санат 4623')).toContain('Санат 4623')
  })
})
