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
import { SEED_SETS, SEED_TEMPLATES, STANDARD_NOMENCLATURE_TEMPLATES, TEMPLATE_CATEGORIES, templateToCabinet } from '@/src/core/index'
import type { CabinetTemplate, Catalog, Material } from '@/src/core/index'
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

const THUMB_PX = 64
const tallest = Math.max(...SEED_TEMPLATES.map((template) => template.height))

function templateTile(template: CabinetTemplate, catalog: Catalog, onInsert: (template: CabinetTemplate) => void): Tile {
  let preview: ReactNode
  try {
    preview = <span className="p100-lib-thumb" data-preview-slot={template.id}>
      <CabinetThumb cabinet={templateToCabinet(template, catalog)} catalog={catalog} pxPerMm={THUMB_PX * Math.sqrt(template.height / tallest) / template.height} />
    </span>
  } catch {
    // Каталогта шаблонның материалы жоқ болса, превью бос қалады; қою кезінде қате шығады.
    preview = <span className="p100-lib-thumb" data-preview-slot={template.id} />
  }
  return { id: template.id, label: tr(template.name), preview, activate: () => onInsert(template),
    title: `${template.height} (H) × ${template.width} (W) × ${template.depth} (D)` }
}

function swatch(material: Material): ReactNode {
  const decor = material.decor
  return <span className="p100-lib-swatch" style={{ backgroundColor: decor?.color ?? '#b8b4ac',
    ...(decor?.mapUrl ? { backgroundImage: `url(${JSON.stringify(decor.mapUrl)})`, backgroundSize: 'cover' } : {}) }} />
}

export function ClassicLibraryDock({ catalog, onClose, onInsertTemplate, onLoadSet, onApplyMaterial, elements, other }: {
  catalog: Catalog
  onClose: () => void
  onInsertTemplate: (template: CabinetTemplate) => void
  onLoadSet: (id: string) => void
  /** Қолданылмаса — себебі (статус жолында көрсетіледі). */
  onApplyMaterial: (material: Material) => string | null
  elements: LibraryAction[]
  other: LibraryAction[]
}) {
  const [tab, setTab] = useState<Tab>('furniture')
  const [path, setPath] = useState<Record<Tab, string[]>>({ furniture: [], elements: [], materials: [], other: [] })
  const [selected, setSelected] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const roots = useMemo((): Record<Tab, Folder> => {
    const categories: Folder[] = TEMPLATE_CATEGORIES.map((category) => {
      const templates = SEED_TEMPLATES.filter((template) => template.category === category.value)
      const subs = [...new Set(templates.map((template) => template.subcategory).filter((value): value is string => Boolean(value)))]
      return {
        id: `cat-${category.value}`, label: tr(category.label),
        folders: subs.length > 1 ? subs.map((sub) => ({ id: `cat-${category.value}-${sub}`, label: tr(sub), folders: [],
          tiles: templates.filter((template) => template.subcategory === sub).map((template) => templateTile(template, catalog, onInsertTemplate)) })) : [],
        tiles: (subs.length > 1 ? templates.filter((template) => !template.subcategory) : templates)
          .map((template) => templateTile(template, catalog, onInsertTemplate)),
      }
    })
    const sets: Folder = { id: 'sets', label: tr('Наборы'), folders: [], tiles: SEED_SETS.map((set) => ({
      id: `set-${set.id}`, label: tr(set.name), title: tr(set.description),
      preview: <span className="p100-lib-thumb p100-lib-set"><ClassicIcon name="assembly" /></span>,
      activate: () => onLoadSet(set.id),
    })) }
    const standard: Folder = { id: 'standard', label: tr('Стандартная номенклатура'), folders: [],
      tiles: STANDARD_NOMENCLATURE_TEMPLATES.map((template) => templateTile(template, catalog, onInsertTemplate)) }
    const apply = (material: Material) => { setStatus(onApplyMaterial(material) ?? `${tr('Материал применён')}: ${material.name}`) }
    const sheet = catalog.materials.filter((material) => !material.slab)
    const thicknesses = [...new Set(sheet.map((material) => material.thickness))].sort((a, b) => b - a)
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
      furniture: { id: 'furniture', label: tr('Мебель'), folders: [sets, ...categories.filter((folder) => folder.tiles.length + folder.folders.length > 0), standard], tiles: [] },
      elements: { id: 'elements', label: tr('Элементы'), folders: [], tiles: elements.map(actionTile) },
      materials: { id: 'materials', label: tr('Материалы'), folders: materialFolders, tiles: [] },
      other: { id: 'other', label: tr('Другое'), folders: [], tiles: other.map(actionTile) },
    }
  }, [catalog, elements, other, onApplyMaterial, onInsertTemplate, onLoadSet])

  // Ағымдағы папка: жолдың әр қадамы бір деңгей төмен түседі.
  const chain: Folder[] = [roots[tab]]
  for (const id of path[tab]) {
    const next = chain[chain.length - 1]!.folders.find((folder) => folder.id === id)
    if (!next) break
    chain.push(next)
  }
  const folder = chain[chain.length - 1]!
  const go = (ids: string[]) => { setPath((current) => ({ ...current, [tab]: ids })); setSelected(null) }
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
        onClick={() => setSelected(tile.id)}
        onDoubleClick={() => tile.activate()}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); tile.activate() } }}>
        {tile.preview}
        <span className="p100-lib-label">{tile.label}</span>
      </button>)}
    </div>
    <footer className="p100-library-status" role="status">{status ?? tr('Двойной щелчок — вставить или открыть')}</footer>
  </aside>
}
