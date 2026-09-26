/**
 * PRO100-дегі мәзір жолағының СИПАТТАМАСЫ (таза функция, React-сыз).
 *
 * Әр пункт — `ClassicCommand` деректері; оны `Workspace` store әрекетіне
 * тікелей аударады. DOM селектор да, жасырын батырманы `.click()` ету де жоқ:
 * классикалық режимде ескі header `display:none`, сондықтан сондай пункт
 * ештеңе ашпайтын (аудит P0-1, «Файл → Экспорт для цеха»).
 *
 * Жолдар — ОРЫСША КІЛТ (`t()` оларды `Workspace`-те аударады), тек `raw`
 * пункттер (тіл атаулары, баға) аударылмайды.
 */

import type { CameraPreset } from '@/store/configurator'
import type { Quality, Theme } from '@/lib/appearance'
import type { Lang } from '@/lib/i18n'
import type { ShopExportFormat } from '@/lib/shopExport'

export type ClassicPanel = 'gallery' | 'ai' | 'sketch' | 'parts' | 'history' | 'shop' | 'project' | 'quote' | 'drill' | 'room' | 'help' | 'shareCode' | 'account'

export type ClassicCommand =
  | { type: 'open'; panel: ClassicPanel }
  | { type: 'saveProject' }
  | { type: 'openProject' }
  | { type: 'export'; format: ShopExportFormat }
  | { type: 'clientLink' }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'preset'; preset: CameraPreset }
  | { type: 'cycleViewMode' }
  | { type: 'toggleFronts' }
  | { type: 'toggleProjection' }
  | { type: 'toggleDimensions' }
  | { type: 'fittings'; show: 'none' | 'drilling' | 'fittings' }
  | { type: 'fit' }
  | { type: 'toggleSilhouette' }
  | { type: 'addCabinet' }
  | { type: 'addBoard' }
  | { type: 'removeBoard' }
  | { type: 'duplicate' }
  | { type: 'mirror' }
  | { type: 'removeCabinet' }
  | { type: 'toggleOpen' }
  | { type: 'toggleAssembly' }
  | { type: 'navigate'; href: string }
  | { type: 'theme'; theme: Theme }
  | { type: 'quality'; quality: Quality }
  | { type: 'lang'; lang: Lang }
  | { type: 'workspaceStyle'; classic: boolean }

export type ClassicMenuEntry =
  | { kind: 'item'; id: string; label: string; command: ClassicCommand; disabled?: boolean; active?: boolean; hint?: string; detail?: string; raw?: boolean }
  | { kind: 'slider'; id: string; label: string }
  | { kind: 'heading'; id: string; label: string }
  | { kind: 'separator' }

export type ClassicMenu = { id: string; label: string; align?: 'right'; items: ClassicMenuEntry[] }

export type ClassicMenuState = {
  canUndo: boolean
  canRedo: boolean
  activeEditable: boolean
  editableBoard: boolean
  canRemoveCabinet: boolean
  /** Цех экспорты мүмкін бе (белсенді корпус бар, өндірісте қате жоқ). */
  canExport: boolean
  /** PDF сборка сызбасы тек корпусқа. */
  canExportPdf: boolean
  productionError: boolean
  cameraPreset: CameraPreset
  viewMode: 'solid' | 'ghost' | 'wire'
  showFronts: boolean
  projection: 'perspective' | 'ortho'
  showDimensions: boolean
  showDrilling: boolean
  showFittings: boolean
  silhouetteOn: boolean
  open: boolean
  assembly: boolean
  theme: Theme
  quality: Quality
  lang: Lang
  /** Тақтадағы баға: `null` — әзірге есептелмеген. */
  price: { total: string } | { missing: true } | null
  cloud: boolean
  classic: boolean
}

const SEP = { kind: 'separator' } as const

const PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: 'Фас' },
  { value: 'three-quarter', label: '3/4' },
  { value: 'inside', label: 'Внутри' },
  { value: 'plan', label: 'План' },
  { value: 'room', label: 'Комната' },
]

export function classicMenus(s: ClassicMenuState): ClassicMenu[] {
  const item = (id: string, label: string, command: ClassicCommand, extra: Partial<Extract<ClassicMenuEntry, { kind: 'item' }>> = {}): ClassicMenuEntry =>
    ({ kind: 'item', id, label, command, ...extra })
  return [
    {
      id: 'file', label: 'Файл', items: [
        item('file.gallery', 'Готовые шаблоны', { type: 'open', panel: 'gallery' }),
        item('file.ai', 'Техзадание (словами)', { type: 'open', panel: 'ai' }),
        item('file.sketch', 'Нарисовать мышью', { type: 'open', panel: 'sketch' }, { disabled: !s.activeEditable }),
        item('file.parts', 'Своя деталь', { type: 'open', panel: 'parts' }, { disabled: !s.activeEditable }),
        SEP,
        item('file.save', 'Сохранить проект', { type: 'saveProject' }),
        item('file.open', 'Открыть проект', { type: 'openProject' }),
        SEP,
        { kind: 'heading', id: 'file.export', label: 'Экспорт для цеха' },
        item('file.export.xlsx', 'XLSX — деталировка', { type: 'export', format: 'xlsx' }, { disabled: !s.canExport }),
        item('file.export.csv', 'CSV — на распил', { type: 'export', format: 'csv' }, { disabled: !s.canExport }),
        item('file.export.dxf', 'DXF — на станок', { type: 'export', format: 'dxf' }, { disabled: !s.canExport }),
        item('file.export.pdf', 'PDF — сборочный чертёж', { type: 'export', format: 'pdf' }, { disabled: !s.canExport || !s.canExportPdf }),
        SEP,
        item('file.link', 'Ссылка клиенту', { type: 'clientLink' }),
        item('file.code', 'Код для клиента', { type: 'open', panel: 'shareCode' }),
        item('file.reset', 'Сброс', { type: 'reset' }),
      ],
    },
    {
      id: 'edit', label: 'Правка', items: [
        item('edit.undo', 'Отменить', { type: 'undo' }, { disabled: !s.canUndo, hint: 'Ctrl+Z' }),
        item('edit.redo', 'Повторить', { type: 'redo' }, { disabled: !s.canRedo, hint: 'Ctrl+⇧Z' }),
        item('edit.history', 'История изменений', { type: 'open', panel: 'history' }),
      ],
    },
    {
      id: 'view', label: 'Вид', items: [
        ...PRESETS.map((p) => item(`view.preset.${p.value}`, p.label, { type: 'preset', preset: p.value }, { active: s.cameraPreset === p.value })),
        SEP,
        { kind: 'slider', id: 'view.exploded', label: 'Разнести' },
        item('view.mode', s.viewMode === 'solid' ? 'Прозрачность' : s.viewMode === 'ghost' ? 'Полупрозрачно' : 'Контур', { type: 'cycleViewMode' }, { active: s.viewMode !== 'solid' }),
        item('view.fronts', s.showFronts ? 'Скрыть фасады' : 'Показать фасады', { type: 'toggleFronts' }, { active: !s.showFronts }),
        item('view.projection', s.projection === 'perspective' ? 'Ортогональная проекция' : 'Перспектива', { type: 'toggleProjection' }, { active: s.projection === 'ortho' }),
        item('view.dimensions', 'Размеры на сцене', { type: 'toggleDimensions' }, { active: s.showDimensions }),
        item('view.fittings.none', 'Фурнитура: скрыть', { type: 'fittings', show: 'none' }, { active: !s.showDrilling && !s.showFittings }),
        item('view.fittings.drilling', 'Фурнитура: отверстия', { type: 'fittings', show: 'drilling' }, { active: s.showDrilling }),
        item('view.fittings.fittings', 'Фурнитура: крепёж', { type: 'fittings', show: 'fittings' }, { active: s.showFittings }),
        item('view.fit', 'Вписать в кадр', { type: 'fit' }),
        item('view.silhouette', 'Человек для масштаба', { type: 'toggleSilhouette' }, { active: s.silhouetteOn }),
      ],
    },
    {
      id: 'element', label: 'Элемент', items: [
        item('element.add', 'Новый корпус', { type: 'addCabinet' }),
        item('element.board', 'Добавить свободную доску', { type: 'addBoard' }),
        item('element.removeBoard', 'Удалить доску', { type: 'removeBoard' }, { disabled: !s.editableBoard }),
        item('element.duplicate', 'Дублировать', { type: 'duplicate' }, { disabled: !s.activeEditable }),
        item('element.mirror', 'Зеркальная копия', { type: 'mirror' }, { disabled: !s.activeEditable }),
        item('element.remove', 'Удалить корпус', { type: 'removeCabinet' }, { disabled: !s.canRemoveCabinet }),
        SEP,
        item('element.open', s.open ? 'Закрыть створки' : 'Распахнуть', { type: 'toggleOpen' }, { active: s.open }),
        item('element.assembly', 'Сборка', { type: 'toggleAssembly' }, { active: s.assembly }),
      ],
    },
    {
      id: 'tools', label: 'Инструменты', items: [
        item('tools.shop', 'Цех: материалы и цены', { type: 'open', panel: 'shop' }),
        item('tools.project', 'Материалы и сборка', { type: 'open', panel: 'project' }),
        item('tools.quote', 'Смета и раскрой', { type: 'open', panel: 'quote' }, { disabled: s.productionError }),
        item('tools.drill', 'Присадка', { type: 'open', panel: 'drill' }, { disabled: !s.activeEditable && !s.editableBoard }),
        item('tools.room', 'Стены и комната', { type: 'open', panel: 'room' }),
        item('tools.cut', 'Раскрой (отдельный экран)', { type: 'navigate', href: '/cut' }),
      ],
    },
    {
      id: 'help', label: 'Справка', align: 'right', items: [
        item('help.hotkeys', 'Горячие клавиши', { type: 'open', panel: 'help' }, { hint: '?' }),
        item('help.home', 'На главную', { type: 'navigate', href: '/' }),
      ],
    },
  ]
}
