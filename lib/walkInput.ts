/**
 * ПРОГУЛКАНЫҢ СЕНСОРЛЫ КІРІСІ — DOM-дағы джойстик пен 3D арасындағы көпір.
 *
 * Джойстик Canvas-тан тыс (DOM), ал WalkControls оны `useFrame`-де оқиды.
 * React күйі арқылы берсек, әр саусақ қозғалысы бүкіл бетті қайта рендерлер
 * еді — сондықтан қарапайым ортақ объект: жазатын біреу, оқитын біреу.
 */

/** Джойстиктің ауытқуы, −1…1: `y > 0` — алға, `x > 0` — оңға. */
export const walkInput = { move: { x: 0, y: 0 } }

/**
 * Сенсорлы құрылғы ма (телефон, планшет). Онда pointer-lock жоқ: қарау —
 * саусақпен сүйреу, жүру — джойстик.
 */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}
