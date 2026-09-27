import type { Drill, Panel } from '@/src/core/index'

export function panelCncAvailable(panel: Pick<Panel, 'drilling'>): boolean {
  return panel.drilling.length > 0
}

const cell = (value: string | number): string => {
  const text = String(value)
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Бір панельдің станок файлы: қайталанатын атауды panel ID ажыратады. */
export function panelCncCsv(panel: Panel, isManual: (drill: Drill) => boolean): { name: string; csv: string } {
  if (!panelCncAvailable(panel)) throw new Error('Бұл детальда тесік жоқ')
  const rows: (string | number)[][] = [
    ['ID', 'Рез длина', 'Рез ширина', 'Деталь', 'Сторона', 'X', 'Y', 'Диаметр', 'Глубина', 'Назначение', 'Источник'],
    ...panel.drilling.map((drill) => [
      panel.id, panel.cutLength, panel.cutWidth, panel.label, drill.face, drill.x, drill.y,
      drill.diameter, drill.depth, drill.purpose, isManual(drill) ? 'вручную' : 'авто',
    ]),
  ]
  const safeId = panel.id.replace(/[^\p{L}\p{N}._-]+/gu, '_')
  return { name: `${safeId}-присадка.csv`, csv: rows.map((row) => row.map(cell).join(';')).join('\r\n') }
}
