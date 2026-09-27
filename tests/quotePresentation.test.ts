import { describe, expect, it } from 'vitest'
import { quoteSummaryRows, readableBrandText, shopContactRows } from '../src/core/export/quotePresentation'

describe('КП клиентке көрсетілетін дерек', () => {
  it('ішкі құнды жасыртып, нөл жеңілдікті шығармайды', () => {
    expect(quoteSummaryRows({ grossTotal: 125000, discount: 0, total: 125000 }))
      .toEqual([{ title: 'К оплате', amount: 125000, prominent: true }])
    expect(quoteSummaryRows({ grossTotal: 125000, discount: 5000, total: 120000 }))
      .toEqual([
        { title: 'Итого', amount: 125000, prominent: false },
        { title: 'Скидка', amount: -5000, prominent: false },
        { title: 'К оплате', amount: 120000, prominent: true },
      ])
  })

  it('цехтың толтырылған реквизиттерін ғана береді', () => {
    expect(shopContactRows({ name: 'Цех', bin: '123456789012', phone: '+7 700', address: 'Астана, Абай 1', city: 'Астана' }))
      .toEqual(['Цех', 'БИН: 123456789012', 'Телефон: +7 700', 'Адрес: Астана, Абай 1'])
  })

  it('ашық бренд түсінде мәтін қара болып оқылады', () => {
    expect(readableBrandText('#F2A33A')).toBe('#1F2A37')
    expect(readableBrandText('#1F2A37')).toBe('#1F2A37')
  })
})
