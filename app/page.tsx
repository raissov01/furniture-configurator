import type { Metadata } from 'next'
import LandingPage from '@/components/site/LandingPage'
import { publicOrigin, siteAlternates } from '@/lib/sitePublic'
import { siteLanguageFromQuery } from '@/lib/siteLocale'

const origin = publicOrigin({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, VERCEL_URL: process.env.VERCEL_URL })
type PageProps = { searchParams: Promise<{ lang?: string | string[] }> }

/** Each public language has its own canonical URL; private routes inherit none. */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  if (!origin) return {}
  const lang = siteLanguageFromQuery((await searchParams).lang)
  return { alternates: siteAlternates(origin, lang) }
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  return <LandingPage initialLang={siteLanguageFromQuery(params.lang)} explicit={params.lang !== undefined} />
}
