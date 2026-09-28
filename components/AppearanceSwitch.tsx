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
import { Button, MenuItem } from '@/components/ui'
import { THEME_EVENT, applyTheme, chooseTheme, readQuality, readTheme, saveQuality } from '@/lib/appearance'
import type { Quality, Theme } from '@/lib/appearance'
import { useConfigurator } from '@/store/configurator'

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

export function AppearanceSwitch({ menu = false }: { menu?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system')
  const quality = useConfigurator((s) => s.quality)
  const setQuality = useConfigurator((s) => s.setQuality)

  useEffect(() => {
    const saved = readTheme()
    setTheme(saved)
    applyTheme(saved)
    setQuality(readQuality())
  }, [setQuality])
  // Классикалық «Вид → Тема» басқа жерден ауыстырса — белгіше де ауыссын.
  useEffect(() => {
    const onTheme = (event: Event) => setTheme((event as CustomEvent<Theme>).detail)
    window.addEventListener(THEME_EVENT, onTheme)
    return () => window.removeEventListener(THEME_EVENT, onTheme)
  }, [])

  const cycleTheme = () => {
    // Үш күй бір батырмада: жүйе → ақ → қараңғы → жүйе.
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
    chooseTheme(next)
  }

  const cycleQuality = () => {
    const next: Quality = quality === 'high' ? 'medium' : quality === 'medium' ? 'low' : 'high'
    setQuality(next)
    saveQuality(next)
  }

  if (menu) return <>
    <MenuItem onClick={cycleTheme}>{tr('Тема')}: {tr(THEME_NAME[theme])}</MenuItem>
    <MenuItem onClick={cycleQuality}>{tr('Качество 3D')}: {tr(QUALITY_NAME[quality])}</MenuItem>
  </>

  return (
    <div className="flex items-center gap-1">
      <Button onClick={cycleTheme} title={`${tr('Тема')}: ${tr(THEME_NAME[theme])}`}>
        {tr('Тема')}: {tr(THEME_NAME[theme])}
      </Button>
      <Button
        onClick={cycleQuality}
        active={quality !== 'high'}
        title={`${tr('Качество 3D')}: ${tr(QUALITY_NAME[quality])}`}
      >
        {tr('Качество 3D')}: {tr(QUALITY_NAME[quality])}
      </Button>
    </div>
  )
}
