'use client'

import { createContext } from 'react'

/**
 * Сахнаның классикалық (PRO100) стилі: таңдау КӨК бояумен және 2D тұтқалармен
 * көрсетіледі, ал «Свет» терезесіндегі рельеф/отражение материалға әсер етеді.
 * Классикалық емес көріністерде (viewer, мобайл) әдепкі мән — бұрынғы мінез.
 */
export type ClassicScene = {
  classic: boolean
  look: 'schematic' | 'realistic'
  /** Нормаль картасының үлесі, 0…1 («рельеф»). */
  relief: number
  /** Материал шағылысының көбейткіші, 0…1 («отражение»). */
  reflection: number
}

export const ClassicSceneContext = createContext<ClassicScene>({ classic: false, look: 'realistic', relief: 1, reflection: 1 })

/** PRO100-дегі таңдалған элементтің бояуы (эталон пикселі `#0f11ff`). */
export const P100_SELECTION_COLOR = '#1014ff'
