import { describe, expect, it } from 'vitest'
import { GET } from '../app/ar/[id]/route'

describe('F28 AR preview', () => {
  it('starts on the cabinet front at negative Z', async () => {
    const response = await GET(new Request('https://example.test/ar/test'),
      { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const html = await response.text()
    expect(html).toContain('camera-orbit="180deg 75deg auto"')
  })

  it('renders the selected language in the AR document and invalid-id response', async () => {
    const response = await GET(new Request('https://example.test/ar/test?lang=en'),
      { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    const html = await response.text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('View in room')
    expect(html).not.toContain('Наведите камеру')
    const invalid = await GET(new Request('https://example.test/ar/invalid?lang=kk'),
      { params: Promise.resolve({ id: 'invalid' }) })
    expect(invalid.status).toBe(404)
    expect(await invalid.text()).toBe('Табылмады')
  })
})
