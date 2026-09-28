'use client'

/**
 * PRO100 «Библиотека» — ОҢ ЖАҚҚА ҚОНДЫРЫЛҒАН биік панель (эталон видео
 * `video-0928/r_01…r_09`): «Мебель | Элементы | Материалы | Другое»
 * қойындылары, жоғарыда жол комбобоксы мен «жоғары» батырмасы, ішінде сары
 * папкалар мен превью торы. Екі рет басу (не Enter) — қою/ашу.
 *
 * Шаблон превьюі қазір `CabinetThumb` (нақты `generateCabinet()`-тан), орны
 * `data-preview-slot` белгісімен — растр превьюлер (F00p) келгенде осында ауысады.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { t as tr } from '@/lib/i18n'
import { findTemplate, SEED_SETS, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, TEMPLATE_CATEGORIES, templateToCabinet } from '@/src/core/index'
import type { CabinetConfig, CabinetTemplate, Catalog, Material } from '@/src/core/index'
import { PRO100_LIBRARY, type Pro100LibraryItem } from '@/src/core/data/pro100Catalog'
import { cabinetImportChoice } from '@/components/panels/libraryCatalogLogic'
import { CatalogThumb } from '@/components/panels/CatalogThumb'
import { CabinetThumb } from '@/components/CabinetThumb'
import { ClassicIcon, type ClassicIconName } from '@/components/ClassicIcon'
import { ClassicTabs, ClassicWindowIcon } from '@/components/ClassicWindow'
import { cn } from '@/lib/cn'

export type LibraryAction = { id: string; label: string; icon: ClassicIconName; action: () => void; disabled?: boolean }
type Tab = 'furniture' | 'elements' | 'materials' | 'other'
type Tile = { id: string; label: string; preview: ReactNode; activate: () => void; folder?: boolean | undefined; disabled?: boolean | undefined; title?: string | undefined }
type Folder = { id: string; label: string; folders: Folder[]; tiles: Tile[] }

export function FolderGlyph() {
  return <svg aria-hidden="true" width="44" height="36" viewBox="0 0 44 36" className="p100-folder">
    <path d="M1.5 5.5a2 2 0 0 1 2-2h11l4 4h22a2 2 0 0 1 2 2v3h-41z" fill="#e8b93a" stroke="#c9961c" />
    <path d="M1.5 11.5h41v20a2 2 0 0 1-2 2h-37a2 2 0 0 1-2-2z" fill="#f6d36b" stroke="#c9961c" />
  </svg>
}

const PATH_KEY = 'furniture-configurator:classic-library-path'

/** Сүйреліп жатқан плитка: сахнаға тастағанда сол қойылады (PRO100 drag&drop). */
let draggedTile: Tile | null = null
export function hasDraggedLibraryTile(): boolean { return draggedTile !== null }
export function dropDraggedLibraryTile(): boolean {
  const tile = draggedTile
  draggedTile = null
  if (!tile || tile.folder || tile.disabled) return false
  tile.activate()
  return true
}

function loadPaths(): Record<Tab, string[]> {
  const empty = { furniture: [], elements: [], materials: [], other: [] }
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PATH_KEY) ?? 'null')
    if (typeof value !== 'object' || value === null) return empty
    const read = (key: Tab) => { const list = (value as Record<string, unknown>)[key]; return Array.isArray(list) && list.every((item) => typeof item === 'string') ? list as string[] : [] }
    return { furniture: read('furniture'), elements: read('elements'), materials: read('materials'), other: read('other') }
  } catch { return empty }
}

/**
 * PRO100 кітапханасының бума ағашы (`pro100Catalog`, 365 бума): «Мебель» —
 * түбір, қалғаны `path` бойынша. Модуль — атауынан ені мен есік саны
 * оқылатын жуық шаблон (Н1 = 1 есік).
 */
type Pro100Folder = { id: string; label: string; folders: Map<string, Pro100Folder>; items: Pro100LibraryItem[] }
let pro100Tree: Pro100Folder | null = null
function pro100Root(): Pro100Folder {
  if (pro100Tree) return pro100Tree
  const root: Pro100Folder = { id: 'p100', label: 'Мебель', folders: new Map(), items: [] }
  for (const item of PRO100_LIBRARY) {
    let folder = root
    for (const segment of item.path.slice(item.path[0] === 'Мебель' ? 1 : 0)) {
      let next = folder.folders.get(segment)
      if (!next) { next = { id: `${folder.id}/${segment}`, label: segment, folders: new Map(), items: [] }; folder.folders.set(segment, next) }
      folder = next
    }
    folder.items.push(item)
  }
  pro100Tree = root
  return root
}

/**
 * PRO100 стандарт кухня кітапханасында «Н1/В1» — бір есікті, «Н2/В2» — екі
 * есікті модуль (UX тестіндегі PRO100 пайдаланушысының түсіндірмесі). Атауда
 * есік саны жазылмаса, осы цифр ғана алынады; басқа кодтар өзгермейді.
 */
export function variantDoors(variant: string | undefined): number | undefined {
  const match = variant?.match(/^[НВHB]([12])$/u)
  return match ? Number(match[1]) : undefined
}

/** PRO100 модулі → біздің корпус (жуық шаблон, ені мен есік саны атауынан). */
export function pro100Cabinet(item: Pro100LibraryItem, catalog: Catalog): { cabinet: CabinetConfig } | { reason: string } {
  if (item.group !== 'cabinet') return { reason: 'Аксессуар из PRO100 пока нельзя вставить' }
  const choice = cabinetImportChoice(item)
  if (!choice.allowed) {
    return { reason: choice.reason === 'unsupportedShape' ? 'Угловой или фигурный модуль пока не поддерживается'
      : choice.reason === 'unknownWidth' ? 'Ширина не указана в названии модуля'
        : choice.reason === 'widthRange' ? 'Ширина вне допустимого диапазона шаблона' : 'Тип модуля не распознан' }
  }
  const template = findTemplate(choice.templateId)
  if (!template) return { reason: 'Тип модуля не распознан' }
  const cabinet = { ...templateToCabinet(template, catalog, choice.size), name: item.name }
  const doors = item.parsed.drawerCount === undefined ? item.parsed.doorCount ?? variantDoors(item.parsed.variant) : undefined
  return { cabinet: doors ? { ...cabinet, sections: cabinet.sections.map((section) => ({ ...section, fronts: { count: doors, mount: 'overlay' as const } })) } : cabinet }
}

const THUMB_PX = 64
const tallest = Math.max(...SEED_TEMPLATES.map((template) => template.height))

function templateTile(template: CabinetTemplate, catalog: Catalog, onInsert: (cabinet: CabinetConfig) => void): Tile {
  let preview: ReactNode
  try {
    preview = <span className="p100-lib-thumb" data-preview-slot={template.id}>
      <CabinetThumb cabinet={templateToCabinet(template, catalog)} catalog={catalog} pxPerMm={THUMB_PX * Math.sqrt(template.height / tallest) / template.height} />
    </span>
  } catch {
    // Каталогта шаблонның материалы жоқ болса, превью бос қалады; қою кезінде қате шығады.
    preview = <span className="p100-lib-thumb" data-preview-slot={template.id} />
  }
  return { id: template.id, label: tr(template.name), preview, activate: () => onInsert(templateToCabinet(template, catalog)),
    title: `${template.height} (H) × ${template.width} (W) × ${template.depth} (D)` }
}

function swatch(material: Material): ReactNode {
  const decor = material.decor
  return <span className="p100-lib-swatch" style={{ backgroundColor: decor?.color ?? '#b8b4ac',
    ...(decor?.mapUrl ? { backgroundImage: `url(${JSON.stringify(decor.mapUrl)})`, backgroundSize: 'cover' } : {}) }} />
}

export function ClassicLibraryDock({ catalog, onClose, onInsertCabinet, onLoadSet, onApplyMaterial, elements, other }: {
  catalog: Catalog
  onClose: () => void
  /** Корпусты бөлмеге қою; қате болса — себебі. */
  onInsertCabinet: (cabinet: CabinetConfig) => string | null
  onLoadSet: (id: string) => void
  /** Қолданылмаса — себебі (статус жолында көрсетіледі). */
  onApplyMaterial: (material: Material) => string | null
  elements: LibraryAction[]
  other: LibraryAction[]
}) {
  const [tab, setTab] = useState<Tab>('furniture')
  // Соңғы ашылған бума есте қалады (PRO100 сияқты).
  const [path, setPath] = useState<Record<Tab, string[]>>(loadPaths)
  const [selected, setSelected] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const roots = useMemo((): Record<Tab, Folder> => {
    const insert = (cabinet: CabinetConfig) => { setStatus(onInsertCabinet(cabinet) ?? `${tr('Добавлено')}: ${cabinet.name}`) }
    const pro100Tile = (item: Pro100LibraryItem): Tile => {
      const result = pro100Cabinet(item, catalog)
      return { id: item.id, label: item.name, disabled: 'reason' in result, title: 'reason' in result ? tr(result.reason) : item.name,
        preview: <span className="p100-lib-thumb p100-lib-catalog" data-preview-slot={item.id}><CatalogThumb parsed={item.parsed} /></span>,
        activate: () => { if ('cabinet' in result) insert(result.cabinet) } }
    }
    const toFolder = (source: Pro100Folder): Folder => ({ id: source.id, label: source.label,
      folders: [...source.folders.values()].map(toFolder), tiles: source.items.map(pro100Tile) })
    const pro100 = toFolder(pro100Root())
    const categories: Folder[] = TEMPLATE_CATEGORIES.map((category) => {
      const templates = SEED_TEMPLATES.filter((template) => template.category === category.value)
      const subs = [...new Set(templates.map((template) => template.subcategory).filter((value): value is string => Boolean(value)))]
      return {
        id: `cat-${category.value}`, label: tr(category.label),
        folders: subs.length > 1 ? subs.map((sub) => ({ id: `cat-${category.value}-${sub}`, label: tr(sub), folders: [],
          tiles: templates.filter((template) => template.subcategory === sub).map((template) => templateTile(template, catalog, insert)) })) : [],
        tiles: (subs.length > 1 ? templates.filter((template) => !template.subcategory) : templates)
          .map((template) => templateTile(template, catalog, insert)),
      }
    })
    const sets: Folder = { id: 'sets', label: tr('Наборы'), folders: [], tiles: SEED_SETS.map((set) => ({
      id: `set-${set.id}`, label: tr(set.name), title: tr(set.description),
      preview: <span className="p100-lib-thumb p100-lib-set"><ClassicIcon name="assembly" /></span>,
      activate: () => onLoadSet(set.id),
    })) }
    const standard: Folder = { id: 'standard', label: tr('Стандартная номенклатура'), folders: [],
      tiles: STANDARD_NOMENCLATURE_TEMPLATES.map((template) => templateTile(template, catalog, insert)) }
    const apply = (material: Material) => { setStatus(onApplyMaterial(material) ?? `${tr('Материал применён')}: ${material.name}`) }
    const sheet = catalog.materials.filter((material) => !material.slab)
    const thicknesses = [...new Set(sheet.map((material) => material.thickness))].sort((a, b) => a - b)
    const materialFolders: Folder[] = [
      ...thicknesses.map((thickness) => ({ id: `t-${thickness}`, label: `${tr('Плиты')} ${thickness} мм`, folders: [],
        tiles: sheet.filter((material) => material.thickness === thickness).map((material) => ({
          id: material.id, label: material.name, preview: swatch(material), activate: () => apply(material) })) })),
      ...(catalog.materials.some((material) => material.slab) ? [{ id: 'slab', label: tr('Столешницы'), folders: [],
        tiles: catalog.materials.filter((material) => material.slab).map((material) => ({
          id: material.id, label: material.name, preview: swatch(material), activate: () => apply(material) })) }] : []),
    ]
    const actionTile = (entry: LibraryAction): Tile => ({ id: entry.id, label: entry.label, disabled: entry.disabled,
      preview: <span className="p100-lib-thumb p100-lib-action"><ClassicIcon name={entry.icon} /></span>, activate: entry.action })
    return {
      // PRO100 бумалары бірінші, біздің параметрлік шаблондар — «Шаблоны AisMebel» бумасында.
      furniture: { id: 'furniture', label: tr('Мебель'), folders: [...pro100.folders,
        { id: 'aismebel', label: tr('Шаблоны AisMebel'), folders: [sets, ...categories.filter((folder) => folder.tiles.length + folder.folders.length > 0), standard], tiles: [] }], tiles: pro100.tiles },
      elements: { id: 'elements', label: tr('Элементы'), folders: [], tiles: elements.map(actionTile) },
      materials: { id: 'materials', label: tr('Материалы'), folders: materialFolders, tiles: [] },
      other: { id: 'other', label: tr('Другое'), folders: [], tiles: other.map(actionTile) },
    }
  }, [catalog, elements, other, onApplyMaterial, onInsertCabinet, onLoadSet])

  // Ағымдағы папка: жолдың әр қадамы бір деңгей төмен түседі.
  const chain: Folder[] = [roots[tab]]
  for (const id of path[tab]) {
    const next = chain[chain.length - 1]!.folders.find((folder) => folder.id === id)
    if (!next) break
    chain.push(next)
  }
  const folder = chain[chain.length - 1]!
  const go = (ids: string[]) => {
    setPath((current) => {
      const next = { ...current, [tab]: ids }
      try { window.localStorage.setItem(PATH_KEY, JSON.stringify(next)) } catch { /* жады жоқ — бума тек осы сессияда есте */ }
      return next
    })
    setSelected(null)
  }
  const tiles: Tile[] = [
    ...folder.folders.map((child) => ({ id: child.id, label: child.label, folder: true, preview: <FolderGlyph />,
      activate: () => go([...path[tab].slice(0, chain.length - 1), child.id]) })),
    ...folder.tiles,
  ]

  return <aside className="p100-library" data-testid="classic-library" aria-label={tr('Библиотека')}>
    <header className="p100-library-title">
      <ClassicWindowIcon />
      <strong>{tr('Библиотека')}</strong>
      <button type="button" aria-label={tr('Закрыть')} title={tr('Закрыть')} onClick={onClose}>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1 1 9" stroke="currentColor" strokeWidth="1.1" /></svg>
      </button>
    </header>
    <ClassicTabs label={tr('Библиотека')} value={tab} onChange={(value) => { setTab(value); setSelected(null); setStatus(null) }} tabs={[
      { value: 'furniture', label: tr('Мебель') },
      { value: 'elements', label: tr('Элементы') },
      { value: 'materials', label: tr('Материалы') },
      { value: 'other', label: tr('Другое') },
    ]} />
    <div className="p100-library-path">
      <span className="p100-library-path-folder" aria-hidden="true"><FolderGlyph /></span>
      <select aria-label={tr('Папка')} value={chain.length - 1} onChange={(event) => go(path[tab].slice(0, Number(event.target.value)))}>
        {chain.map((entry, index) => <option key={entry.id} value={index}>{chain.slice(0, index + 1).map((item) => item.label).join('\\')}</option>)}
      </select>
      <button type="button" className="p100-icon-button" disabled={chain.length < 2} aria-label={tr('На уровень вверх')} title={tr('На уровень вверх')}
        onClick={() => go(path[tab].slice(0, Math.max(0, chain.length - 2)))}>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M6 11V1.5M2 5.5 6 1.5l4 4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
      </button>
    </div>
    <div className="p100-library-grid" role="listbox" aria-label={folder.label}>
      {tiles.length === 0 ? <p className="p100-hint">{tr('Папка пуста')}</p> : null}
      {tiles.map((tile) => <button key={tile.id} type="button" role="option" aria-selected={selected === tile.id}
        className={cn('p100-lib-tile', tile.folder && 'p100-lib-folder')} disabled={tile.disabled} title={tile.title ?? tile.label}
        data-testid={`library-tile-${tile.id}`}
        draggable={!tile.folder && !tile.disabled}
        onDragStart={(event) => { draggedTile = tile; event.dataTransfer.setData('text/plain', tile.label); event.dataTransfer.effectAllowed = 'copy' }}
        onDragEnd={() => { window.setTimeout(() => { draggedTile = null }, 0) }}
        onClick={() => setSelected(tile.id)}
        onDoubleClick={() => tile.activate()}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); tile.activate() } }}>
        {tile.preview}
        <span className="p100-lib-label">{tile.label}</span>
      </button>)}
    </div>
    <footer className="p100-library-status" role="status">{status ?? tr('Двойной щелчок или перетаскивание в сцену — вставить')}</footer>
  </aside>
}
