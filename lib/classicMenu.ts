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
import { classicFileHint } from '@/lib/hotkeys'

export type ClassicPanel = 'gallery' | 'ai' | 'sketch' | 'parts' | 'history' | 'shop' | 'project' | 'quote' | 'drill' | 'room' | 'help' | 'shareCode' | 'account'

export type ClassicCommand =
  | { type: 'open'; panel: ClassicPanel }
  | { type: 'saveProject' }
  | { type: 'openProject' }
  | { type: 'export'; format: ShopExportFormat; scope: ShopExportScope }
  | { type: 'panorama' }
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
  | { type: 'xray' }
  | { type: 'fit' }
  | { type: 'toggleSilhouette' }
  | { type: 'toggleWalk' }
  | { type: 'addCabinet' }
  | { type: 'addBoard' }
  | { type: 'addSolid' }
  | { type: 'addSpecialPart'; kind: 'lathe' | 'bent' }
  | { type: 'importSolid' }
  | { type: 'removeBoard' }
  | { type: 'duplicate' }
  | { type: 'mirror' }
  | { type: 'removeCabinet' }
  | { type: 'toggleOpen' }
  | { type: 'toggleAssembly' }
  | { type: 'toggleSelectedDoor' }
  | { type: 'navigate'; href: string }
  | { type: 'theme'; theme: Theme }
  | { type: 'quality'; quality: Quality }
  | { type: 'lang'; lang: Lang }
  | { type: 'roomDialog' }
  | { type: 'lightDialog' }
  | { type: 'library' }
  | { type: 'reports' }
  | { type: 'properties' }
  | { type: 'dockTab'; tab: 'structure' | 'layers' | 'find' | 'replace' }
  | { type: 'dockPanel'; id: 'price' | 'dimensions' | 'info' | 'import' }
  | { type: 'toggleRealistic' }
  | { type: 'rotate'; degrees: 90 | -90 }
  | { type: 'group' }
  | { type: 'ungroup' }
  | { type: 'hideSelected' }
  | { type: 'deleteSelected' }
  | { type: 'align'; axis: 'x' | 'y' | 'z'; mode: 'min' | 'center' | 'max' | 'distribute' }
  | { type: 'startGuide' }

export type ClassicMenuEntry =
  | { kind: 'item'; id: string; label: string; command: ClassicCommand; disabled?: boolean; active?: boolean; hint?: string; detail?: string; raw?: boolean }
  | { kind: 'slider'; id: string; label: string }
  | { kind: 'silhouetteHeight'; id: string; label: string }
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
  canExportPanels?: boolean
  canExportDxf?: boolean
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
  xray?: boolean
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
  selectedDoor?: boolean
  selectedDoorOpen?: boolean
  /** PRO100 қосымшалары: жоқ болса — өшірулі (ескі тесттер мен шақырулар үшін). */
  realistic?: boolean
  canProperties?: boolean
  canRotate?: boolean
  canDelete?: boolean
  canHide?: boolean
  /** Структурадағы көптік таңдау: туралау ≥ 2, тарату ≥ 3. */
  selectionCount?: number
  canUngroup?: boolean
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

/** PRO100 «Элемент → Выровнять / Распределить»: өс және бағыт. Z — алдынан артқа қарай. */
export const ALIGN_ITEMS: { axis: 'x' | 'y' | 'z'; mode: 'min' | 'center' | 'max' | 'distribute'; label: string }[] = [
  { axis: 'x', mode: 'min', label: 'Выровнять влево' },
  { axis: 'x', mode: 'center', label: 'Выровнять по центру (X)' },
  { axis: 'x', mode: 'max', label: 'Выровнять вправо' },
  { axis: 'y', mode: 'min', label: 'Выровнять вниз' },
  { axis: 'y', mode: 'center', label: 'Выровнять по центру (Y)' },
  { axis: 'y', mode: 'max', label: 'Выровнять вверх' },
  { axis: 'z', mode: 'min', label: 'Выровнять вперёд' },
  { axis: 'z', mode: 'center', label: 'Выровнять по центру (Z)' },
  { axis: 'z', mode: 'max', label: 'Выровнять назад' },
  { axis: 'x', mode: 'distribute', label: 'Распределить по X' },
  { axis: 'y', mode: 'distribute', label: 'Распределить по Y' },
  { axis: 'z', mode: 'distribute', label: 'Распределить по Z' },
]

export function classicMenus(s: ClassicMenuState): ClassicMenu[] {
  const item = (id: string, label: string, command: ClassicCommand, extra: Partial<Extract<ClassicMenuEntry, { kind: 'item' }>> = {}): ClassicMenuEntry =>
    ({ kind: 'item', id, label, command, ...extra })
  return [
    {
      id: 'file', label: 'Файл', items: [
        item('file.reset', 'Новый проект', { type: 'reset' }),
        item('file.open', 'Открыть проект', { type: 'openProject' }, { hint: classicFileHint('openProject') }),
        item('file.save', 'Сохранить проект', { type: 'saveProject' }, { hint: classicFileHint('saveProject') }),
        SEP,
        item('file.room', 'Свойства помещения…', { type: 'roomDialog' }),
        item('file.project', 'Материалы и сборка', { type: 'open', panel: 'project' }),
        SEP,
        item('file.importSolid', 'Импорт → 3DS/OBJ', { type: 'importSolid' }),
        item('file.gallery', 'Готовые шаблоны', { type: 'open', panel: 'gallery' }),
        item('file.ai', 'Техзадание (словами)', { type: 'open', panel: 'ai' }),
        item('file.sketch', 'Нарисовать мышью', { type: 'open', panel: 'sketch' }, { disabled: !s.activeEditable }),
        item('file.parts', 'Своя деталь', { type: 'open', panel: 'parts' }, { disabled: !s.activeEditable }),
        SEP,
        { kind: 'heading', id: 'file.export', label: 'Экспорт для цеха — весь проект' },
        item('file.export.xlsx', 'XLSX — весь проект', { type: 'export', format: 'xlsx', scope: 'project' }, { disabled: !s.canExport }),
        item('file.export.csv', 'CSV — весь проект', { type: 'export', format: 'csv', scope: 'project' }, { disabled: !(s.canExportPanels ?? s.canExport) }),
        item('file.export.dxf', 'DXF — весь проект', { type: 'export', format: 'dxf', scope: 'project' }, { disabled: !(s.canExportDxf ?? s.canExport) }),
        item('file.export.project.pdf', 'PDF — весь проект', { type: 'export', format: 'pdf', scope: 'project' }, { disabled: !s.canExportPdf, hint: classicFileHint('printProject') }),
        item('file.export.panorama', 'Панорама 360°', { type: 'panorama' }),
        { kind: 'heading', id: 'file.export.cabinet', label: 'Активный корпус' },
        item('file.export.cabinet.xlsx', 'XLSX — активный корпус', { type: 'export', format: 'xlsx', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.cabinet.csv', 'CSV — активный корпус', { type: 'export', format: 'csv', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.cabinet.dxf', 'DXF — активный корпус', { type: 'export', format: 'dxf', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        item('file.export.pdf', 'PDF — сборка активного корпуса', { type: 'export', format: 'pdf', scope: 'cabinet' }, { disabled: !(s.canExportActiveCabinet ?? s.canExportPdf) }),
        SEP,
        item('file.link', 'Ссылка клиенту', { type: 'clientLink' }),
        item('file.code', 'Код для клиента', { type: 'open', panel: 'shareCode' }),
      ],
    },
    {
      id: 'edit', label: 'Правка', items: [
        item('edit.undo', 'Отменить', { type: 'undo' }, { disabled: !s.canUndo, hint: 'Ctrl+Z' }),
        item('edit.redo', 'Повторить', { type: 'redo' }, { disabled: !s.canRedo, hint: 'Ctrl+⇧Z' }),
        SEP,
        item('edit.delete', 'Удалить', { type: 'deleteSelected' }, { disabled: !s.canDelete, hint: 'Del' }),
        item('edit.hide', 'Скрыть', { type: 'hideSelected' }, { disabled: !s.canHide }),
        SEP,
        item('edit.group', 'Группировать', { type: 'group' }, { disabled: (s.selectionCount ?? 0) < 2, hint: 'Ctrl+G' }),
        item('edit.ungroup', 'Разгруппировать', { type: 'ungroup' }, { disabled: !s.canUngroup }),
        item('edit.duplicate', 'Дублировать корпус', { type: 'duplicate' }, { disabled: !s.activeEditable }),
        SEP,
        item('edit.history', 'История сохранений', { type: 'open', panel: 'history' }),
      ],
    },
    {
      id: 'view', label: 'Вид', items: [
        ...PRESETS.map((p) => item(`view.preset.${p.value}`, p.label, { type: 'preset', preset: p.value }, { active: s.cameraPreset === p.value })),
        SEP,
        item('view.realistic', 'Реалистичный вид', { type: 'toggleRealistic' }, { active: Boolean(s.realistic) }),
        { kind: 'slider', id: 'view.exploded', label: 'Разнести' },
        item('view.mode', s.viewMode === 'solid' ? 'Прозрачность' : s.viewMode === 'ghost' ? 'Полупрозрачно' : 'Контур', { type: 'cycleViewMode' }, { active: s.viewMode !== 'solid' }),
        item('view.fronts', s.showFronts ? 'Скрыть фасады' : 'Показать фасады', { type: 'toggleFronts' }, { active: !s.showFronts }),
        item('view.projection', s.projection === 'perspective' ? 'Ортогональная проекция' : 'Перспектива', { type: 'toggleProjection' }, { active: s.projection === 'ortho' }),
        item('view.dimensions', 'Размеры на сцене', { type: 'toggleDimensions' }, { active: s.showDimensions }),
        item('view.fittings.none', 'Фурнитура: скрыть', { type: 'fittings', show: 'none' }, { active: !s.showDrilling && !s.showFittings }),
        item('view.fittings.drilling', 'Фурнитура: отверстия', { type: 'fittings', show: 'drilling' }, { active: s.showDrilling }),
        item('view.fittings.fittings', 'Фурнитура: крепёж', { type: 'fittings', show: 'fittings' }, { active: s.showFittings }),
        item('view.xray', 'Присадка (рентген)', { type: 'xray' }, { active: Boolean(s.xray), hint: 'X' }),
        item('view.fit', 'Вписать в кадр', { type: 'fit' }),
        item('view.silhouette', 'Человек для масштаба', { type: 'toggleSilhouette' }, { active: s.silhouetteOn }),
        ...(s.silhouetteOn ? [{ kind: 'silhouetteHeight' as const, id: 'view.silhouetteHeight', label: 'Рост человека, мм' }] : []),
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
        item('element.add', 'Новый корпус', { type: 'addCabinet' }, { hint: classicFileHint('newCabinet') }),
        item('element.board', 'Добавить свободную доску', { type: 'addBoard' }),
        item('element.solid', 'Добавить декоративный блок', { type: 'addSolid' }),
        item('element.lathe', 'Токарная деталь', { type: 'addSpecialPart', kind: 'lathe' }),
        item('element.bent', 'Гнутая деталь', { type: 'addSpecialPart', kind: 'bent' }),
        item('element.removeBoard', 'Удалить доску', { type: 'removeBoard' }, { disabled: !s.editableBoard }),
        item('element.duplicate', 'Дублировать', { type: 'duplicate' }, { disabled: !s.activeEditable }),
        item('element.mirror', 'Зеркальная копия', { type: 'mirror' }, { disabled: !(s.canMirrorSelected ?? s.activeEditable) }),
        item('element.remove', 'Удалить корпус', { type: 'removeCabinet' }, { disabled: !s.canRemoveCabinet }),
        SEP,
        item('element.rotateCcw', 'Повернуть на 90° против часовой', { type: 'rotate', degrees: 90 }, { disabled: !s.canRotate }),
        item('element.rotateCw', 'Повернуть на 90° по часовой', { type: 'rotate', degrees: -90 }, { disabled: !s.canRotate }),
        { kind: 'heading', id: 'element.align', label: 'Выровнять (выбор в Структуре)' },
        ...ALIGN_ITEMS.map((entry) => item(`element.align.${entry.axis}.${entry.mode}`, entry.label,
          { type: 'align', axis: entry.axis, mode: entry.mode },
          { disabled: (s.selectionCount ?? 0) < (entry.mode === 'distribute' ? 3 : 2) })),
        SEP,
        item('element.open', s.open ? 'Закрыть створки' : 'Распахнуть', { type: 'toggleOpen' }, { active: s.open }),
        item('element.selectedDoor', s.selectedDoorOpen ? 'Закрыть дверцу' : 'Открыть дверцу', { type: 'toggleSelectedDoor' }, { disabled: !s.selectedDoor }),
        item('element.assembly', 'Сборка', { type: 'toggleAssembly' }, { active: s.assembly }),
        SEP,
        item('element.properties', 'Свойства…', { type: 'properties' }, { disabled: !s.canProperties, hint: 'Enter' }),
      ],
    },
    {
      id: 'tools', label: 'Инструменты', items: [
        item('tools.library', 'Библиотека', { type: 'library' }),
        item('tools.find', 'Найти', { type: 'dockTab', tab: 'find' }),
        item('tools.structure', 'Структура', { type: 'dockTab', tab: 'structure' }),
        item('tools.layers', 'Слои', { type: 'dockTab', tab: 'layers' }),
        item('tools.replace', 'Замена', { type: 'dockTab', tab: 'replace' }),
        item('tools.dimensions', 'Размеры', { type: 'dockPanel', id: 'dimensions' }),
        item('tools.info', 'Информация', { type: 'dockPanel', id: 'info' }),
        item('tools.import', 'Импорт', { type: 'dockPanel', id: 'import' }),
        item('tools.light', 'Свет…', { type: 'lightDialog' }),
        item('tools.price', 'Прайс-лист', { type: 'dockPanel', id: 'price' }),
        SEP,
        item('tools.reports', 'Отчёты…', { type: 'reports' }, { disabled: s.productionError }),
        item('tools.quote', 'Смета и раскрой', { type: 'open', panel: 'quote' }, { disabled: s.productionError }),
        item('tools.cut', 'Раскрой (отдельный экран)', { type: 'navigate', href: '/cut' }),
        item('tools.drill', 'Присадка', { type: 'open', panel: 'drill' }, { disabled: !s.activeEditable && !s.editableBoard }),
        item('tools.room', 'Стены и комната', { type: 'open', panel: 'room' }),
        SEP,
        item('tools.shop', 'Цех: материалы и цены', { type: 'open', panel: 'shop' }),
        // Бұрынғы «Сервис» мәзірі: PRO100-де ондай мәзір жоқ, сондықтан пункттері осында.
        ...(s.price === null ? [] : ['total' in s.price
          ? item('service.price', 'Итого клиенту', { type: 'open', panel: 'quote' }, { detail: s.price.total })
          : item('service.price', 'Цены не заданы', { type: 'open', panel: 'shop' })]),
        { kind: 'heading', id: 'service.lang', label: 'Язык' },
        ...LANGS.map((l) => item(`service.lang.${l.value}`, l.label, { type: 'lang', lang: l.value }, { active: s.lang === l.value, raw: true })),
        SEP,
        item('service.mobile', 'Телефон · Сегодня', { type: 'navigate', href: '/mobile' }),
        ...(s.cloud ? [item('service.account', 'Аккаунт', { type: 'open', panel: 'account' })] : []),
      ],
    },
    {
      id: 'help', label: 'Справка', align: 'right', items: [
        item('help.start', 'Начало работы', { type: 'startGuide' }),
        item('help.hotkeys', 'Горячие клавиши', { type: 'open', panel: 'help' }, { hint: '?' }),
        item('help.home', 'На главную', { type: 'navigate', href: '/' }),
      ],
    },
  ]
}
