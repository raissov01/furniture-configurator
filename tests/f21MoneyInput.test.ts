import { describe, expect, it } from 'vitest'
import { formatMoneyDraft, parseMoneyDraft } from '../lib/moneyDraft'

describe('F21 ақша өрістері', () => {
  it('тиынды дәл оқып, қайта көрсетеді', () => {
    expect(parseMoneyDraft('1.25', 'Кромка бағасы')).toEqual({ value: 125 })
    expect(parseMoneyDraft('0,01', 'Сату бағасы')).toEqual({ value: 1 })
    expect(formatMoneyDraft(125)).toBe('1.25')
  })
  it('бос, теріс, үш ондық және шектен тыс мәнді жазбайды', () => {
    for (const raw of ['', '-5', '1.235', '1e20', 'мәтін']) {
      const result = parseMoneyDraft(raw, 'Кромка бағасы')
      expect(result.value).toBeUndefined()
      expect(result.error).toContain('Кромка бағасы')
      expect(result.error).toContain('0..')
    }
  })
})
