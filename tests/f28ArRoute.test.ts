import { describe, expect, it } from 'vitest'
import { GET } from '../app/ar/[id]/route'

describe('F28 AR preview', () => {
  it('starts on the cabinet front at negative Z', async () => {
    const response = await GET(new Request('https://example.test/ar/test'),
      { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const html = await response.text()
    expect(html).toContain('camera-orbit="180deg 75deg auto"')
  })
})
