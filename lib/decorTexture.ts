/**
 * Декордың НАҒЫЗ текстурасы (`Decor.mapUrl`) — өндірушінің ашық порталынан
 * алынған сурет, `mapSizeMm` арқылы ФИЗИКАЛЫҚ масштабпен қойылады.
 *
 * Тәсіл `lib/floorTexture.ts`-тегі `SPAN_MM`-мен дәл бірдей: репит панельдің
 * нақты мм өлшемін текстураның мм өлшеміне бөлу арқылы шығады, сондықтан
 * 300 мм сөре мен 2800 мм бүйір бірдей тайл тығыздығымен көрінеді (қазіргі
 * `grainTexture.ts`-тегі қатаң `repeat.set(2,2)`-нің орнына).
 *
 * ⚠ Жүктеу АСИНХРОНДЫ (желіден сурет). `frameloop='demand'` режимінде сурет
 * келгенде кадр өзі сұралмайды, сол үшін шақырушы жақ `onLoad` арқылы
 * `invalidate()` беруі керек (`components/Scene.tsx`-тегі `Silhouette`
 * компонентіндегі дәл осы үлгі, :985-994).
 *
 * ⚠ Тек браузерде (Image/canvas керек, SSR-де `TextureLoader` де жұмыс
 * істемейді — Next.js бұл файлды тек `'use client'` компоненттен шақырады).
 */

import { Cache, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'

// Бір URL — бір желі сұранысы. Cache болмаса, бір декорды қолданатын әр
// панель суретті ЖЕКЕ жүктеп алар еді (500 декордың кез келгені бірнеше рет
// қолданылуы мүмкін — сөре, есік, бүйір бір материалдан).
Cache.enabled = true

/**
 * `mapUrl` бойынша текстура жүктейді де, `spanXMm`/`spanYMm` (панельдің
 * ГОТОВЫЙ ұзындығы/ені) мен `mapSizeMm` (суреттің физикалық өлшемі)
 * қатынасымен репитін қояды.
 *
 * `onLoad` — сурет желіден келгенде шақырылады (демек кадр сұраумен
 * байланыстыру шақырушы компоненттің ісі).
 */
export function decorTexture(
  mapUrl: string,
  spanXMm: number,
  spanYMm: number,
  mapSizeMm: { x: number; y: number },
  onLoad?: () => void,
): Texture | null {
  if (typeof document === 'undefined') return null
  const loader = new TextureLoader()
  const tex = loader.load(mapUrl, () => onLoad?.())
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.repeat.set(spanXMm / mapSizeMm.x, spanYMm / mapSizeMm.y)
  return tex
}
