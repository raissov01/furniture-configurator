import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/sitePublic'

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_URL: process.env.VERCEL_URL })
  return origin ? [{ url: origin, changeFrequency: 'weekly', priority: 1 }] : []
}
