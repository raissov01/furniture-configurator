/**
 * `Decor.finish` → PBR рендер параметрлері. Таза функция (React/three.js
 * импорты жоқ) — `components/PanelMesh.tsx` соны шақырып,
 * `meshStandardMaterial`/`meshPhysicalMaterial` проптарына салады.
 *
 * Сандар ойдан алынған ЕМЕС — `docs/visual/material.md` §3 кестесінен,
 * qdesign.kz-бен скриншот салыстыруынан шыққан бастапқы нүкте.
 *
 * ⚠ Бұл файл `lib/`-те, `src/core/`-де емес: React/three.js-ке тікелей
 * қатысы жоқ таза есептеу болса да, ол материал/рендер қабатының бөлігі,
 * ал `src/core` — тек панель геометриясы мен өндіріс есебі (CLAUDE.md §3).
 */

import type { DecorFinish, MaterialPbr } from '@/src/core/types'

export type MaterialLook = {
  roughness: number
  metalness: number
  /**
   * 0 — лак қабаты жоқ. `> 0` болғанда `PanelMesh` `meshPhysicalMaterial`
   * қолданады (тек `gloss`/`stone` — GPU шығынын шектеу үшін, төменде).
   */
  clearcoat: number
  clearcoatRoughness: number
  /** `Environment`-тің жалпы `environmentIntensity=0.55`-іне ҮСТІНЕ көбейеді. */
  envMapIntensity: number
}

/**
 * ⚠ material.md-те `satin` (эмаль) үшін `clearcoat: 0.15` ұсынылған, бірақ
 * мұнда әдейі 0-ге қойылды: тапсырма бойынша тек `gloss` пен `stone`
 * `meshPhysicalMaterial`/`clearcoat` алады, қалғаны (`matte`, `satin`,
 * `metal`) — қарапайым `meshStandardMaterial`. Бұл — GPU шығынын екі
 * финишпен шектейтін саналы жеңілдету, ұмытылып қалған мән емес.
 */
const FINISH_LOOK: Record<DecorFinish, MaterialLook> = {
  matte: { roughness: 0.75, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.4 },
  gloss: { roughness: 0.1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.2 },
  satin: { roughness: 0.38, metalness: 0, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 0.6 },
  stone: { roughness: 0.2, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.2, envMapIntensity: 0.9 },
  metal: { roughness: 0.3, metalness: 0.8, clearcoat: 0, clearcoatRoughness: 0, envMapIntensity: 1.3 },
}

/** `finish` бойынша материал параметрлерін қайтарады. `undefined` → `'matte'` (ескі мінез). */
export function finishToMaterial(finish: DecorFinish | undefined): MaterialLook {
  return FINISH_LOOK[finish ?? 'matte']
}

/**
 * `finish` физикалық лак қабатын (clearcoat) талап ете ме — солай болса
 * шақырушы жақ `meshPhysicalMaterial` таңдайды, әйтпесе `meshStandardMaterial`
 * жеткілікті (арзанырақ, `clearcoat` проп мүлде жоқ).
 */
export function needsClearcoat(finish: DecorFinish | undefined): boolean {
  return finishToMaterial(finish).clearcoat > 0
}

/** Material.pbr тек көріністі басқарады; preset пен өндірістік материал дерегін өзгертпейді. */
export function resolveMaterialLook(finish: DecorFinish | undefined, pbr?: MaterialPbr): MaterialLook & { opacity: number; sheen: number } {
  const preset = finishToMaterial(finish)
  return {
    ...preset,
    roughness: pbr?.roughness ?? preset.roughness,
    metalness: pbr?.metalness ?? preset.metalness,
    sheen: pbr?.sheen ?? 0,
    clearcoat: pbr?.clearcoat ?? preset.clearcoat,
    envMapIntensity: pbr?.reflection ?? preset.envMapIntensity,
    opacity: pbr?.opacity ?? 1,
  }
}

/** Shader define өзгерсе Three материалды қайта жинауы керек (map/normalMap toggle). */
export function materialRenderKey(physical: boolean, map: boolean, normalMap: boolean, aoMap = false): string {
  return `${physical ? 'physical' : 'standard'}:${map ? 'map' : 'plain'}:${normalMap ? 'normal' : 'flat'}:${aoMap ? 'ao' : 'no-ao'}`
}
