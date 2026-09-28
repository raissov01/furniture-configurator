import { describe, expect, it } from 'vitest'
import { templateCountLabel } from '../lib/templateCount'

describe('үлгі саны', () => {
  it('орысша жалғауды дұрыс таңдайды', () => {
    expect(templateCountLabel(1, 'ru')).toBe('1 шаблон')
    expect(templateCountLabel(2, 'ru')).toBe('2 шаблона')
    expect(templateCountLabel(5, 'ru')).toBe('5 шаблонов')
    expect(templateCountLabel(11, 'ru')).toBe('11 шаблонов')
  })
  it('ағылшынша мен қазақша атауы оқылады', () => {
    expect(templateCountLabel(1, 'en')).toBe('1 template')
    expect(templateCountLabel(2, 'kk')).toBe('2 үлгі')
  })
})
