'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { t as tr } from '@/lib/i18n'
import { routeMetadata } from '@/lib/routeMetadata'

export function LocaleMetadata() {
  const pathname = usePathname()
  useLayoutEffect(() => {
    const metadata = routeMetadata(pathname, tr)
    if (!metadata) return
    document.title = metadata.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', metadata.description)
  }, [pathname])
  return null
}
