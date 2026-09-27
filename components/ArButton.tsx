'use client'

/**
 * «AR» — жиһазды телефонның камерасы арқылы БӨЛМЕГЕ қою.
 *
 * Батырманың өзі ЕШТЕҢЕ экспорттамайды: ол стордағы AR арнасына сұраныс
 * қалдырады, ал нағыз жұмысты `<Canvas>` ішіндегі `ArExporter` істейді —
 * 3D сахнаға тек сол жерден жетуге болады.
 *
 * Компьютерде AR жоқ, сондықтан онда СІЛТЕМЕ беріледі: адам оны телефонына
 * жібереді (немесе сол сілтемемен клиентке көрсетеді).
 */

import { t as tr } from '@/lib/i18n'
import { Button } from '@/components/ui'
import { ClassicIcon } from '@/components/ClassicIcon'
import { cloudEnabled } from '@/lib/cloud'
import { useConfigurator } from '@/store/configurator'

export function ArButton() {
  const ar = useConfigurator((s) => s.ar)
  const setAr = useConfigurator((s) => s.setAr)
  const scene = useConfigurator((s) => s.liveScene)
  const title = useConfigurator((s) => s.root.name)

  const run = async () => {
    if (!scene) {
      setAr({ error: 'Сцена ещё не готова' })
      return
    }
    setAr({ busy: true, link: null, error: null })
    try {
      const { sceneToGlb, isAndroid, isIos, sceneViewerUrl } = await import('@/lib/ar')
      const glb = await sceneToGlb(scene as object)
      const res = await fetch('/api/ar', {
        method: 'POST',
        headers: { 'Content-Type': 'model/gltf-binary' },
        body: glb as unknown as BodyInit,
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok || !data.id) {
        setAr({ busy: false, error: data.error ?? 'Не получилось' })
        return
      }
      const glbUrl = `${window.location.origin}/api/ar/${data.id}`
      // ⚠ СІЛТЕМЕ ЕНДІ AR БЕТІНЕ (`/ar/{id}`), шикі GLB-ге ЕМЕС: телефон бетті
      // ашқанда model-viewer жиһазды КАМЕРАМЕН бөлмеге қояды (Android). Бұрын
      // шикі .glb ашылып, тек 3D көрінетін.
      const pageUrl = `${window.location.origin}/ar/${data.id}`
      if (isAndroid()) {
        // Android-та Scene Viewer-ді ТІКЕЛЕЙ шақырамыз (бір рет басу — AR).
        setAr({ busy: false, link: pageUrl })
        window.location.href = sceneViewerUrl(glbUrl, title)
        return
      }
      if (isIos()) {
        // iOS-та бетті ашамыз: model-viewer 3D көрсетеді (толық AR үшін USDZ
        // керек, ол — келесі қадам), бірақ бұл шикі файлдан әлдеқайда жақсы.
        setAr({ busy: false, link: pageUrl })
        window.location.href = pageUrl
        return
      }
      // Компьютерде: сілтемені телефонға жіберу үшін AR БЕТІН береміз.
      setAr({ busy: false, link: pageUrl, error: null })
    } catch (e) {
      setAr({ busy: false, error: e instanceof Error ? e.message : 'Не получилось' })
    }
  }

  // Бұлт сөндірулі құрастыруда (Vercel демосы) файлды сақтайтын жер жоқ.
  if (!cloudEnabled) return <Button disabled title={tr('AR недоступен без облачного хранения')}><ClassicIcon name="ar" /><span className="sr-only">AR</span></Button>

  return (
    <>
      <Button
        onClick={() => void run()}
        disabled={ar.busy}
        title={tr('Посмотреть в комнате через камеру')}
      >
        <ClassicIcon name="ar" /><span className="sr-only">AR</span>
      </Button>
      {ar.link ? (
        <input
          className="w-56 rounded-md border border-neutral-300 px-1.5 py-1 text-[11px] dark:border-neutral-700 dark:bg-neutral-900"
          readOnly
          value={ar.link}
          title={tr('Откройте эту ссылку на телефоне (Android)')}
          onFocus={(e) => e.currentTarget.select()}
        />
      ) : null}
      {ar.error ? (
        <span className="text-[11px] text-amber-600 dark:text-amber-400">{tr(ar.error)}</span>
      ) : null}
    </>
  )
}
