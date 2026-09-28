import { describe, expect, it } from 'vitest'
import { codeEntryValidation, publicShareIdentity } from '@/lib/codeEntryState'

describe('code entry state', () => {
  it('keeps invalid drafts invalid instead of stripping text or rounding', () => {
    for (const value of ['', '12a456', '12345.6', '12345', '1234567']) {
      expect(codeEntryValidation(value)).toEqual({ code: null, error: 'Код: ровно 6 цифр' })
    }
    expect(codeEntryValidation('012345')).toEqual({ code: '012345', error: null })
  })

  it('exposes only a shop identity and a safe WhatsApp link', () => {
    expect(publicShareIdentity({ name: '  Алаш  ', phone: '+7 (777) 123-45-67', logoDataUrl: 'data:image/png;base64,AA==' }))
      .toEqual({ name: 'Алаш', phone: '+7 (777) 123-45-67', logoDataUrl: 'data:image/png;base64,AA==', whatsappUrl: 'https://wa.me/77771234567' })
    expect(publicShareIdentity({ name: 'Алаш', phone: 'call me' })?.whatsappUrl).toBeNull()
    expect(publicShareIdentity(null)).toBeNull()
  })
})
