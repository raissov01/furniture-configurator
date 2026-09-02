/**
 * Жобадағы материалдар: қайсысы қайда, қаншасы кетті.
 *
 * Цехтың сұрағы қарапайым: «осы жобада қандай материал бар, әрқайсысынан
 * қанша керек, ол қай детальдерге кетті». Бұл — сметаның ішіндегі жол емес,
 * БІР ҚАРАУДА түсінетін тізім: материал ауыстырар алдында оның қайда
 * тұрғанын білу керек.
 *
 * ЕСКЕРТУ: мұнда парақ саны ЖОҚ. Парақ санын раскрой ғана біледі
 * (`nestPanels`), ал ауданнан бөлу арқылы шыққан «шамамен парақ» — жалған
 * сан: 2 м² деталь бір параққа да, екі параққа да түсуі мүмкін.
 */

import type { Catalog, EdgeSpec, Panel, PanelRole } from './types'

export type MaterialUsage = {
  materialId: string
  materialName: string
  thickness: number
  /** Осы материалдан жасалатын физикалық деталь саны. */
  parts: number
  /** Детальдердің жалпы ауданы, мм² (ГОТОВЫЙ өлшем бойынша). */
  area: number
  /** Қандай рөлдерде кездеседі — «корпус, полка, фасад» деген жол осыдан. */
  roles: PanelRole[]
  /** Ең үлкен деталь, мм — материалдың парақ форматы жете ме, соны бағалауға. */
  largest: { length: number; width: number }
}

export type EdgeUsage = {
  bandId: string
  bandName: string
  thickness: number
  /** Жалпы ұзындығы, метр. */
  metres: number
}

export type ProjectUsage = {
  materials: MaterialUsage[]
  edges: EdgeUsage[]
  /** Барлық детальдің саны — тізімнің дұрыстығын тексеруге. */
  totalParts: number
}

export const ROLE_NAMES: Record<PanelRole, string> = {
  side: 'боковина',
  top: 'крышка',
  bottom: 'дно',
  shelf: 'полка',
  divider: 'перегородка',
  back: 'задняя',
  front: 'фасад',
  drawerSide: 'ящик',
  drawerBack: 'ящик',
  drawerBottom: 'дно ящика',
  plinth: 'цоколь',
  rail: 'планка',
  custom: 'своя деталь',
}

/** Материалдар мен кромкалардың қолданылуы. Рет: ауданы бойынша кемумен. */
export function projectUsage(panels: Panel[], catalog: Catalog): ProjectUsage {
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))
  const bands = new Map(catalog.edgeBands.map((b) => [b.id, b]))

  const byMaterial = new Map<string, MaterialUsage>()
  for (const panel of panels) {
    const material = materials.get(panel.materialId)
    if (!material) throw new Error(`Материал табылмады: ${panel.materialId}`)

    const entry = byMaterial.get(panel.materialId) ?? {
      materialId: material.id,
      materialName: material.name,
      thickness: material.thickness,
      parts: 0,
      area: 0,
      roles: [],
      largest: { length: 0, width: 0 },
    }
    entry.parts += 1
    entry.area += panel.finishedLength * panel.finishedWidth
    if (!entry.roles.includes(panel.role)) entry.roles.push(panel.role)
    if (panel.finishedLength * panel.finishedWidth > entry.largest.length * entry.largest.width) {
      entry.largest = { length: panel.finishedLength, width: panel.finishedWidth }
    }
    byMaterial.set(panel.materialId, entry)
  }

  const metres = new Map<string, number>()
  const add = (edge: EdgeSpec, mm: number) => {
    if (!edge) return
    metres.set(edge.bandId, (metres.get(edge.bandId) ?? 0) + mm * 0.001)
  }
  for (const panel of panels) {
    add(panel.edges.L1, panel.finishedLength)
    add(panel.edges.L2, panel.finishedLength)
    add(panel.edges.W1, panel.finishedWidth)
    add(panel.edges.W2, panel.finishedWidth)
  }

  const edges: EdgeUsage[] = [...metres.entries()].map(([bandId, m]) => {
    const band = bands.get(bandId)
    if (!band) throw new Error(`Кромка табылмады: ${bandId}`)
    return { bandId, bandName: band.name, thickness: band.thickness, metres: m }
  }).sort((a, b) => b.metres - a.metres)

  return {
    materials: [...byMaterial.values()].sort((a, b) => b.area - a.area),
    edges,
    totalParts: panels.length,
  }
}

/** «корпус, полка, фасад» деген жолды құрау (ең жиі кездесетіні алдында). */
export function rolesLabel(usage: MaterialUsage): string {
  const seen = new Set<string>()
  const names: string[] = []
  for (const role of usage.roles) {
    const name = ROLE_NAMES[role]
    if (seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names.join(', ')
}
