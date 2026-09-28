'use client'

/**
 * VR батырмасы. Гарнитура (Meta Quest браузері) болмаса — сөндірулі, әрі
 * себебін айтады.
 *
 * `lib/xr` ДИНАМИКАЛЫҚ жүктеледі: бұл батырма алдын ала рендерленетін
 * бетте тұр, ал XR сторы `navigator.xr`-ға тиеді.
 */

import { useEffect, useState } from 'react'
import { t as tr } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { ClassicIcon } from '@/components/ClassicIcon'
import { useConfigurator } from '@/store/configurator'

export function VrButton() {
  const vr = useConfigurator((s) => s.vr)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    let alive = true
    void import('@/lib/xr')
      .then((m) => m.vrSupported())
      .then((ok) => { if (alive) setSupported(ok) })
    return () => { alive = false }
  }, [])

  const toggle = () => {
    void import('@/lib/xr').then((m) => {
      const store = m.getXrStore()
      if (vr) void store.getState().session?.end()
      else void store.enterVR()
    })
  }

  return (
    <Button
      active={vr}
      disabled={!supported}
      title={supported
        ? tr('Войти в VR: стик — идти, курок — открыть шкаф')
        : tr('Нужен VR-шлем (Meta Quest) с браузером WebXR')}
      onClick={toggle}
    >
      <ClassicIcon name="vr" /><span className="sr-only">VR</span>
    </Button>
  )
}
