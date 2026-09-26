import { describe, expect, it } from 'vitest'
import { approvalWhatsAppUrl } from '../lib/mobile/approvalShare'

describe('клиентке келісім хабарламасы', () => {
  it('телефонды, КП бағасын, сілтемені және екі кодты wa.me хабарламасына салады', () => {
    const url = new URL(approvalWhatsAppUrl({
      phone: '+7 (701) 123-45-67', projectName: 'Ас үй', priceMinor: 1_250_050,
      shareCode: '123456', confirmationCode: '654321',
      link: 'https://example.kz/view?c=123456',
    }))
    expect(url.origin).toBe('https://wa.me')
    expect(url.pathname).toBe('/77011234567')
    const message = url.searchParams.get('text') ?? ''
    expect(message).toContain('Ас үй')
    expect(message).toMatch(/12[\s\u00a0]500,50/)
    expect(message).toContain('https://example.kz/view?c=123456')
    expect(message).toContain('123456')
    expect(message).toContain('654321')
  })

  it('қате телефон, URL, код немесе тиын мәнін өткізбейді', () => {
    const good = {
      phone: '+77011234567', projectName: 'Жоба', priceMinor: 10_000,
      shareCode: '123456', confirmationCode: '654321', link: 'https://example.kz/view?c=123456',
    }
    expect(() => approvalWhatsAppUrl({ ...good, phone: 'abc' })).toThrow(/phone/)
    expect(() => approvalWhatsAppUrl({ ...good, link: 'javascript:alert(1)' })).toThrow(/link/)
    expect(() => approvalWhatsAppUrl({ ...good, confirmationCode: '123' })).toThrow(/confirmationCode/)
    expect(() => approvalWhatsAppUrl({ ...good, priceMinor: 10.5 })).toThrow(/priceMinor/)
  })
})
