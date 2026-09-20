/**
 * «Информация» докинг панелінің ТАЗА логикасы. Таңдалған деталь (`Panel`)
 * дайын жобадан келеді (`store.selected` + жайылған панельдер), мұнда тек
 * көрсетуге дайын өрістерге бөлінеді.
 *
 * ⚠ CLAUDE.md §4.3: ДАЙЫН (клиент) және РЕЗ (цех) өлшемі — екі бөлек сан,
 * рез өлшемі кромкадан шегеріліп шығады (1 мм-ден жұқа кромка шегерілмейді).
 * Бұл файл екеуін ЕШҚАШАН араластырмайды — әрқайсысы өз өрісінде қалады.
 */
// ⚠ салыстырмалы жол — `structureTree.ts`-тегі түсініктемені қара (vitest-те `@`-алиасы жоқ).
import { ROLE_NAMES } from '../../src/core/index'
import type { Drill, DrillPurpose, EdgeSpec, Material, Panel } from '../../src/core/index'

/** Присадка мақсатының атауы — DrillEditor.tsx-тегі PURPOSE_NAME-мен бір мағынада,
 * бірақ бөлек файл (әр экспорт өз атау картасын ұстайды — `basis.ts`/`cnc.ts`
 * үлгісі). */
export const DRILL_PURPOSE_LABEL: Record<DrillPurpose, string> = {
  confirmat: 'Конфирмат',
  dowel: 'Шкант',
  minifix: 'Минификс',
  shelfPin: 'Полкодержатель',
  hinge: 'Петля',
  runner: 'Направляющая',
  handle: 'Ручка',
  leg: 'Ножка',
  facadeScrew: 'Фасад евровинты',
}

export type DrillGroup = { purpose: DrillPurpose; label: string; count: number }

/** Присадка тесіктерін мақсаты бойынша санайды, PRO100 «Информация»-дағыдай. */
export function groupDrillingByPurpose(drilling: Drill[]): DrillGroup[] {
  const counts = new Map<DrillPurpose, number>()
  for (const d of drilling) counts.set(d.purpose, (counts.get(d.purpose) ?? 0) + 1)
  return [...counts.entries()]
    .map(([purpose, count]) => ({ purpose, label: DRILL_PURPOSE_LABEL[purpose], count }))
    .sort((a, b) => b.count - a.count)
}

export type EdgeFieldName = 'L1' | 'L2' | 'W1' | 'W2'

export type EdgeInfo = { edge: EdgeFieldName; bandName: string | null; thickness: number | null }

/** Төрт жиектің кромкасы — bandId картадан аты табылмаса, шикі id көрінеді. */
export function edgeSummary(
  edges: Record<EdgeFieldName, EdgeSpec>,
  bandById: Map<string, { name: string; thickness: number }>,
): EdgeInfo[] {
  const order: EdgeFieldName[] = ['L1', 'L2', 'W1', 'W2']
  return order.map((edge) => {
    const spec = edges[edge]
    if (!spec) return { edge, bandName: null, thickness: null }
    const band = bandById.get(spec.bandId)
    return { edge, bandName: band?.name ?? spec.bandId, thickness: band?.thickness ?? null }
  })
}

export function materialName(materialId: string, materials: Material[]): string {
  return materials.find((m) => m.id === materialId)?.name ?? materialId
}

export function roleLabel(panel: Panel): string {
  return ROLE_NAMES[panel.role]
}
