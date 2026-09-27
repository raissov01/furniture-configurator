import type { MetadataRoute } from 'next'
import { publicOrigin, siteAlternates } from '@/lib/sitePublic'

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_URL: process.env.VERCEL_URL })
  if (!origin) return []
  const urls = siteAlternates(origin, 'ru').languages
  return Object.values(urls).map((url) => ({ url, changeFrequency: 'weekly', priority: 1 }))
}
