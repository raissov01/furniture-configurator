import type { Metadata } from 'next'
import LandingPage from '@/components/site/LandingPage'
import { publicOrigin } from '@/lib/sitePublic'

const origin = publicOrigin({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_URL: process.env.VERCEL_URL })

/** The canonical homepage must not leak into private configurator routes. */
export const metadata: Metadata = origin ? { alternates: { canonical: '/' } } : {}

export default function Page() {
  return <LandingPage />
}
