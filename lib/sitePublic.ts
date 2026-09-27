/** Only publish origins supplied by deployment configuration. */
import type { Lang } from '@/lib/i18n'

export function publicOrigin(env: { NEXT_PUBLIC_SITE_URL?: string | undefined; VERCEL_URL?: string | undefined }): string | null {
  for (const raw of [env.NEXT_PUBLIC_SITE_URL, env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined]) {
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
        url.hostname.startsWith('127.') || url.hostname === '[::1]' || url.hostname === '0.0.0.0') continue
      return url.origin
    } catch {
      // Try the preview origin when a configured production URL is malformed.
    }
  }
  return null
}

export function siteAlternates(origin: string, lang: Lang): { canonical: string; languages: Record<Lang, string> } {
  const languages = {
    ru: `${origin}/`,
    kk: `${origin}/?lang=kk`,
    en: `${origin}/?lang=en`,
    uz: `${origin}/?lang=uz`,
  }
  return { canonical: languages[lang], languages }
}

/** Do not render a mailto link for placeholder or invalid addresses. */
export function contactEmail(env: { NEXT_PUBLIC_CONTACT_EMAIL?: string | undefined }): string | null {
  const email = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('@example.kz')
    ? email : null
}
