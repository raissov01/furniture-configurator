import type { ClassicIconName } from '@/components/ClassicIcon'
import type { DockRequest } from '@/lib/treeDockUi'

export const classicDockTools = {
  structure: { icon: 'structure', label: 'Структура', tab: 'structure' },
  layers: { icon: 'layers', label: 'Слои', tab: 'layers' },
  library: { icon: 'library', label: 'Библиотека', tab: 'library' },
} as const satisfies Record<'structure' | 'layers' | 'library', { icon: ClassicIconName; label: string; tab: DockRequest['tab'] }>
