import { describe, expect, it } from 'vitest'
import { publicOrigin, contactEmail } from '../lib/sitePublic'

describe('public site configuration', () => {
  it('uses a confirmed absolute origin for social and sitemap URLs', () => {
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: 'https://preview.example.kz/path/' })).toBe('https://preview.example.kz')
    expect(publicOrigin({ VERCEL_URL: 'aismebel-preview.vercel.app' })).toBe('https://aismebel-preview.vercel.app')
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: 'http://staging.example.kz:3000/' })).toBe('http://staging.example.kz:3000')
  })

  it('does not publish localhost or malformed origins', () => {
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' })).toBeNull()
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' })).toBeNull()
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: 'not a url' })).toBeNull()
  })

  it('hides example contacts until a real address is configured', () => {
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: 'hello@example.kz' })).toBeNull()
    expect(contactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: 'sales@aismebel.kz' })).toBe('sales@aismebel.kz')
  })
})
