import { describe, expect, it } from 'vitest'
import { validateBin, validateShopLogo } from '../lib/shopBranding'
import { defaultShopProfile, parseShopProfile } from '../src/core/shop'

describe('цехтың КП реквизиттері', () => {
  it('БИН дәл 12 цифр болмағанда күйге жазылмайды', () => {
    expect(validateBin('')).toBeNull()
    expect(validateBin('123456789012')).toBeNull()
    expect(validateBin('123')).toMatch(/БИН.*12/)
    expect(validateBin('12345678901x')).toMatch(/БИН.*12/)
  })

  it('логотип түрі мен өлшемі шектеледі', () => {
    expect(validateShopLogo({ type: 'image/png', size: 100 })).toBeNull()
    expect(validateShopLogo({ type: 'image/svg+xml', size: 100 })).toMatch(/PNG/)
    expect(validateShopLogo({ type: 'image/jpeg', size: 750_001 })).toMatch(/750/)
  })

  it('ескі профиль оқылады, жаңа реквизиттер сақталады', () => {
    const shop = defaultShopProfile()
    expect(parseShopProfile(shop).name).toBe(shop.name)
    const updated = { ...shop, bin: '123456789012', address: 'Астана, Абай 1', brandColor: '#1F2A37' }
    expect(parseShopProfile(updated)).toMatchObject({ bin: updated.bin, address: updated.address,
      brandColor: updated.brandColor })
  })
})
