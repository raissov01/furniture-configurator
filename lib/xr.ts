'use client'

/**
 * VR-СЕССИЯНЫҢ жалғыз сторы (`@react-three/xr`).
 *
 * Жалқау жасалады: стор `navigator.xr`-ға тиеді, ал бұл модульді
 * алдын ала рендерленетін бет те импорттауы мүмкін.
 *
 * `offerSession: false` — Quest браузері бетті ашқан бойда өзі сессия
 * ұсынбасын (әдепкіде ол AR-ды таңдап алады): адам VR-ге батырмамен кіреді.
 *
 * `emulate: false` — әдепкіде localhost-та WebXR жоқ браузерге Quest
 * эмуляторы (IWER) орнатылады да, бетке өз басқару тақтасын қосады. Ол
 * headless e2e-де батырмалардың үстіне шығады, ал нағыз гарнитурада оның
 * керегі жоқ. Эмулятор десктоп Chrome-да бәрібір қосылмайды (нативті
 * `navigator.xr` бар), сондықтан одан пайда жоқ.
 */

import { createXRStore } from '@react-three/xr'
import type { XRStore } from '@react-three/xr'

let store: XRStore | null = null

export function getXrStore(): XRStore {
  store ??= createXRStore({ offerSession: false, emulate: false })
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
