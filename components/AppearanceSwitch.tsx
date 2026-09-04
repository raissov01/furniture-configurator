'use client'

/**
 * Тема мен 3D сапасының қосқышы.
 *
 * Екеуі де БРАУЗЕРДЕ сақталады (жобада емес): бұл — адамның өз ыңғайы.
 * Тема гидратациядан КЕЙІН қолданылады — серверде localStorage жоқ, ал
 * бірінші рендерді басқа қылсақ, React ескертеді.
 */

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { applyTheme, readQuality, readTheme, saveQuality, saveTheme } from '@/lib/appearance'
import type { Quality, Theme } from '@/lib/appearance'
import { useConfigurator } from '@/store/configurator'

const THEME_ICON: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' }
const THEME_NAME: Record<Theme, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
}
const QUALITY_NAME: Record<Quality, string> = {
  low: 'Экономно',
  medium: 'Средне',
  high: 'Максимум',
}

export function AppearanceSwitch() {
  const [theme, setTheme] = useState<Theme>('system')
  const quality = useConfigurator((s) => s.quality)
  const setQuality = useConfigurator((s) => s.setQuality)

  useEffect(() => {
    const saved = readTheme()
    setTheme(saved)
    applyTheme(saved)
    setQuality(readQuality())
  }, [setQuality])

  const cycleTheme = () => {
    // Үш күй бір батырмада: жүйе → ақ → қараңғы → жүйе.
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  const cycleQuality = () => {
    const next: Quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high'
    setQuality(next)
    saveQuality(next)
  }

  return (
    <div className="flex items-center gap-1">
      <Button onClick={cycleTheme} title={`${tr('Тема')}: ${tr(THEME_NAME[theme])}`}>
        {THEME_ICON[theme]}
      </Button>
      <Button
        onClick={cycleQuality}
        active={quality !== 'high'}
        title={`${tr('Качество 3D')}: ${tr(QUALITY_NAME[quality])}`}
      >
        {quality === 'high' ? '3D↑' : quality === 'medium' ? '3D=' : '3D↓'}
      </Button>
    </div>
  )
}
