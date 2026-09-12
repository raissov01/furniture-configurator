'use client'

/**
 * VR-СЕССИЯНЫҢ жалғыз сторы (`@react-three/xr`).
 *
 * Жалқау жасалады: стор `navigator.xr`-ға тиеді, ал бұл модульді
 * алдын ала рендерленетін бет те импорттауы мүмкін.
 *
 * `offerSession: false` — Quest браузері бетті ашқан бойда өзі сессия
 * ұсынбасын (әдепкіде ол AR-ды таңдап алады): адам VR-ге батырмамен кіреді.
 * Эмуляция (әдепкісі) тек localhost-та қосылады — гарнитурасыз тексеру үшін.
 */

import { createXRStore } from '@react-three/xr'
import type { XRStore } from '@react-three/xr'

let store: XRStore | null = null

export function getXrStore(): XRStore {
  store ??= createXRStore({ offerSession: false })
  return store
}

/** Құрылғы нағыз VR-ді (immersive-vr) көтере ме. Эмулятор localhost-та «иә» дейді. */
export async function vrSupported(): Promise<boolean> {
  // Эмулятор стормен БІРГЕ орнатылады, сондықтан алдымен стор.
  getXrStore()
  try {
    return (await navigator.xr?.isSessionSupported('immersive-vr')) ?? false
  } catch {
    return false
  }
}
