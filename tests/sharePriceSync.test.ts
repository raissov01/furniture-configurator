import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigurator } from '../store/configurator'

describe('клиент кодының бағасы', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('тек баға өзгерсе де share жаңарады: келісім ескі бағаны мөрлемейді', () => {
    const before = useConfigurator.getState()
    const calls: { url: string; method: string | undefined; salePrice: number | undefined }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { priceOverrides?: { salePrice?: number } } : {}
      calls.push({ url, method: init?.method, salePrice: body.priceOverrides?.salePrice })
      return new Response('{}')
    }))
    try {
      useConfigurator.setState({ shareSession: { code: '123456', key: 'k', expiresAt: Date.now() + 60_000 } })
      useConfigurator.getState().editPriceOverrides({ salePrice: 45_000_00 })
      expect(calls).toEqual([{ url: '/api/share/123456', method: 'PUT', salePrice: 45_000_00 }])
    } finally {
      useConfigurator.setState(before)
    }
  })
})
