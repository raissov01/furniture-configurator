import { notFound } from 'next/navigation'
import { ThumbStudio } from '@/components/ThumbStudio'

/**
 * Шаблон превьюлерін түсіретін ІШКІ бет: тек `next dev` пен
 * `scripts/renderTemplateThumbs.mjs` үшін. Продта жоқ.
 */
export const metadata = { robots: { index: false, follow: false } }

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ThumbStudio />
}
