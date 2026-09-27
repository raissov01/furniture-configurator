import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/sitePublic'

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_URL: process.env.VERCEL_URL })
  return { rules: { userAgent: '*', allow: '/' }, ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}) }
}
