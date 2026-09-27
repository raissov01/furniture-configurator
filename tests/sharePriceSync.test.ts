import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigurator } from '../store/configurator'

describe('клиент кодының бағасы', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('тек баға өзгерсе де share жаңарады: келісім ескі бағаны мөрлемейді', async () => {
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
      await useConfigurator.getState().syncShare()
      expect(calls[0]).toEqual({ url: '/api/share/123456', method: 'PUT', salePrice: 45_000_00 })
    } finally {
      useConfigurator.setState(before)
    }
  })

  it('қатар келген жіберулер соңғы жобаны ескісінен кейін жазады', async () => {
    const before = useConfigurator.getState()
    let releaseFirst: (() => void) | undefined
    const bodies: string[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body))
      if (bodies.length === 1) return new Promise<Response>((resolve) => {
        releaseFirst = () => resolve(new Response('{}', { status: 200 }))
      })
      return Promise.resolve(new Response('{}', { status: 200 }))
    }))
    try {
      useConfigurator.setState({ shareSession: { code: '123456', key: 'k', expiresAt: Date.now() + 60_000 } })
      const first = useConfigurator.getState().syncShare()
      useConfigurator.setState({ projectName: 'Соңғы нұсқа' })
      const last = useConfigurator.getState().syncShare()
      await Promise.resolve()
      expect(bodies).toHaveLength(1)
      releaseFirst?.()
      await Promise.all([first, last])
      expect(bodies).toHaveLength(2)
      expect(JSON.parse(bodies[1]!) as { name: string }).toMatchObject({ name: 'Соңғы нұсқа' })
    } finally {
      releaseFirst?.()
      useConfigurator.setState(before)
    }
  })
})
