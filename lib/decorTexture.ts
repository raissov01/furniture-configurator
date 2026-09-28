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

import { Cache, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import type { Axis, Orientation } from '@/src/core/types'

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

/** Normal карта — түс суреті емес; Three.js normalMap үшін NoColorSpace талап етеді. */
export function configureNormalTexture(tex: Texture, spanXMm: number, spanYMm: number,
  sizeMm: { x: number; y: number }): Texture {
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = NoColorSpace
  tex.repeat.set(spanXMm / sizeMm.x, spanYMm / sizeMm.y)
  return tex
}

export function normalTexture(url: string, spanXMm: number, spanYMm: number,
  sizeMm: { x: number; y: number }, onLoad?: () => void): Texture | null {
  if (typeof document === 'undefined') return null
  const tex = new TextureLoader().load(url, () => onLoad?.())
  return configureNormalTexture(tex, spanXMm, spanYMm, sizeMm)
}

/** AO uses the panel's existing UV0; three.js defaults AO maps to UV1. */
export function configureAmbientOcclusionTexture(tex: Texture, spanXMm: number, spanYMm: number,
  sizeMm: { x: number; y: number }): Texture {
  configureNormalTexture(tex, spanXMm, spanYMm, sizeMm)
  tex.channel = 0
  return tex
}

export function ambientOcclusionTexture(url: string, spanXMm: number, spanYMm: number,
  sizeMm: { x: number; y: number }, onLoad?: () => void): Texture | null {
  if (typeof document === 'undefined') return null
  const texture = new TextureLoader().load(url, () => onLoad?.())
  return configureAmbientOcclusionTexture(texture, spanXMm, spanYMm, sizeMm)
}

/**
 * `grainAlongLength` 3D-де — CLAUDE.md §3, docs/visual/texture.md §1.5.
 *
 * Раскройда (`nesting.ts`) `hasGrain` панельді 90°-қа бұруға тыйым салады,
 * ал 3D-де ешбір жер `Panel.grainAlongLength`-ті оқымайтын: текстура
 * әрдайым бір бағытта салынатын (тексерілді, толық grep). Бұл жай эстетика
 * емес — раскрой мен 3D екі БАСҚА көрініс беруі мүмкін, ал клиент 3D-ге
 * қарап ақша төлейді.
 *
 * Төмендегі екі функция ТАЗА (three.js-тен тыс, тек сан/жол қайтарады) —
 * рендерді тестпен ұстау қиын, сол үшін «қай бұрышқа бұру керек» есебі
 * бөлек шығарылған. Шақырушы (`PanelMesh.tsx`) нәтижені `Texture.rotation`-ге
 * тікелей береді.
 */

/** Панельдің локал ұзындық/ен өсі — текстура қай өске «желісі бойымен» жату керек соны айту үшін. */
export type GrainUVAxis = 'length' | 'width'

/**
 * BoxGeometry-дің (тегіс, бұрылмаған қорап-панель) қалыңдық осіне
 * ПЕРПЕНДИКУЛЯР бетінде (яғни клиент көретін «inner»/«outer» бет) текстураның
 * U-осі қай world-осіне сәйкес келетінін қайтарады.
 *
 * Себебі: three.js `BoxGeometry` дереккөзінде әр беттің UV құрылысы
 * (`buildPlane` шақырулары) қатаң бекітілген, панельдің world-бағдарына
 * тәуелсіз:
 *
 *   thickness='x' бет (px/nx) → buildPlane('z','y','x', …) → U = world z
 *   thickness='y' бет (py/ny) → buildPlane('x','z','y', …) → U = world x
 *   thickness='z' бет (pz/nz) → buildPlane('x','y','z', …) → U = world x
 *
 * `PanelMesh.tsx`-тегі жай (бұрылмаған, орта таяқ) панель `boxGeometry`
 * өлшемдерін ТІКЕЛЕЙ world AABB-тан алады (`panelExtents`), яғни әр
 * `orientation` (side/horizontal/facing/upright) панельдің ұзындық/ен
 * өрісін БАСҚА world осіне қояды. Сондықтан U-осінің панельдің ЛОКАЛ
 * ұзындығына сәйкес пе, еніне сәйкес пе — соны есептеу керек, ол
 * `orientation`-ға тәуелді.
 */
export function boxGrainUAxis(orientation: Orientation): GrainUVAxis {
  const uWorldAxis: Axis = orientation.thickness === 'x' ? 'z' : 'x'
  return orientation.length === uWorldAxis ? 'length' : 'width'
}

/**
 * Текстураны (canvas grain не decorTexture) 90°-қа бұру керек пе.
 *
 * `currentUAxis` — геометрия ҚАЗІР текстураның U-осіне қай локал өсті
 * (length/width) салып тұрғаны:
 *   - жай box панельде — `boxGrainUAxis(panel.orientation)`
 *   - extrude/shape панельде (қиғаш, дөңгелектелген бұрыш, ойма) — әрқашан
 *     `'length'`, себебі пішін тікелей локал x=finishedLength,
 *     y=finishedWidth етіп салынады (`PanelMesh.tsx`-тегі `shape`
 *     құрылысы), ал three.js `ExtrudeGeometry`-нің әдепкі UV генераторы
 *     сол координатаны тікелей қолданады.
 *
 * Нәтиже — радиан (0 не Math.PI/2), `Texture.rotation`-ге тікелей беруге
 * болады (`Texture.center` (0.5, 0.5) қойылған болу керек, әйтпесе бұрылу
 * бұрыштан емес, ортадан ауытқып кетеді).
 */
export function grainRotation(currentUAxis: GrainUVAxis, grainAlongLength: boolean): number {
  const wantAxis: GrainUVAxis = grainAlongLength ? 'length' : 'width'
  return currentUAxis === wantAxis ? 0 : Math.PI / 2
}
