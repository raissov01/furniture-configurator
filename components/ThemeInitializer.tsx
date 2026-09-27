'use client'

import { useLayoutEffect } from 'react'
import { initializeSavedTheme } from '@/lib/appearance'

export function ThemeInitializer() {
  useLayoutEffect(() => { initializeSavedTheme() }, [])
  return null
}
