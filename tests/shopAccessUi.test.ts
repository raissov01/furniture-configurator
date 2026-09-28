import { describe, expect, it } from 'vitest'
import { shopEditAccess } from '../lib/shopAccessUi'

describe('цех терезесінің рұқсаты', () => {
  it('designer бағаларды қарайды, бірақ өзгертпейді', () => {
    expect(shopEditAccess('designer')).toEqual({ canRead: true, canEdit: false })
  })
  it('иесі және жергілікті қонақ өңдейді', () => {
    expect(shopEditAccess('owner')).toEqual({ canRead: true, canEdit: true })
    expect(shopEditAccess(null)).toEqual({ canRead: true, canEdit: true })
  })
  it('shop ішкі бағаларды көрмейді', () => {
    expect(shopEditAccess('shop')).toEqual({ canRead: false, canEdit: false })
  })
})
