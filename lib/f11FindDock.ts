export const treeDockTabs = ['structure', 'layers', 'library', 'find', 'replace'] as const

export type TreeDockTab = typeof treeDockTabs[number]

export const treeDockTabLabels: Record<TreeDockTab, string> = {
  structure: 'Структура',
  layers: 'Слои',
  library: 'Библиотека',
  find: 'Найти',
  replace: 'Замена',
}
