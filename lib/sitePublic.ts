/** Only publish origins supplied by deployment configuration. */
export function publicOrigin(env: { NEXT_PUBLIC_SITE_URL?: string | undefined; VERCEL_URL?: string | undefined }): string | null {
  const raw = env.NEXT_PUBLIC_SITE_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return null
    return url.origin
  } catch {
    return null
  }
}

/** Do not render a mailto link for placeholder or invalid addresses. */
export function contactEmail(env: { NEXT_PUBLIC_CONTACT_EMAIL?: string | undefined }): string | null {
  const email = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('@example.kz')
    ? email : null
}
