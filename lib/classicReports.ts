/**
 * PRO100 «Отчёты» терезесінің кестелері (таза функциялар).
 *
 * Детальдар тізімі ГОТОВЫЙ өлшеммен (3D-дегі, клиент көретін өлшем) — PRO100
 * сияқты. Цехтың рез өлшемі мен раскрой «Смета и раскрой» терезесінде қалады.
 */
import type { Material, Panel } from '@/src/core/index'

export type ReportGroup = { name: string; panels: Panel[] }
export type PartRow = { group: string; name: string; length: number; width: number; thickness: number; count: number; material: string }
export type CabinetRow = { name: string; height: number; width: number; depth: number; parts: number }
export type MaterialRow = { material: string; thickness: number; parts: number; areaM2: number }

export function partRows(groups: ReportGroup[], materials: Material[], label: (text: string) => string, withGroup: boolean): PartRow[] {
  const byId = new Map(materials.map((material) => [material.id, material]))
  const rows = new Map<string, PartRow>()
  for (const group of groups) for (const panel of group.panels) {
    const material = byId.get(panel.materialId)
    const row = {
      group: withGroup ? group.name : '',
      name: label(panel.label),
      length: panel.finishedLength,
      width: panel.finishedWidth,
      thickness: material?.thickness ?? 0,
      count: 1,
      material: material?.name ?? panel.materialId,
    }
    const key = [row.group, row.name, row.length, row.width, row.thickness, row.material].join('\u0000')
    const existing = rows.get(key)
    if (existing) existing.count += 1
    else rows.set(key, row)
  }
  return [...rows.values()]
}

/** Материал бойынша: деталь саны мен готовый ауданы, м² (парақ саны — раскройда). */
export function materialRows(groups: ReportGroup[], materials: Material[]): MaterialRow[] {
  const byId = new Map(materials.map((material) => [material.id, material]))
  const rows = new Map<string, MaterialRow>()
  for (const group of groups) for (const panel of group.panels) {
    const material = byId.get(panel.materialId)
    const key = panel.materialId
    const row = rows.get(key) ?? { material: material?.name ?? key, thickness: material?.thickness ?? 0, parts: 0, areaM2: 0 }
    row.parts += 1
    row.areaM2 += panel.finishedLength * panel.finishedWidth / 1e6
    rows.set(key, row)
  }
  return [...rows.values()].map((row) => ({ ...row, areaM2: Math.round(row.areaM2 * 100) / 100 }))
}

/** Кестені TSV (Excel-ге қоюға) не CSV (файлға) ретінде. */
export function tableText(head: string[], rows: (string | number)[][], separator: '\t' | ';'): string {
  const cell = (value: string | number) => {
    const text = String(value)
    return separator === ';' && /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [head, ...rows].map((row) => row.map(cell).join(separator)).join('\n')
}
