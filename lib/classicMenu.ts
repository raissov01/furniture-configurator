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
import { LANGS, type Lang } from '@/lib/i18n'
import type { ShopExportFormat } from '@/lib/shopExport'
import type { ShopExportScope } from '@/lib/shopExportScope'

export type ClassicPanel = 'gallery' | 'ai' | 'sketch' | 'parts' | 'history' | 'shop' | 'project' | 'quote' | 'drill' | 'room' | 'help' | 'shareCode' | 'account'

export type ClassicCommand =
  | { type: 'open'; panel: ClassicPanel }
  | { type: 'saveProject' }
  | { type: 'openProject' }
  | { type: 'export'; format: ShopExportFormat; scope: ShopExportScope }
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
  | { type: 'toggleWalk' }
  | { type: 'addCabinet' }
  | { type: 'addBoard' }
  | { type: 'addSolid' }
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
  canMirrorSelected?: boolean
  editableBoard: boolean
  canRemoveCabinet: boolean
  /** Цех экспорты мүмкін бе (белсенді корпус бар, өндірісте қате жоқ). */
  canExport: boolean
  /** Project PDF is available when at least one visible cabinet supplies projections. */
  canExportPdf: boolean
  /** Active cabinet exports require the selected node itself to be a cabinet. */
  canExportActiveCabinet?: boolean
  productionError: boolean
  cameraPreset: CameraPreset
  viewMode: 'solid' | 'ghost' | 'wire'
  showFronts: boolean
  projection: 'perspective' | 'ortho'
  showDimensions: boolean
  showDrilling: boolean
  showFittings: boolean
  silhouetteOn: boolean
  walk?: boolean
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

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]
const QUALITIES: { value: Quality; label: string }[] = [
  { value: 'high', label: 'Максимум' },
  { value: 'medium', label: 'Средне' },
  { value: 'low', label: 'Экономно' },
]

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
        { kind: 'heading', id: 'file.export', label: 'Экспорт для цеха — весь проект' },
        item('file.export.xlsx', 'XLSX — весь проект', { type: 'export', format: 'xlsx', scope: 'project' }, { disabled: !s.canExport }),
        item('file.export.csv', 'CSV — весь проект', { type: 'export', format: 'csv', scope: 'project' }, { disabled: !s.canExport }),
        item('file.export.dxf', 'DXF — весь проект', { type: 'export', format: 'dxf', scope: 'project' }, { disabled: !s.canExport }),
        item('file.export.project.pdf', 'PDF — весь проект', { type: 'export', format: 'pdf', scope: 'project' }, { disabled: !s.canExportPdf }),
        { kind: 'heading', id: 'file.export.cabinet', label: 'Активный корпус' },
        item('file.export.cabinet.xlsx', 'XLSX — активный корпус', { type: 'export', format: 'xlsx', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.cabinet.csv', 'CSV — активный корпус', { type: 'export', format: 'csv', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.cabinet.dxf', 'DXF — активный корпус', { type: 'export', format: 'dxf', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.pdf', 'PDF — сборка активного корпуса', { type: 'export', format: 'pdf', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
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
        item('view.walk', 'Прогулка', { type: 'toggleWalk' }, { active: Boolean(s.walk) }),
        // Классикалық режимде ескі header жасырын — тема мен 3D сапасы осында (P0-5).
        SEP,
        { kind: 'heading', id: 'view.theme', label: 'Тема' },
        ...THEMES.map((t) => item(`view.theme.${t.value}`, t.label, { type: 'theme', theme: t.value }, { active: s.theme === t.value })),
        { kind: 'heading', id: 'view.quality', label: 'Качество 3D' },
        ...QUALITIES.map((q) => item(`view.quality.${q.value}`, q.label, { type: 'quality', quality: q.value }, { active: s.quality === q.value })),
      ],
    },
    {
      id: 'element', label: 'Элемент', items: [
        item('element.add', 'Новый корпус', { type: 'addCabinet' }),
        item('element.board', 'Добавить свободную доску', { type: 'addBoard' }),
        item('element.solid', 'Добавить декоративный блок', { type: 'addSolid' }),
        item('element.removeBoard', 'Удалить доску', { type: 'removeBoard' }, { disabled: !s.editableBoard }),
        item('element.duplicate', 'Дублировать', { type: 'duplicate' }, { disabled: !s.activeEditable }),
        item('element.mirror', 'Зеркальная копия', { type: 'mirror' }, { disabled: !(s.canMirrorSelected ?? s.activeEditable) }),
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
      // Тіл, баға, аккаунт, жұмыс орны — бұрын тек жасырын header-де еді (P0-5).
      id: 'service', label: 'Сервис', items: [
        { kind: 'heading', id: 'service.lang', label: 'Язык' },
        ...LANGS.map((l) => item(`service.lang.${l.value}`, l.label, { type: 'lang', lang: l.value }, { active: s.lang === l.value, raw: true })),
        SEP,
        ...(s.price === null ? [] : ['total' in s.price
          ? item('service.price', 'Итого клиенту', { type: 'open', panel: 'quote' }, { detail: s.price.total })
          : item('service.price', 'Цены не заданы', { type: 'open', panel: 'shop' })]),
        ...(s.cloud ? [item('service.account', 'Аккаунт', { type: 'open', panel: 'account' })] : []),
        { kind: 'heading', id: 'service.style', label: 'Рабочее место' },
        item('service.style.classic', 'Классический', { type: 'workspaceStyle', classic: true }, { active: s.classic }),
        item('service.style.ours', 'Наш', { type: 'workspaceStyle', classic: false }, { active: !s.classic }),
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
