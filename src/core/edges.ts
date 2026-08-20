/**
 * Кромка: қай жиекке қандай лента жабысады және рез өлшемі қалай шығады.
 */

import type {
  ConstructionMethod, ConstructionSettings, EdgeBand, EdgePolicy,
  EdgeSpec, PanelEdges, PanelRole,
} from './types.js'

export type EdgeClass = 'visibleFront' | 'visibleSecondary' | 'hidden'

/** Панель рөлі мен құрастыру әдісі бойынша әр жиектің көріну класы. */
export function edgeClasses(
  role: PanelRole,
  construction: ConstructionMethod,
): Record<keyof PanelEdges, EdgeClass> {
  switch (role) {
    case 'side':
    case 'divider':
      return {
        L1: 'visibleFront', // алдыңғы тік жиек
        L2: 'hidden', // арт жиек — ХДФ жауып тұрады
        // sidesOverlay-де боковина толық биіктікте → үсті мен асты көрінеді.
        // topBottomOverlay-де крышка/дно оны жауып тұр → көрінбейді.
        W1: construction === 'sidesOverlay' ? 'visibleSecondary' : 'hidden',
        W2: construction === 'sidesOverlay' ? 'visibleSecondary' : 'hidden',
      }
    case 'top':
    case 'bottom':
      return {
        L1: 'visibleFront',
        L2: 'hidden',
        // topBottomOverlay-де крышка/дно бүйірден шығып тұр → торцтары көрінеді.
        W1: construction === 'topBottomOverlay' ? 'visibleSecondary' : 'hidden',
        W2: construction === 'topBottomOverlay' ? 'visibleSecondary' : 'hidden',
      }
    case 'shelf':
      // Алдыңғы жиек әрқашан 2 мм — қолмен ұстайтын жер, 0.4 мм тез сыдырылады.
      return { L1: 'visibleFront', L2: 'hidden', W1: 'hidden', W2: 'hidden' }
    case 'front':
      // Фасадтың төрт жиегі де көрінеді.
      return { L1: 'visibleFront', L2: 'visibleFront', W1: 'visibleFront', W2: 'visibleFront' }
    case 'back':
      // ХДФ-қа кромка жабыспайды.
      return { L1: 'hidden', L2: 'hidden', W1: 'hidden', W2: 'hidden' }
    default:
      return { L1: 'hidden', L2: 'hidden', W1: 'hidden', W2: 'hidden' }
  }
}

export function resolveEdges(
  role: PanelRole,
  construction: ConstructionMethod,
  policy: EdgePolicy,
): PanelEdges {
  const classes = edgeClasses(role, construction)
  const pick = (c: EdgeClass): EdgeSpec => {
    const bandId = policy[c]
    return bandId ? { bandId } : null
  }
  return {
    L1: pick(classes.L1),
    L2: pick(classes.L2),
    W1: pick(classes.W1),
    W2: pick(classes.W2),
  }
}

/**
 * Резден алынатын кромка қалыңдығы.
 * `minBandSubtract`-тен жұқа лента 0 қайтарады — түсіндірмесі constants.ts-те.
 */
export function subtractedThickness(
  edge: EdgeSpec,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): number {
  if (!edge) return 0
  const band = bands.get(edge.bandId)
  if (!band) throw new Error(`Кромка табылмады: ${edge.bandId}`)
  return band.thickness >= settings.minBandSubtract ? band.thickness : 0
}

export type CutDimensions = { cutLength: number; cutWidth: number }

/**
 * CLAUDE.md §4.3 — кромканы шегеру ережесі.
 *
 * Кромка деталь өлшемін ҰЛҒАЙТАДЫ, сондықтан ара оны сол қалыңдыққа КІШІ кесуі
 * керек. Мысалы: готовый 600 мм, екі ұшында 2 мм ПВХ → рез 596 мм.
 *
 *   cutLength = finishedLength − t(W1) − t(W2)   ← W1/W2 ұзындықтың екі ұшы
 *   cutWidth  = finishedWidth  − t(L1) − t(L2)   ← L1/L2 ұзын екі жиек
 *
 * Бұларды шатастыру — доменнің ең қымбат багы: жиһаз орнына сыймай қалады.
 */
export function calculateCutDimensions(
  finishedLength: number,
  finishedWidth: number,
  edges: PanelEdges,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): CutDimensions {
  const t = (e: EdgeSpec) => subtractedThickness(e, bands, settings)
  return {
    cutLength: finishedLength - t(edges.W1) - t(edges.W2),
    cutWidth: finishedWidth - t(edges.L1) - t(edges.L2),
  }
}
